const { v4: uuidv4 } = require('uuid');

function generateId(prefix = '') {
  const uuid = uuidv4().split('-')[0].toUpperCase();
  return prefix ? `${prefix}-${uuid}` : uuid;
}

function generateOrderId() {
  return generateId('ORD');
}

function generateSessionToken() {
  return generateId('SES');
}

function formatPrice(price) {
  return `RM ${parseFloat(price).toFixed(2)}`;
}

function formatDate(date) {
  return new Date(date).toLocaleString('en-MY', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function isSessionExpired(createdAt, timeout = 14400000) {
  const now = Date.now();
  const sessionTime = new Date(createdAt).getTime();
  return (now - sessionTime) > timeout;
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function sanitizeText(text) {
  return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
}

module.exports = {
  generateId,
  generateOrderId,
  generateSessionToken,
  formatPrice,
  formatDate,
  isSessionExpired,
  delay,
  sanitizeText,
  safeNum
};

/**
 * Safely converts a value to a number for formatting.
 * Returns 0 if the value is undefined, null, NaN, or not a finite number.
 * @param {*} val - The value to convert
 * @returns {number}
 */
function safeNum(val) {
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
}
