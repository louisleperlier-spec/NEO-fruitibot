'use strict';

require('dotenv').config();

const { Telegraf, Markup } = require('telegraf');
const cron                  = require('node-cron');
const { ethers }            = require('ethers');

const scanner               = require('./polymarket/scanner');
const trader                = require('./polymarket/trader');
const auth                  = require('./polymarket/auth');
const { StakeManager, STRATEGIES } = require('./stake-manager');
const Campaign              = require('./campaign');

// ── Initialisation ──────────────────────────────────────────────────────────

const bot      = new Telegraf(process.env.TELEGRAM_TOKEN);
const campaign = new Campaign();

let wallet   = null; // ethers.Wallet
let apiCreds = null; // { apiKey, secret, passphrase, address }

const isDryRun = () =>
  process.env.DRY_RUN === 'true' || !wallet || !apiCreds;

function buildStakeManager() {
  const strategy = (process.env.STAKE_STRATEGY || STRATEGIES.FLAT).toLowerCase();
  return new StakeManager(strategy, {
    amount:     parseFloat(process.env.STAKE_AMOUNT     || 10),
    percent:    parseFloat(process.env.STAKE_PERCENT    || 5),
    fraction:   parseFloat(process.env.KELLY_FRACTION   || 0.25),
    maxPercent: parseFloat(process.env.MAX_STAKE_PCT    || 0.15),
    minStake:   parseFloat(process.env.MIN_STAKE        || 1),
  });
}

async function initWallet() {
  const pk = process.env.WALLET_PRIVATE_KEY;
  if (!pk) {
    console.warn('⚠️  WALLET_PRIVATE_KEY absent — mode simulation activé');
    return;
  }
  try {
    wallet = new ethers.Wallet(pk);
    console.log(`👛 Wallet : ${wallet.address}`);

    if (process.env.DRY_RUN !== 'true') {
      apiCreds = await auth.createApiKey(pk);
      console.log('✅ Clé API Polymarket créée');
    }
  } catch (err) {
    console.error('❌ Initialisation wallet échouée :', err.message);
  }
}

// ── Utilitaires Telegram ───────────────────────────────────────────────────

async function notify(message, options = {}) {
  if (!campaign.isActive()) return;
  const chats = campaign.state.notifyChats || [];
  for (const chatId of chats) {
    try {
      await bot.telegram.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        ...options,
      });
    } catch (err) {
      console.error(`Notification ${chatId} échouée :`, err.message);
    }
  }
}

