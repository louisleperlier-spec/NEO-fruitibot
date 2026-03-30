'use strict';

/**
 * Gestion de la campagne 30 jours.
 *
 * L'état est persisté dans data/campaign.json pour survivre aux redémarrages.
 *
 * Structure d'un pari :
 * {
 *   day:       1..30,
 *   date:      ISO string,
 *   marketId:  string,
 *   question:  string,
 *   tokenId:   string,
 *   outcome:   string (ex: "Yes"),
 *   orderId:   string,
 *   odds:      number,
 *   stake:     number (USDC),
 *   result:    null | 'win' | 'loss' | 'cancelled',
 *   payout:    number (USDC),
 * }
 */

const fs   = require('fs');
const path = require('path');

const DATA_DIR  = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'campaign.json');

class Campaign {
  constructor() {
    this.state = this._load();
  }

  // ── Persistance ──────────────────────────────────────────────────────────

  _load() {
    try {
      if (fs.existsSync(DATA_FILE)) {
        return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      }
    } catch (_) { /* fichier absent ou corrompu */ }
    return null;
  }

  _save() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(this.state, null, 2), 'utf8');
  }

  // ── Cycle de vie ─────────────────────────────────────────────────────────

  /**
   * Démarre une nouvelle campagne (écrase l'ancienne si terminée).
   * @param {number}   initialBankroll  Bankroll de départ en USDC
   * @param {object}   settings         Paramètres de stratégie
   * @param {number[]} chatIds          Liste des chat IDs Telegram à notifier
   * @returns {object} État initial
   */
  start(initialBankroll, settings, chatIds = []) {
    this.state = {
      version:          2,
      startDate:        new Date().toISOString(),
      initialBankroll,
      currentBankroll:  initialBankroll,
      totalDays:        30,
      currentDay:       0,
      bets:             [],
      settings,
      notifyChats:      [...new Set(chatIds)],
      active:           true,
    };
    this._save();
    return this.state;
  }

  isActive() {
    return !!(this.state && this.state.active);
  }

  isComplete() {
    return !!(this.state && this.state.currentDay >= this.state.totalDays);
  }

  // ── Gestion des chats ────────────────────────────────────────────────────

  addChat(chatId) {
    if (!this.state) return;
    if (!this.state.notifyChats.includes(chatId)) {
      this.state.notifyChats.push(chatId);
      this._save();
    }
  }

  removeChat(chatId) {
    if (!this.state) return;
    this.state.notifyChats = this.state.notifyChats.filter(id => id !== chatId);
    this._save();
  }

  // ── Enregistrement des paris ─────────────────────────────────────────────

  /**
   * Enregistre un nouveau pari et déduit la mise de la bankroll.
   * Incrémente automatiquement le jour.
   */
  recordBet({ marketId, question, tokenId, outcome, orderId, odds, stake }) {
    const bet = {
      day:      this.state.currentDay + 1,
      date:     new Date().toISOString(),
      marketId,
      question,
      tokenId,
      outcome,
      orderId,
      odds,
      stake,
      result:   null,
      payout:   0,
    };

    this.state.bets.push(bet);
    this.state.currentBankroll -= stake;
    this.state.currentDay      += 1;
    this._save();

    return bet;
  }

  /**
   * Met à jour le résultat d'un pari une fois le marché résolu.
   * @param {string}  orderId  ID de l'ordre CLOB
   * @param {boolean} won      true = victoire
   * @param {number}  payout   Montant récupéré (stake × cote si won)
   */
  updateBetResult(orderId, won, payout) {
    const bet = this.state.bets.find(b => b.orderId === orderId);
    if (!bet || bet.result !== null) return null;

    bet.result = won ? 'win' : 'loss';
    bet.payout = won ? payout : 0;

    if (won) {
      this.state.currentBankroll += payout;
    }

    // Ferme la campagne si elle est terminée ET tous les paris sont résolus
    if (this.isComplete() && this.state.bets.every(b => b.result !== null)) {
      this.state.active = false;
    }

    this._save();
    return bet;
  }

  // ── Statistiques ─────────────────────────────────────────────────────────

  getStats() {
    if (!this.state) return null;

    const bets      = this.state.bets;
    const resolved  = bets.filter(b => b.result !== null && b.result !== 'cancelled');
    const pending   = bets.filter(b => b.result === null);
    const wins      = resolved.filter(b => b.result === 'win');
    const losses    = resolved.filter(b => b.result === 'loss');

    const totalStaked  = resolved.reduce((s, b) => s + b.stake,  0);
    const totalPayout  = resolved.reduce((s, b) => s + b.payout, 0);
    const pnl          = totalPayout - totalStaked;
    const pnlPercent   = this.state.initialBankroll > 0
      ? (pnl / this.state.initialBankroll) * 100
      : 0;
    const winRate      = resolved.length > 0 ? wins.length / resolved.length : 0;
    const avgOdds      = resolved.length > 0
      ? resolved.reduce((s, b) => s + b.odds, 0) / resolved.length
      : 0;

    return {
      day:              this.state.currentDay,
      totalDays:        this.state.totalDays,
      initialBankroll:  this.state.initialBankroll,
      currentBankroll:  this.state.currentBankroll,
      pnl:              Math.round(pnl        * 100) / 100,
      pnlPercent:       Math.round(pnlPercent * 100) / 100,
      wins:             wins.length,
      losses:           losses.length,
      pending:          pending.length,
      winRate:          Math.round(winRate * 1000) / 1000,
      avgOdds:          Math.round(avgOdds * 100)  / 100,
      totalBets:        bets.length,
      totalStaked:      Math.round(totalStaked * 100) / 100,
      roi:              totalStaked > 0
        ? Math.round((pnl / totalStaked) * 10000) / 100
        : 0,
    };
  }

  /**
   * Retourne les N derniers paris pour l'historique.
   */
  getRecentBets(n = 10) {
    if (!this.state) return [];
    return [...this.state.bets].slice(-n).reverse();
  }

  /**
   * Retourne les paris dont le résultat est encore null (en attente).
   */
  getPendingBets() {
    if (!this.state) return [];
    return this.state.bets.filter(b => b.result === null);
  }
}

module.exports = Campaign;
