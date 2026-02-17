const BaseProvider = require('../BaseProvider');

class StaticFallbackProvider extends BaseProvider {
    constructor() {
        super('Static Fallback (Last Resort)', 0); // Lowest Priority
    }

    async fetchRates(base = 'MYR') {
        // Last updated: 2025 (rough estimates)
        const rates = {
            USD: 0.23,
            SGD: 0.31,
            EUR: 0.21,
            CNY: 1.63,
            IDR: 3500,
            THB: 8.2,
            VND: 5700,
            GBP: 0.18,
            TRY: 7.5,
            SAR: 0.85,
            AED: 0.83
        };
        return rates;
    }
}

module.exports = StaticFallbackProvider;
