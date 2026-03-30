'use strict';

/**
 * Gestion de la mise — trois stratégies disponibles :
 *
 *  FLAT     : Mise fixe en USDC (ex : $10 par pari)
 *  PERCENT  : Pourcentage fixe de la bankroll courante (ex : 5%)
 *  KELLY    : Critère de Kelly fractionné (prudent, recommandé)
 *
 * Critère de Kelly :
 *   f* = (p * b - (1 - p)) / b
 *   où  p = probabilité implicite (1 / cote)
 *       b = gain net pour 1 unité misée (cote - 1)
 *
 * On utilise un "Kelly fractionné" (fraction < 1) pour réduire la volatilité.
 * Une fraction de 1/4 (0.25) est classiquement recommandée.
 */

const STRATEGIES = {
  FLAT:    'flat',
  PERCENT: 'percent',
  KELLY:   'kelly',
};

class StakeManager {
  /**
   * @param {string} strategy  'flat' | 'percent' | 'kelly'
   * @param {object} params
   * @param {number} [params.amount=10]       Mise fixe (flat)
   * @param {number} [params.percent=5]       % de bankroll (percent)
   * @param {number} [params.fraction=0.25]   Fraction Kelly (kelly)
   * @param {number} [params.maxPercent=0.15] Plafond : % max de la bankroll
   * @param {number} [params.minStake=1]      Mise minimale en USDC
   */
  constructor(strategy = STRATEGIES.FLAT, params = {}) {
    this.strategy = strategy;
    this.params   = {
      amount:     params.amount     ?? 10,
      percent:    params.percent    ?? 5,
      fraction:   params.fraction   ?? 0.25,
      maxPercent: params.maxPercent ?? 0.15,
      minStake:   params.minStake   ?? 1,
    };
  }

  /**
   * Calcule la mise pour un pari donné.
   *
   * @param {number} bankroll  Bankroll courante en USDC
   * @param {number} odds      Cote décimale (ex: 1.50)
   * @returns {number}         Mise en USDC, arrondie à 2 décimales
   */
  calculateStake(bankroll, odds) {
    if (bankroll <= 0) return 0;

    let stake;

    switch (this.strategy) {
      case STRATEGIES.FLAT: {
        stake = this.params.amount;
        break;
      }

      case STRATEGIES.PERCENT: {
        stake = bankroll * (this.params.percent / 100);
        break;
      }

      case STRATEGIES.KELLY: {
        const p = 1 / odds;          // probabilité implicite
        const b = odds - 1;          // gain net par unité
        const kelly = (p * b - (1 - p)) / b;

        if (kelly <= 0) {
          // Le Kelly négatif signifie : ne pas miser
          return 0;
        }

        stake = bankroll * kelly * this.params.fraction;
        break;
      }

      default:
        stake = this.params.amount;
    }

    // Plafond : jamais plus de maxPercent de la bankroll
    const cap = bankroll * this.params.maxPercent;
    stake = Math.min(stake, cap, bankroll);

    // Plancher
    if (stake < this.params.minStake) return 0;

    return Math.round(stake * 100) / 100;
  }

  /**
   * Description lisible de la stratégie en cours.
   */
  getDescription() {
    switch (this.strategy) {
      case STRATEGIES.FLAT:
        return `Mise fixe $${this.params.amount} USDC`;
      case STRATEGIES.PERCENT:
        return `${this.params.percent}% de la bankroll`;
      case STRATEGIES.KELLY: {
        const frac = Math.round(1 / this.params.fraction);
        return `Kelly 1/${frac} (plafond ${Math.round(this.params.maxPercent * 100)}%)`;
      }
      default:
        return 'Inconnue';
    }
  }

  /**
   * Simule les 30 prochains jours avec une suite de résultats donnée.
   * Utile pour afficher des projections.
   *
   * @param {number}   initialBankroll
   * @param {number}   odds
   * @param {number}   winRate          Taux de victoire estimé (0 à 1)
   * @param {number}   days
   * @returns {object} { finalBankroll, totalStaked, pnl, pnlPercent }
   */
  simulate(initialBankroll, odds, winRate = 0.67, days = 30) {
    let bankroll = initialBankroll;
    let totalStaked = 0;
    let totalPayout = 0;

    for (let i = 0; i < days; i++) {
      const stake = this.calculateStake(bankroll, odds);
      if (stake === 0) break;

      totalStaked  += stake;
      bankroll     -= stake;

      // Victoire simulée selon le winRate
      if (Math.random() < winRate) {
        const payout = stake * odds;
        totalPayout  += payout;
        bankroll     += payout;
      }
    }

    const pnl = totalPayout - totalStaked;
    return {
      finalBankroll: bankroll,
      totalStaked:   Math.round(totalStaked  * 100) / 100,
      pnl:           Math.round(pnl          * 100) / 100,
      pnlPercent:    Math.round((pnl / initialBankroll) * 10000) / 100,
    };
  }
}

module.exports = { StakeManager, STRATEGIES };
