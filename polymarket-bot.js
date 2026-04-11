'use strict';
/**
 * Polymarket Bitcoin Up/Down Trading Bot
 *
 * Surveille les marchés "Bitcoin Up or Down" 5 minutes sur Polymarket,
 * analyse la dynamique de prix BTC via Binance et place des ordres automatiques.
 *
 * Variables d'environnement requises :
 *   WALLET_PRIVATE_KEY          Clé privée du wallet Polygon (0x...) avec USDC
 *   TELEGRAM_TOKEN              Token du bot Telegram
 *   TELEGRAM_CHAT_ID            ID du chat/canal Telegram pour les alertes
 *
 * Variables optionnelles (dérivées automatiquement si absentes) :
 *   POLYMARKET_API_KEY
 *   POLYMARKET_API_SECRET
 *   POLYMARKET_API_PASSPHRASE
 *
 * Configuration trading (avec valeurs par défaut) :
 *   TRADE_SIZE=5                Mise par trade en USD (défaut : 5)
 *   MAX_POSITIONS=3             Positions simultanées max (défaut : 3)
 *   LOOP_INTERVAL=30000         Intervalle de vérification en ms (défaut : 30s)
 *   MIN_SCORE=4                 Score minimum sur 5 pour trader (défaut : 4)
 *   MAX_PRICE=0.80              Prix d'achat maximum par share (défaut : 0.80)
 */
require('dotenv').config();

const { ClobClient } = require('@polymarket/clob-client');
const { ethers }     = require('ethers');
const axios          = require('axios');
const { Telegraf }   = require('telegraf');

// ─── CONFIGURATION ─────────────────────────────────────────────────────────
const CLOB_HOST    = 'https://clob.polymarket.com';
const GAMMA_HOST   = 'https://gamma-api.polymarket.com';
const BINANCE_HOST = 'https://api.binance.com/api/v3';
const CHAIN_ID     = 137; // Polygon mainnet

const TRADE_SIZE    = parseFloat(process.env.TRADE_SIZE    || '5');
const MAX_POSITIONS = parseInt (process.env.MAX_POSITIONS  || '3',  10);
const LOOP_MS       = parseInt (process.env.LOOP_INTERVAL  || '30000', 10);
const MIN_SCORE     = parseInt (process.env.MIN_SCORE      || '4',  10); // sur 5
const MAX_BUY_PRICE = parseFloat(process.env.MAX_PRICE     || '0.80');
const MIN_BUY_PRICE = 0.05;

// ─── ANALYSE TECHNIQUE BTC ─────────────────────────────────────────────────
/**
 * Récupère les bougies 1 min de BTC/USDT depuis Binance.
 */
async function getBTCKlines(interval = '1m', limit = 30) {
  const { data } = await axios.get(`${BINANCE_HOST}/klines`, {
    params: { symbol: 'BTCUSDT', interval, limit },
    timeout: 6000,
  });
  return data.map(k => ({
    open:   +k[1],
    high:   +k[2],
    low:    +k[3],
    close:  +k[4],
    volume: +k[5],
    time:   k[0],
  }));
}

function calcEMA(values, period) {
  const k = 2 / (period + 1);
  let ema = values[0];
  for (let i = 1; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
  }
  return ema;
}

function calcRSI(closes, period = 14) {
  if (closes.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const delta = closes[i] - closes[i - 1];
    if (delta > 0) gains += delta;
    else           losses -= delta;
  }
  return 100 - 100 / (1 + gains / (losses || 1e-9));
}

/**
 * Génère un signal directionnel (score 0-5) à partir des bougies 1 min.
 *
 * Critères (1 point chacun) :
 *   1. Prix > EMA(9)
 *   2. EMA(9) > EMA(21)
 *   3. Momentum 1 min positif
 *   4. Momentum 3 min positif
 *   5. Momentum 5 min positif
 *
 * Score >= MIN_SCORE → "Up"
 * Score <= (5 - MIN_SCORE) → "Down"
 * Sinon → null (pas de trade)
 */
async function getSignal() {
  const klines = await getBTCKlines('1m', 30);
  const closes = klines.map(k => k.close);
  const n      = closes.length;
  const last   = closes[n - 1];

  const ema9  = calcEMA(closes.slice(-9),  9);
  const ema21 = calcEMA(closes.slice(-21), 21);
  const rsi   = calcRSI(closes);
  const mom1m = last - closes[n - 2];
  const mom3m = last - closes[n - 4];
  const mom5m = last - closes[n - 6];

  let score = 0;
  if (last  > ema9 ) score++;
  if (ema9  > ema21) score++;
  if (mom1m > 0    ) score++;
  if (mom3m > 0    ) score++;
  if (mom5m > 0    ) score++;

  const threshold = MIN_SCORE;
  const direction =
    score >= threshold         ? 'Up'   :
    score <= (5 - threshold)   ? 'Down' : null;

  return { direction, score, last, ema9, ema21, rsi, mom1m, mom3m, mom5m };
}