function formatDate(iso) {
  if (!iso) return 'N/A';
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function formatMoney(n) {
  return `$${(+n || 0).toFixed(2)}`;
}

function pnlLine(pnl, pct) {
  const sign = pnl >= 0 ? '+' : '';
  return `${pnl >= 0 ? '📈' : '📉'} P&L : *${sign}${formatMoney(pnl)}* (${sign}${pct.toFixed(2)}%)`;
}

// ── Logique principale : pick quotidien ───────────────────────────────────

async function runDailyPick(forceChatId = null) {
  const send = async (msg, opts = {}) => {
    await notify(msg, opts);
    if (forceChatId && !(campaign.state?.notifyChats || []).includes(forceChatId)) {
      await bot.telegram.sendMessage(forceChatId, msg, { parse_mode: 'Markdown', ...opts });
    }
  };

  if (!campaign.isActive()) {
    if (forceChatId)
      await bot.telegram.sendMessage(
        forceChatId,
        '❌ Aucune campagne active. Lance-en une avec /nouvelle_campagne.'
      );
    return;
  }

  if (campaign.isComplete()) {
    campaign.state.active = false;
    campaign._save();
    const stats = campaign.getStats();
    await send(buildFinalReport(stats));
    return;
  }

  const state        = campaign.state;
  const stakeManager = buildStakeManager();
  const bankroll     = state.currentBankroll;
  const day          = state.currentDay + 1;

  await send(`🔍 *Jour ${day}/30* — Scan de Polymarket en cours…`);

  let market;
  try {
    market = await scanner.findBestMarket();
  } catch (err) {
    await send(`❌ Erreur scanner : ${err.message}`);
    return;
  }

  if (!market) {
    await send(
      `⚠️ *Jour ${day}/30* — Aucun marché à cote ~1.50 trouvé aujourd'hui.\n` +
      `Nouvelle tentative demain à 09:00 UTC.`
    );
    return;
  }

  const stake = stakeManager.calculateStake(bankroll, market.selectedOdds);

  if (stake === 0) {
    await send(`⚠️ Mise calculée nulle (bankroll : ${formatMoney(bankroll)}). Pari ignoré.`);
    return;
  }

  // Placement de l'ordre
  let orderId;
  const dry = isDryRun();

  if (!dry) {
    try {
      const result = await trader.placeOrder(
        wallet,
        apiCreds,
        market.selectedToken.token_id,
        market.selectedPrice,
        stake
      );
      orderId = result.orderID || result.id || `order_${Date.now()}`;
    } catch (err) {
      await send(`❌ Ordre rejeté par Polymarket : ${err.message}`);
      return;
    }
  } else {
    orderId = `sim_${Date.now()}`;
  }

  // Enregistrement
  campaign.recordBet({
    marketId: market.id,
    question: market.question,
    tokenId:  market.selectedToken.token_id,
    outcome:  market.selectedToken.outcome,
    orderId,
    odds:     market.selectedOdds,
    stake,
  });

  const modeTag = dry
    ? '\n\n_🔵 Simulation — aucun achat réel_'
    : `\n\n✅ Ordre CLOB : \`${orderId}\``;

  await send(buildPickMessage(market, stake, day, bankroll) + modeTag);
}

function buildPickMessage(market, stake, day, bankroll) {
  const odds     = market.selectedOdds.toFixed(2);
  const probPct  = (market.selectedPrice * 100).toFixed(1);
  const liq      = Math.round(market.liquidity);
  const vol      = Math.round(market.volume);
  const end      = formatDate(market.endDate);
  const outcome  = market.selectedToken.outcome;
  const stakeManager = buildStakeManager();

  return (
    `🎯 *PICK DU JOUR — Jour ${day}/30*\n\n` +
    `📋 *${market.question}*\n\n` +
    `✅ Choix : *${outcome}*\n` +
    `📊 Cote : *${odds}* (prob. ${probPct}%)\n` +
    `💰 Mise : *${formatMoney(stake)}* USDC\n` +
    `💵 Bankroll : ${formatMoney(bankroll)}\n` +
    `📅 Résolution : ${end}\n` +
    `💧 Liquidité : $${liq.toLocaleString('fr-FR')}\n` +
    `📈 Volume : $${vol.toLocaleString('fr-FR')}\n` +
    `🧮 Stratégie : ${stakeManager.getDescription()}`
  );
}

function buildFinalReport(stats) {
  return (
    `🏁 *Campagne terminée — Rapport final*\n\n` +
    `📅 Durée : 30 jours\n` +
    `💰 Bankroll initiale : ${formatMoney(stats.initialBankroll)}\n` +
    `💵 Bankroll finale : ${formatMoney(stats.currentBankroll)}\n` +
    pnlLine(stats.pnl, stats.pnlPercent) + '\n' +
    `📊 ROI net : ${stats.roi >= 0 ? '+' : ''}${stats.roi}%\n\n` +
    `🏆 Victoires : ${stats.wins}/${stats.totalBets} (${(stats.winRate * 100).toFixed(1)}%)\n` +
    `❌ Défaites : ${stats.losses}\n` +
    `📊 Cote moyenne : ${stats.avgOdds.toFixed(2)}`
  );
}

// ── Vérification des marchés résolus (cron 2h) ───────────────────────────

async function checkResolvedBets() {
  if (!campaign.isActive()) return;
  const pending = campaign.getPendingBets();
  if (pending.length === 0) return;

  for (const bet of pending) {
    try {
      const market = await scanner.getMarket(bet.marketId);
      if (!market || !market.closed) continue;

      const winnerTokenId = scanner.getWinnerTokenId(market);
      const won           = winnerTokenId === bet.tokenId;
      const payout        = won ? bet.stake * bet.odds : 0;

      const updated = campaign.updateBetResult(bet.orderId, won, payout);
      if (!updated) continue;

      const emoji = won ? '✅' : '❌';
      const title = won
        ? `Paris gagnant !`
        : `Paris perdu`;
      const detail = won
        ? `Gain : *+${formatMoney(payout - bet.stake)}*`
        : `Perte : *-${formatMoney(bet.stake)}*`;

      await notify(
        `${emoji} *${title}*\n` +
        `Jour ${bet.day} — ${bet.question}\n` +
        `Cote ${bet.odds.toFixed(2)} · Mise ${formatMoney(bet.stake)}\n` +
        detail
      );
    } catch (err) {
      console.error(`Vérification pari ${bet.orderId} :`, err.message);
    }
  }
}

// ── Commandes Telegram ────────────────────────────────────────────────────

bot.command('start', async (ctx) => {
  if (campaign.isActive()) campaign.addChat(ctx.chat.id);

  await ctx.reply(
    `🎯 *Polymarket Bot — Stratégie Cote 1.50*\n\n` +
    `Ce bot scanne Polymarket chaque matin, sélectionne un marché à cote *~1.50* et place automatiquement la mise selon ta stratégie.\n\n` +
    `*Durée :* 30 jours, 1 pari par jour\n\n` +

    `*📋 Commandes :*\n` +
    `/nouvelle_campagne \\[bankroll\\] — Démarrer\n` +
    `/status — État de la campagne\n` +
    `/historique — 10 derniers paris\n` +
    `/bankroll — Solde actuel\n` +
    `/pick_maintenant — Forcer un pick\n` +
    `/parametres — Configuration\n` +
    `/simulation — Projection 30j\n` +
    `/stop — Arrêter la campagne\n\n` +

    `*⚙️ Variables .env requises :*\n` +
    `\`TELEGRAM_TOKEN\` — Token Telegram\n` +
    `\`WALLET_PRIVATE_KEY\` — Clé privée Polygon\n` +
    `\`INITIAL_BANKROLL\` — Bankroll USDC\n` +
    `\`STAKE_STRATEGY\` — flat | percent | kelly\n` +
    `\`STAKE_AMOUNT\` — Mise fixe (flat)\n` +
    `\`STAKE_PERCENT\` — % bankroll (percent)\n` +
    `\`KELLY_FRACTION\` — Fraction Kelly (défaut 0.25)\n` +
    `\`DRY_RUN=true\` — Simulation sans achat réel`,
    { parse_mode: 'Markdown' }
  );
});

bot.command('nouvelle_campagne', async (ctx) => {
  if (campaign.isActive() && !campaign.isComplete()) {
    return ctx.reply(
      `⚠️ Campagne déjà en cours (Jour ${campaign.state.currentDay}/30).\n` +
      `Utilise /stop pour l'arrêter avant d'en démarrer une nouvelle.`
    );
  }

  const args     = ctx.message.text.split(/\s+/).slice(1);
  const bankroll = parseFloat(args[0]) || parseFloat(process.env.INITIAL_BANKROLL) || 100;

  if (bankroll <= 0) return ctx.reply('❌ La bankroll doit être supérieure à $0.');

  const sm       = buildStakeManager();
  const settings = {
    strategy:     process.env.STAKE_STRATEGY   || STRATEGIES.FLAT,
    stakeAmount:  parseFloat(process.env.STAKE_AMOUNT  || 10),
    stakePercent: parseFloat(process.env.STAKE_PERCENT || 5),
    dryRun:       isDryRun(),
  };

  campaign.start(bankroll, settings, [ctx.chat.id]);

  await ctx.reply(
    `✅ *Campagne démarrée !*\n\n` +
    `💰 Bankroll : *${formatMoney(bankroll)}* USDC\n` +
    `📅 Durée : 30 jours\n` +
    `🎯 Cible : Cote ~1.50 (±8%)\n` +
    `🧮 Stratégie : ${sm.getDescription()}\n` +
    `⏰ Pick quotidien : 09:00 UTC\n` +
    `${isDryRun() ? '🔵 Mode : *SIMULATION*' : '🟢 Mode : *LIVE* (achats réels)'}\n\n` +
    `Utilise /pick_maintenant pour déclencher le premier pick immédiatement.`,
    { parse_mode: 'Markdown' }
  );
});

bot.command('status', async (ctx) => {
  if (!campaign.isActive()) {
    return ctx.reply(
      '❌ Aucune campagne active.\n\nUtilise /nouvelle_campagne pour en démarrer une.'
    );
  }

  const stats = campaign.getStats();
  const barre = buildProgressBar(stats.day, stats.totalDays);

  await ctx.reply(
    `📊 *Statut de la campagne*\n\n` +
    `${barre}\n` +
    `📅 Progression : Jour *${stats.day}/${stats.totalDays}*\n\n` +
    `💰 Bankroll initiale : ${formatMoney(stats.initialBankroll)}\n` +
    `💵 Bankroll actuelle : *${formatMoney(stats.currentBankroll)}*\n` +
    pnlLine(stats.pnl, stats.pnlPercent) + '\n' +
    `📊 ROI net : ${stats.roi >= 0 ? '+' : ''}${stats.roi}%\n\n` +
    `🏆 Victoires : ${stats.wins}\n` +
    `❌ Défaites : ${stats.losses}\n` +
    `⏳ En attente : ${stats.pending}\n` +
    `📈 Win rate : ${(stats.winRate * 100).toFixed(1)}%\n` +
    `📊 Cote moy. : ${stats.avgOdds.toFixed(2)}`,
    { parse_mode: 'Markdown' }
  );
});

bot.command('historique', async (ctx) => {
  if (!campaign.isActive()) return ctx.reply('❌ Aucune campagne active.');

  const bets = campaign.getRecentBets(10);
  if (bets.length === 0) return ctx.reply('📭 Aucun pari enregistré pour l\'instant.');

  const lines = bets.map(b => {
    const emoji   = b.result === 'win' ? '✅' : b.result === 'loss' ? '❌' : '⏳';
    const q       = b.question.length > 35
      ? b.question.substring(0, 35) + '…'
      : b.question;
    const pnlStr  = b.result === 'win'
      ? `+${formatMoney(b.payout - b.stake)}`
      : b.result === 'loss'
      ? `-${formatMoney(b.stake)}`
      : '…';
    return `${emoji} J${b.day} | ${b.odds.toFixed(2)} | ${formatMoney(b.stake)} | ${pnlStr}\n   _${q}_`;
  });

  await ctx.reply(
    `📋 *10 derniers paris :*\n\n${lines.join('\n\n')}`,
    { parse_mode: 'Markdown' }
  );
});

bot.command('bankroll', async (ctx) => {
  if (!campaign.isActive()) return ctx.reply('❌ Aucune campagne active.');

  const stats = campaign.getStats();
  const bar   = buildProgressBar(stats.day, stats.totalDays);

  await ctx.reply(
    `💰 *Bankroll*\n\n` +
    `Initiale : ${formatMoney(stats.initialBankroll)}\n` +
    `Actuelle : *${formatMoney(stats.currentBankroll)}*\n` +
    pnlLine(stats.pnl, stats.pnlPercent) + '\n\n' +
    `${bar}\n` +
    `Jour ${stats.day}/${stats.totalDays}`,
    { parse_mode: 'Markdown' }
  );
});

bot.command('pick_maintenant', async (ctx) => {
  const msg = await ctx.reply('🔍 Lancement du pick manuel…');
  await runDailyPick(ctx.chat.id);
  await ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id).catch(() => {});
});

