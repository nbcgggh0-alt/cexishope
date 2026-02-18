/**
 * Smart Text Parser for Stock Items
 * 
 * Intelligently formats messy input text into clean, structured data.
 * Useful for converting copy-paste credentials into readable format.
 * 
 * Example Input: "user: ali123 pass: password123 domain: panel.com"
 * Example Output:
 * User: ali123
 * Pass: password123
 * Domain: panel.com
 */

/**
 * Formats a single item string into a clean multi-line string
 * @param {string} text - The raw input text
 * @returns {string} - The formatted text
 */
function smartFormatItem(text) {
    if (!text) return '';

    // 1. Remove surrounding whitespace
    let cleanText = text.trim();

    // 2. Check if already multi-line (if so, return as is, assuming user formatted it)
    if (cleanText.includes('\n')) {
        return cleanText;
    }

    // 3. Define known keys to look for (case-insensitive)
    const knownKeys = [
        'User', 'Username', 'Email', 'Login', 'ID',
        'Pass', 'Password', 'Pwd', 'Code', 'Key',
        'Domain', 'Host', 'IP', 'Link', 'URL', 'Credit', 'Balance',
        'Pin', 'Serial', 'Token', 'Cookie', 'Session'
    ];

    // 4. Try to split by common separators first (|, ;, -)
    // If separators exist, split and format vertically
    if (cleanText.includes('|')) {
        return formatSplit(cleanText, '|');
    }
    if (cleanText.includes(';')) {
        return formatSplit(cleanText, ';');
    }
    // Only split by comma if it looks like key-value pairs
    if (cleanText.includes(',') && cleanText.includes(':')) {
        return formatSplit(cleanText, ',');
    }

    // 5. Heuristic: Split by known keys
    // "User: ali Pass: 123" -> "User: ali\nPass: 123"
    let formatted = cleanText;

    // Sort keys by length desc to match longest first (e.g. "Username" before "User")
    const sortedKeys = [...knownKeys].sort((a, b) => b.length - a.length);

    // Create a regex to find keys that are NOT at the start of string
    // Look for: space + key + colon/space
    // We replace " key:" with "\nKey:"
    sortedKeys.forEach(key => {
        const regex = new RegExp(`\\s+(${key}[:\\s])`, 'gi');
        formatted = formatted.replace(regex, '\n$1');
    });

    // 6. Final cleanup: Ensure proper capitalization for keys
    // "user: ali" -> "User: ali"
    sortedKeys.forEach(key => {
        const regex = new RegExp(`(^|\\n)(${key})([:\\s])`, 'gi');
        formatted = formatted.replace(regex, (match, p1, p2, p3) => {
            return `${p1}${capitalize(p2)}${p3}`;
        });
    });

    return formatted.trim();
}

/**
 * Helper to split by separator and trim each part
 */
function formatSplit(text, separator) {
    return text.split(separator)
        .map(part => part.trim())
        .filter(part => part.length > 0)
        .join('\n');
}

/**
 * Capitalize first letter
 */
function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

module.exports = {
    smartFormatItem
};
