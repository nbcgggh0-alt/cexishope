/**
 * Security Utilities for CexiStore Bot
 * Handles input sanitization, markdown escaping, and rate limiting.
 */

const rateLimits = new Map();

/**
 * Escapes special characters for Markdown V2/V1 to prevent injection or breakage.
 * Specifically for Telegram Markdown.
 * @param {string} text - The text to escape
 * @returns {string} - Escaped text
 */
function escapeMarkdown(text) {
    if (!text) return '';
    // Escaping characters for Telegram Markdown (mostly V1 based on existing code style, but being safe)
    // Existing code seems to use Markdown V1 (e.g. *bold*, _italic_, `code`)
    // Standard Telegram Markdown replacement would be:
    return String(text)
        .replace(/_/g, '\\_')
        .replace(/\*/g, '\\*')
        .replace(/\[/g, '\\[')
        .replace(/`/g, '\\`');
}

/**
 * Sanitizes general input to remove potentially harmful control characters.
 * @param {string} text 
 * @returns {string}
 */
function sanitizeInput(text) {
    if (typeof text !== 'string') return '';
    // Remove null bytes and other control characters that might cause issues
    return text.trim().replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

/**
 * Simple in-memory rate limiter
 * @param {number} userId - Telegram User ID
 * @param {number} limit - Max requests per window
 * @param {number} windowMs - Time window in milliseconds
 * @returns {boolean} - true if allowed, false if limited
 */
function checkRateLimit(userId, limit = 20, windowMs = 60000) {
    const now = Date.now();
    const userLimit = rateLimits.get(userId) || { count: 0, startTime: now };

    if (now - userLimit.startTime > windowMs) {
        // Reset window
        userLimit.count = 1;
        userLimit.startTime = now;
        rateLimits.set(userId, userLimit);
        return true;
    }

    userLimit.count++;

    // Clean up old entries periodically or just set the new state
    rateLimits.set(userId, userLimit);

    return userLimit.count <= limit;
}

module.exports = {
    escapeMarkdown,
    sanitizeInput,
    checkRateLimit
};
