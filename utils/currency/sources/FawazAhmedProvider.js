const axios = require('axios');
const BaseProvider = require('../BaseProvider');

class FawazAhmedProvider extends BaseProvider {
    constructor() {
        super('FawazAhmed (Open Source API)', 100); // Highest Priority
    }

    async fetchRates(base = 'MYR') {
        try {
            // URL: https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/myr.json
            const url = `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${base.toLowerCase()}.json`;

            const response = await axios.get(url, { timeout: 5000 });

            if (response.data && response.data[base.toLowerCase()]) {
                const rawRates = response.data[base.toLowerCase()];
                return this.standardize(rawRates);
            }
        } catch (e) {
            console.warn(`[${this.name}] Failed: ${e.message}`);
        }
        return null;
    }
}

module.exports = FawazAhmedProvider;
