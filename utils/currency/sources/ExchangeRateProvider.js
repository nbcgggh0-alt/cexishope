const axios = require('axios');
const BaseProvider = require('../BaseProvider');

class ExchangeRateProvider extends BaseProvider {
    constructor() {
        super('ExchangeRate-API (Free Tier)', 90); // Second Priority
    }

    async fetchRates(base = 'MYR') {
        try {
            const url = `https://api.exchangerate-api.com/v4/latest/${base}`;
            const response = await axios.get(url, { timeout: 5000 });

            if (response.data && response.data.rates) {
                return this.standardize(response.data.rates);
            }
        } catch (e) {
            console.warn(`[${this.name}] Failed: ${e.message}`);
        }
        return null;
    }
}

module.exports = ExchangeRateProvider;
