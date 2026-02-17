const axios = require('axios');
const cheerio = require('cheerio');
const BaseProvider = require('../BaseProvider');

class GoogleFinanceScraper extends BaseProvider {
    constructor() {
        super('Google Finance (Scraper)', 80); // Third Priority (Real-time but slower)
        this.TARGETS = ['USD', 'SGD', 'IDR', 'THB', 'VND', 'EUR', 'CNY', 'GBP'];
    }

    async fetchRates(base = 'MYR') {
        const rates = {};

        // We scrape in parallel
        const promises = this.TARGETS.map(async (target) => {
            try {
                const url = `https://www.google.com/finance/quote/${base}-${target}`;
                const response = await axios.get(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    },
                    timeout: 4000
                });

                const $ = cheerio.load(response.data);
                const rateText = $('.YMlKec.fxKbKc').first().text();
                const rate = parseFloat(rateText.replace(/,/g, ''));

                if (rate && !isNaN(rate)) {
                    rates[target] = rate;
                }
            } catch (e) {
                // Silent fail for individual currencies
            }
        });

        await Promise.all(promises);

        return Object.keys(rates).length > 0 ? rates : null;
    }
}

module.exports = GoogleFinanceScraper;
