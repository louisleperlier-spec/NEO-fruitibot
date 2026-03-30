'use strict';

/**
 * Placement d'ordres sur le CLOB Polymarket.
 *
 * Les ordres binaires utilisent le standard EIP-712 signé par le wallet.
 * Contrat CTF Exchange (Polygon mainnet) :
 *   0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E
 *
 * Référence : https://docs.polymarket.com/#create-order
 */

const axios  = require('axios');
const { ethers } = require('ethers');
const { buildAuthHeaders } = require('./auth');

const CLOB_URL      = 'https://clob.polymarket.com';
const CTF_EXCHANGE  = '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E';
const CHAIN_ID      = 137; // Polygon mainnet
const ZERO_ADDRESS  = '0x0000000000000000000000000000000000000000';

// Domaine EIP-712 du contrat CTF Exchange
const EIP712_DOMAIN = {
  name:              'CTF Exchange',
  version:           '1',
  chainId:           CHAIN_ID,
  verifyingContract: CTF_EXCHANGE,
};

// Types EIP-712 de l'ordre
const ORDER_TYPES = {
  Order: [
    { name: 'salt',          type: 'uint256' },
    { name: 'maker',         type: 'address' },
    { name: 'signer',        type: 'address' },
    { name: 'taker',         type: 'address' },
    { name: 'tokenId',       type: 'uint256' },
    { name: 'makerAmount',   type: 'uint256' },
    { name: 'takerAmount',   type: 'uint256' },
    { name: 'expiration',    type: 'uint256' },
    { name: 'nonce',         type: 'uint256' },
    { name: 'feeRateBps',    type: 'uint256' },
    { name: 'side',          type: 'uint8'   },
    { name: 'signatureType', type: 'uint8'   },
  ],
};

// side: 0 = BUY, 1 = SELL
// signatureType: 0 = EOA (clé privée standard)

/**
 * Construit et signe un ordre d'achat (BUY) EIP-712.
 *
 * @param {ethers.Wallet} wallet       Wallet Polygon
 * @param {string}        tokenId      ID du token de résultat (ex: "123456...")
 * @param {number}        price        Prix du token (probabilité, ex: 0.67)
 * @param {number}        usdcAmount   Montant en USDC à dépenser (float, ex: 15.50)
 * @returns {Promise<object>}          Ordre signé prêt à être soumis
 */
async function buildSignedOrder(wallet, tokenId, price, usdcAmount) {
  // USDC a 6 décimales — les outcome tokens aussi sur Polymarket
  const makerAmountBig = BigInt(Math.round(usdcAmount * 1e6));
  // takerAmount = nombre de tokens reçus = usdcAmount / price
  const takerAmountBig = BigInt(Math.round((usdcAmount / price) * 1e6));

  const salt = BigInt(
    '0x' + Buffer.from(ethers.randomBytes(16)).toString('hex')
  );

  const orderData = {
    salt:          salt,
    maker:         wallet.address,
    signer:        wallet.address,
    taker:         ZERO_ADDRESS,
    tokenId:       BigInt(tokenId),
    makerAmount:   makerAmountBig,
    takerAmount:   takerAmountBig,
    expiration:    BigInt(0), // pas d'expiration
    nonce:         BigInt(0),
    feeRateBps:    BigInt(0),
    side:          0, // BUY
    signatureType: 0, // EOA
  };

  const signature = await wallet.signTypedData(EIP712_DOMAIN, ORDER_TYPES, orderData);

  // Sérialisation JSON : BigInt → string
  return {
    salt:          salt.toString(),
    maker:         wallet.address,
    signer:        wallet.address,
    taker:         ZERO_ADDRESS,
    tokenId:       tokenId.toString(),
    makerAmount:   makerAmountBig.toString(),
    takerAmount:   takerAmountBig.toString(),
    expiration:    '0',
    nonce:         '0',
    feeRateBps:    '0',
    side:          0,
    signatureType: 0,
    signature,
  };
}

/**
 * Soumet un ordre au CLOB Polymarket.
 *
 * @param {ethers.Wallet} wallet      Wallet Polygon
 * @param {object}        creds       Credentials API {apiKey, secret, passphrase, address}
 * @param {string}        tokenId     ID du token de résultat
 * @param {number}        price       Prix du token (probabilité)
 * @param {number}        usdcAmount  Montant USDC à miser
 * @param {string}        [orderType] 'GTC' (Good Till Cancelled) | 'GTD' | 'FOK'
 * @returns {Promise<object>}         Réponse du CLOB {orderID, status, ...}
 */
async function placeOrder(wallet, creds, tokenId, price, usdcAmount, orderType = 'GTC') {
  const signedOrder = await buildSignedOrder(wallet, tokenId, price, usdcAmount);

  const bodyObj = {
    order:     signedOrder,
    owner:     wallet.address,
    orderType,
  };
  const body = JSON.stringify(bodyObj);

  const headers = buildAuthHeaders(creds, 'POST', '/order', body);

  const res = await axios.post(`${CLOB_URL}/order`, body, {
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    timeout: 20000,
  });

  return res.data; // { orderID, status, transactTime, ... }
}

/**
 * Annule un ordre en attente par son ID.
 */
async function cancelOrder(creds, orderId) {
  const path = `/order/${orderId}`;
  const headers = buildAuthHeaders(creds, 'DELETE', path);

  const res = await axios.delete(`${CLOB_URL}${path}`, {
    headers,
    timeout: 10000,
  });
  return res.data;
}

/**
 * Récupère le statut d'un ordre.
 */
async function getOrder(creds, orderId) {
  const path = `/order/${orderId}`;
  const headers = buildAuthHeaders(creds, 'GET', path);

  const res = await axios.get(`${CLOB_URL}${path}`, {
    headers,
    timeout: 10000,
  });
  return res.data;
}

module.exports = { placeOrder, cancelOrder, getOrder, buildSignedOrder };