// ─── DÉCOUVERTE DES MARCHÉS ────────────────────────────────────────────────
/**
 * Récupère les marchés "Bitcoin Up or Down" actifs depuis l'API Gamma.
 */
async function getActiveBTCMarkets() {
  const { data } = await axios.get(`${GAMMA_HOST}/markets`, {
    params: { active: true, closed: false, limit: 100 },
    timeout: 10000,
  });
  const list = Array.isArray(data) ? data : (data.data || []);
  return list.filter(m =>
    /bitcoin up or down/i.test(m.question || '') &&
    m.active !== false &&
    !m.closed
  );
}

// ─── CARNET D'ORDRES ───────────────────────────────────────────────────────
/**
 * Récupère le meilleur prix ask pour un token donné.
 * Retourne null si indisponible ou en dehors des limites.
 */
async function getAskPrice(tokenId) {
  try {
    const { data } = await axios.get(`${CLOB_HOST}/book`, {
      params: { token_id: tokenId },
      timeout: 6000,
    });
    const asks = data.asks || [];
    if (!asks.length) return null;
    return parseFloat(asks[0].price);
  } catch {
    return null;
  }
}

// ─── TELEGRAM ──────────────────────────────────────────────────────────────
let tg     = null;
let TG_CHAT = process.env.TELEGRAM_CHAT_ID || '';

function initTelegram() {
  if (process.env.TELEGRAM_TOKEN && TG_CHAT) {
    tg = new Telegraf(process.env.TELEGRAM_TOKEN);
    console.log('[TG] Notifications activées');
  } else {
    console.log('[TG] Token ou Chat ID manquant – notifications désactivées');
  }
}

