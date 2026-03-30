'use strict';

const axios = require('axios');

const GAMMA_API = 'https://gamma-api.polymarket.com';

// On cherche les marchés dont la cote (1/prix) est proche de 1.50
const TARGET_ODDS   = 1.50;
const ODDS_WINDOW   = 0.08; // ±8% → cote entre 1.38 et 1.62
const MIN_LIQUIDITY = 1000;  // $1 000 USDC minimum de liquidité
const FETCH_LIMIT   = 300;   // Nombre de marchés récupérés par page

/**
 * Convertit un prix de probabilité en cote décimale.
 * Ex: prix = 0.67 → cote = 1.49
 */
function priceToOdds(price) {
  if (price <= 0 || price >= 1) return null;
  return 1 / price;
}

/**
 * Vérifie si le prix correspond à une cote ~1.50.
 */
function isTargetOdds(price) {
  const odds = priceToOdds(price);
  if (!odds) return false;
  return Math.abs(odds - TARGET_ODDS) / TARGET_ODDS <= ODDS_WINDOW;
}

/**
 * Score de pertinence d'un marché : favorise volume et liquidité.
 */
function scoreMarket(market) {
  const liq = parseFloat(market.liquidity || 0);
  const vol = parseFloat(market.volume   || 0);
  return vol * 0.65 + Math.sqrt(Math.max(liq, 0)) * 100 * 0.35;
}

/**
 * Récupère les marchés actifs depuis l'API Gamma de Polymarket.
 */
async function fetchActiveMarkets(offset = 0) {
  const res = await axios.get(`${GAMMA_API}/markets`, {
    params: {
      active:    true,
      closed:    false,
      limit:     FETCH_LIMIT,
      offset,
      order:     'volume',
      ascending: false,
    },
    timeout: 15000,
  });
  return Array.isArray(res.data) ? res.data : (res.data.markets || []);
}

/**
 * Parse les tokens d'un marché depuis différents formats d'API.
 * Retourne un tableau [{ token_id, outcome, price }].
 */
function parseTokens(market) {
  if (Array.isArray(market.tokens) && market.tokens.length > 0) {
    return market.tokens.map(t => ({
      token_id: t.token_id || t.tokenId,
      outcome:  t.outcome,
      price:    parseFloat(t.price),
    }));
  }

  // Fallback: reconstruire depuis outcomePrices / outcomes
  try {
    const prices   = JSON.parse(market.outcomePrices || '[]');
    const outcomes = JSON.parse(market.outcomes      || '[]');
    if (prices.length === outcomes.length && prices.length > 0) {
      return outcomes.map((outcome, i) => ({
        token_id: market.clobTokenIds ? JSON.parse(market.clobTokenIds)[i] : null,
        outcome,
        price: parseFloat(prices[i]),
      }));
    }
  } catch (_) { /* ignore */ }

  return [];
}

/**
 * Trouve le meilleur marché du jour à cote ~1.50.
 * Retourne null si aucun candidat trouvé.
 */
async function findBestMarket() {
  let markets = [];

  // On fait deux pages pour maximiser les candidats
  try {
    const page1 = await fetchActiveMarkets(0);
    markets     = markets.concat(page1);
    if (page1.length >= FETCH_LIMIT) {
      const page2 = await fetchActiveMarkets(FETCH_LIMIT);
      markets     = markets.concat(page2);
    }
  } catch (err) {
    throw new Error(`Gamma API inaccessible : ${err.message}`);
  }

  const candidates = [];

  for (const market of markets) {
    if (!market.active || market.closed) continue;
    const liq = parseFloat(market.liquidity || 0);
    if (liq < MIN_LIQUIDITY) continue;

    const tokens = parseTokens(market);
    if (tokens.length < 2) continue;

    for (const token of tokens) {
      if (!isTargetOdds(token.price)) continue;
      if (!token.token_id) continue;

      candidates.push({
        id:            market.id,
        conditionId:   market.conditionId,
        question:      market.question || market.title || 'Question inconnue',
        endDate:       market.endDate,
        liquidity:     liq,
        volume:        parseFloat(market.volume || 0),
        active:        market.active,
        closed:        market.closed,
        selectedToken: token,
        selectedOdds:  priceToOdds(token.price),
        selectedPrice: token.price,
        score:         scoreMarket(market),
      });
      break; // Un token suffit par marché
    }
  }

  if (candidates.length === 0) return null;

  // Tri par score décroissant, on prend le premier
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0];
}

/**
 * Récupère un marché individuel par son ID.
 */
async function getMarket(marketId) {
  try {
    const res = await axios.get(`${GAMMA_API}/markets/${marketId}`, {
      timeout: 10000,
    });
    return res.data;
  } catch (_) {
    return null;
  }
}

/**
 * Retourne le token_id gagnant si le marché est résolu, sinon null.
 */
function getWinnerTokenId(market) {
  if (!market || !market.closed) return null;
  const tokens = parseTokens(market);
  for (const t of tokens) {
    if (parseFloat(t.price) >= 0.99) return t.token_id;
  }
  return null;
}

module.exports = { findBestMarket, getMarket, getWinnerTokenId, priceToOdds };