bot.command('parametres', async (ctx) => {
  const sm = buildStakeManager();

  await ctx.reply(
    `⚙️ *Paramètres*\n\n` +
    `🎯 Cible cote : 1.50 (±8%)\n` +
    `🧮 Stratégie : ${sm.getDescription()}\n` +
    `⏰ Pick quotidien : 09:00 UTC\n` +
    `🔄 Vérif. résultats : toutes les 2h\n` +
    `💧 Liquidité min. : $1 000\n` +
    `${isDryRun() ? '🔵 Mode : SIMULATION' : '🟢 Mode : LIVE'}\n` +
    `${wallet ? `👛 Wallet : \`${wallet.address.slice(0, 8)}…${wallet.address.slice(-6)}\`` : '❌ Aucun wallet'}`,
    { parse_mode: 'Markdown' }
  );
});

bot.command('simulation', async (ctx) => {
  const sm       = buildStakeManager();
  const bankroll = campaign.isActive()
    ? campaign.state.currentBankroll
    : parseFloat(process.env.INITIAL_BANKROLL) || 100;

  // Monte-Carlo : 1 000 simulations de 30 jours
  const N       = 1000;
  const results = [];
  for (let i = 0; i < N; i++) {
    results.push(sm.simulate(bankroll, 1.50, 0.67, 30).pnl);
  }
  results.sort((a, b) => a - b);

  const avg    = results.reduce((s, v) => s + v, 0) / N;
  const p10    = results[Math.floor(N * 0.10)];
  const p50    = results[Math.floor(N * 0.50)];
  const p90    = results[Math.floor(N * 0.90)];
  const winPct = (results.filter(v => v > 0).length / N * 100).toFixed(1);

  await ctx.reply(
    `🧮 *Simulation Monte-Carlo — 30 jours*\n` +
    `_(${N} simulations, cote 1.50, winrate 67%)_\n\n` +
    `💰 Bankroll de départ : ${formatMoney(bankroll)}\n` +
    `🧮 Stratégie : ${sm.getDescription()}\n\n` +
    `📊 P&L moyen : *${avg >= 0 ? '+' : ''}${formatMoney(avg)}*\n` +
    `📉 Pire 10% : ${formatMoney(p10)}\n` +
    `🎯 Médiane : ${formatMoney(p50)}\n` +
    `📈 Meilleur 10% : ${formatMoney(p90)}\n` +
    `✅ % de campagnes rentables : *${winPct}%*`,
    { parse_mode: 'Markdown' }
  );
});

bot.command('stop', async (ctx) => {
  if (!campaign.isActive()) return ctx.reply('❌ Aucune campagne active.');

  campaign.state.active = false;
  campaign._save();

  const stats = campaign.getStats();
  await ctx.reply(
    `🛑 *Campagne arrêtée*\n\n` +
    `Jour atteint : ${stats.day}/30\n` +
    pnlLine(stats.pnl, stats.pnlPercent),
    { parse_mode: 'Markdown' }
  );
});

// ── Barre de progression ──────────────────────────────────────────────────

function buildProgressBar(current, total, length = 20) {
  const filled = Math.round((current / total) * length);
  const empty  = length - filled;
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${current}/${total}`;
}

// ── Cron jobs ─────────────────────────────────────────────────────────────

// Pick quotidien à 09:00 UTC
cron.schedule('0 9 * * *', async () => {
  console.log('⏰ Cron : pick quotidien déclenché');
  await runDailyPick();
}, { timezone: 'UTC' });

// Vérification des résultats toutes les 2h
cron.schedule('0 */2 * * *', async () => {
  console.log('🔄 Cron : vérification des résultats');
  await checkResolvedBets();
}, { timezone: 'UTC' });

// Rappel de statut quotidien à 20:00 UTC
cron.schedule('0 20 * * *', async () => {
  if (!campaign.isActive()) return;
  const stats = campaign.getStats();
  await notify(
    `📊 *Résumé du soir — Jour ${stats.day}/30*\n\n` +
    `💵 Bankroll : *${formatMoney(stats.currentBankroll)}*\n` +
    pnlLine(stats.pnl, stats.pnlPercent) + '\n' +
    `🏆 ${stats.wins}W / ${stats.losses}L · WR ${(stats.winRate * 100).toFixed(1)}%`
  );
}, { timezone: 'UTC' });

// ── Démarrage ─────────────────────────────────────────────────────────────

async function main() {
  console.log('🎯 Polymarket Bot démarrage…');

  await initWallet();

  await bot.launch();
  console.log('✅ Bot Telegram actif !');

  if (campaign.isActive()) {
    console.log(`📊 Campagne en cours : Jour ${campaign.state.currentDay}/30`);
    console.log(`💵 Bankroll : $${campaign.state.currentBankroll}`);
  } else {
    console.log('ℹ️  Aucune campagne active. Envoie /nouvelle_campagne dans Telegram.');
  }
}

main().catch(err => {
  console.error('💥 Démarrage échoué :', err);
  process.exit(1);
});

process.once('SIGINT',  () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