async function notify(text) {
  const plain = text.replace(/[*_`]/g, '');
  console.log(plain);
  if (tg && TG_CHAT) {
    try {
      await tg.telegram.sendMessage(TG_CHAT, text, { parse_mode: 'Markdown' });
    } catch (e) {
      console.error('[TG] Erreur:', e.message);
    }
  }
}

// ─── CLIENT CLOB ──────────────────────────────────────────────────────────
let clob = null;

async function initClob() {
  if (!process.env.WALLET_PRIVATE_KEY) {
    throw new Error('WALLET_PRIVATE_KEY manquante dans .env');
  }

  const wallet = new ethers.Wallet(process.env.WALLET_PRIVATE_KEY);
  console.log(`[WALLET] Adresse : ${wallet.address}`);

  let creds = null;
  if (process.env.POLYMARKET_API_KEY) {
    creds = {
      key:        process.env.POLYMARKET_API_KEY,
      secret:     process.env.POLYMARKET_API_SECRET,
      passphrase: process.env.POLYMARKET_API_PASSPHRASE,
    };
    console.log('[CLOB] Credentials chargées depuis .env');
  }

  clob = new ClobClient(CLOB_HOST, CHAIN_ID, wallet, creds);

  // Dérivation automatique si pas de credentials
  if (!creds) {
    console.log('[CLOB] Dérivation des credentials API...');
    try {
      const derived = await clob.deriveApiKey();
      console.log('[CLOB] ✓ Credentials dérivées. Ajoutez dans .env :');
      console.log(`  POLYMARKET_API_KEY=${derived.key}`);
      console.log(`  POLYMARKET_API_SECRET=${derived.secret}`);
      console.log(`  POLYMARKET_API_PASSPHRASE=${derived.passphrase}`);
      creds = derived;
      clob  = new ClobClient(CLOB_HOST, CHAIN_ID, wallet, creds);
    } catch (e) {
      console.warn('[CLOB] Impossible de dériver les credentials:', e.message);
      console.warn('[CLOB] Le bot continuera sans authentification L2');
    }
  }
}

// ─── ÉTAT GLOBAL ──────────────────────────────────────────────────────────
const tradedMarkets  = new Set();  // marchés déjà tradés cette session
let   openPositions  = 0;
const stats          = { trades: 0, wins: 0, losses: 0, pnl: 0 };

// ─── CYCLE DE TRADING ─────────────────────────────────────────────────────
async function tradingCycle() {
  // 1. Signal technique
  const sig = await getSignal();
  const { direction, score, last, rsi } = sig;
  const ts = new Date().toTimeString().slice(0, 8);

  console.log(
    `[${ts}] BTC $${last.toFixed(0)} | Score ${score}/5 | RSI ${rsi.toFixed(1)} | ${direction || 'NEUTRE'}`
  );

  // Ne pas trader si signal faible ou positions max atteintes
  if (!direction || openPositions >= MAX_POSITIONS) return;

  // 2. Marchés actifs
  const markets = await getActiveBTCMarkets();
  if (!markets.length) {
    console.log('[BOT] Aucun marché BTC actif trouvé');
    return;
  }

  // 3. Trouver un marché non encore tradé
  for (const market of markets) {
    const mId = market.conditionId || market.condition_id || market.id;
    if (tradedMarkets.has(mId)) continue;

    // Trouver le token correspondant à la direction (Up ou Down)
    const tokens = market.tokens || market.clobTokenIds || [];
    const token  = tokens.find(
      t => (t.outcome || '').toLowerCase() === direction.toLowerCase()
    );
    if (!token) continue;

    const tokenId  = token.token_id || token.tokenId;
    if (!tokenId) continue;

    // 4. Prix du carnet d'ordres
    const askPrice = await getAskPrice(tokenId);
    if (!askPrice || askPrice > MAX_BUY_PRICE || askPrice < MIN_BUY_PRICE) continue;

    const size      = parseFloat((TRADE_SIZE / askPrice).toFixed(2));
    const potential = parseFloat(((1 - askPrice) * TRADE_SIZE / askPrice).toFixed(2));

    // 5. Placement de l'ordre
    try {
      const order = await clob.createOrder({
        tokenID:    tokenId,
        price:      askPrice,
        side:       'BUY',
        size,
        feeRateBps: '0',
        nonce:      '0',
        expiration: '0',
      });

      const resp = await clob.postOrder(order, 'GTC');
      if (!resp || resp.errorMsg) {
        console.error('[ORDER] Erreur réponse:', resp?.errorMsg);
        continue;
      }

      tradedMarkets.add(mId);
      openPositions++;
      stats.trades++;

      const wr = stats.trades ? ((stats.wins / stats.trades) * 100).toFixed(0) : '0';

      await notify(
        `🎯 *Trade placé*\n` +
        `📊 ${market.question}\n` +
        `📈 Direction : *${direction}*\n` +
        `💰 Prix : $${askPrice.toFixed(3)} | ${size} shares\n` +
        `💵 Mise : ~$${TRADE_SIZE} | Gain potentiel : +$${potential}\n` +
        `🧠 Score : ${score}/5 | RSI : ${rsi.toFixed(1)} | BTC : $${last.toFixed(0)}\n` +
        `📊 Session : ${stats.wins}W/${stats.losses}L (${wr}% WR) – ${stats.trades} trades`
      );
    } catch (e) {
      console.error('[ORDER]', e.message);

      if (/insufficient|solde|balance/i.test(e.message)) {
        await notify(`⚠️ *Solde insuffisant* – rechargez USDC sur Polygon`);
        return;
      }
    }

    break; // un seul trade par cycle
  }
}

// ─── VÉRIFICATION DES POSITIONS RÉSOLUES ──────────────────────────────────
/**
 * Vérifie périodiquement si des marchés tradés sont résolus
 * et met à jour les statistiques.
 */
async function checkResolved() {
  if (!tradedMarkets.size) return;
  try {
    const { data } = await axios.get(`${GAMMA_HOST}/markets`, {
      params: { closed: true, limit: 50 },
      timeout: 10000,
    });
    const list = Array.isArray(data) ? data : (data.data || []);
    for (const market of list) {
      const mId = market.conditionId || market.condition_id || market.id;
      if (!tradedMarkets.has(mId)) continue;

      // Marché résolu : on suppose une perte conservative si pas de données de P&L
      // L'utilisateur peut vérifier son portefeuille Polymarket pour les détails
      tradedMarkets.delete(mId);
      openPositions = Math.max(0, openPositions - 1);
    }
  } catch {
    // silencieux, vérification non critique
  }
}

// ─── ENTRÉE PRINCIPALE ────────────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════╗');
  console.log('║   Polymarket BTC Up/Down Bot v1.0    ║');
  console.log('╚══════════════════════════════════════╝');

  initTelegram();
  await initClob();

  await notify(
    `🤖 *Polymarket BTC Bot démarré*\n` +
    `💵 Mise : $${TRADE_SIZE} par trade\n` +
    `🎯 Score minimum : ${MIN_SCORE}/5\n` +
    `🔁 Intervalle : ${LOOP_MS / 1000}s\n` +
    `📊 Positions max : ${MAX_POSITIONS}\n` +
    `💱 Prix d'achat : $${MIN_BUY_PRICE}–$${MAX_BUY_PRICE}`
  );

  // Premier cycle immédiat
  await tradingCycle();

  // Boucle principale
  setInterval(async () => {
    try { await tradingCycle(); }
    catch (e) { console.error('[CYCLE]', e.message); }
  }, LOOP_MS);

  // Vérification des positions résolues toutes les 2 minutes
  setInterval(async () => {
    try { await checkResolved(); }
    catch { /* silencieux */ }
  }, 2 * 60 * 1000);
}

main().catch(async e => {
  console.error('[FATAL]', e);
  if (tg && TG_CHAT) {
    await tg.telegram.sendMessage(TG_CHAT, `🔴 Bot planté : ${e.message}`).catch(() => {});
  }
  process.exit(1);
});
