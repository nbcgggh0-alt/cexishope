/**
 * BaseProvider - The genetic blueprint for all Currency Sources.
 * All 100+ scrapers/APIs must inherit from this class.
 */
class BaseProvider {
    constructor(name, priority = 50) {
        this.name = name;
        this.priority = priority; // Higher number = Higher priority
    }

    /**
     * fetchRates - Must be implemented by the child class.
     * @param {string} baseCurrency (e.g., 'MYR')
     * @returns {Promise<Object>} { USD: 0.23, SGD: 0.32, ... } or null if failed
     */
    async fetchRates(baseCurrency = 'MYR') {
        throw new Error(`Method 'fetchRates' must be implemented by ${this.name}`);
    }

    /**
     * standardize - Helper to ensure rates are numbers
     * @param {Object} rates 
     */
    standardize(rates) {
        const clean = {};
        for (const [key, value] of Object.entries(rates)) {
            // Remove commas, ensure float
            let val = value;
            if (typeof value === 'string') {
                val = parseFloat(value.replace(/,/g, ''));
            }
            if (val && !isNaN(val)) {
                clean[key.toUpperCase()] = val;
            }
        }
        return clean;
    }
}

module.exports = BaseProvider;
