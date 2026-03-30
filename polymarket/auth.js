'use strict';

/**
 * Authentification auprès du CLOB Polymarket.
 *
 * Niveau 1 (création de clé API) :
 *   Signer un message avec le wallet → obtenir {apiKey, secret, passphrase}.
 *
 * Niveau 2 (requêtes authentifiées) :
 *   Signer chaque requête avec HMAC-SHA256 via la clé API.
 *
 * Documentation Polymarket CLOB :
 *   https://docs.polymarket.com/#authentication
 */

const axios  = require('axios');
const crypto = require('crypto');
const { ethers } = require('ethers');

const CLOB_URL = 'https://clob.polymarket.com';

/**
 * Crée ou régénère une paire de clés API Polymarket à partir d'un wallet.
 * @param {string} privateKey  Clé privée hexadécimale (avec ou sans 0x)
 * @returns {Promise<{apiKey, secret, passphrase, address}>}
 */
async function createApiKey(privateKey) {
  const wallet    = new ethers.Wallet(privateKey);
  const timestamp = Math.floor(Date.now() / 1000);
  const nonce     = 0;

  // Message signé pour l'authentification niveau 1
  const message   = `${wallet.address}\npolymarket hosted clob\n${timestamp}\n${nonce}`;
  const signature = await wallet.signMessage(message);

  const res = await axios.post(`${CLOB_URL}/auth/api-key`, null, {
    headers: {
      'POLY_ADDRESS':   wallet.address,
      'POLY_SIGNATURE': signature,
      'POLY_TIMESTAMP': String(timestamp),
      'POLY_NONCE':     String(nonce),
    },
    timeout: 15000,
  });

  return {
    ...res.data,
    address: wallet.address,
  };
}

/**
 * Génère les en-têtes HMAC-SHA256 pour une requête authentifiée (niveau 2).
 * @param {object} creds        Objet {apiKey, secret, passphrase, address}
 * @param {string} method       'GET' | 'POST' | 'DELETE'
 * @param {string} requestPath  Ex: '/order'
 * @param {string} [body='']    Corps de la requête JSON stringifié
 * @returns {object}            Headers à injecter dans la requête axios
 */
function buildAuthHeaders(creds, method, requestPath, body = '') {
  const timestamp = Math.floor(Date.now() / 1000);
  const nonce     = 0;
  const what      = `${timestamp}${method}${requestPath}${body}`;

  const hmacKey   = Buffer.from(creds.secret, 'base64');
  const signature = crypto
    .createHmac('sha256', hmacKey)
    .update(what)
    .digest('base64');

  return {
    'POLY_ADDRESS':    creds.address,
    'POLY_SIGNATURE':  signature,
    'POLY_TIMESTAMP':  String(timestamp),
    'POLY_NONCE':      String(nonce),
    'POLY_API_KEY':    creds.apiKey,
    'POLY_PASSPHRASE': creds.passphrase,
  };
}

/**
 * Récupère le solde USDC (6 décimales) d'un wallet via le CLOB.
 * Retourne le solde en USDC (float).
 */
async function getUsdcBalance(creds) {
  const path    = '/balance';
  const headers = buildAuthHeaders(creds, 'GET', path);
  const res     = await axios.get(`${CLOB_URL}${path}`, {
    headers,
    timeout: 10000,
  });
  // Le CLOB retourne généralement { asset, balance } ou { availableBalance }
  const raw = res.data.availableBalance ?? res.data.balance ?? 0;
  return parseFloat(raw) / 1e6;
}

module.exports = { createApiKey, buildAuthHeaders, getUsdcBalance };
