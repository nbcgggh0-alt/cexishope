const axios = require('axios');
const cheerio = require('cheerio');
const config = require('../config');

// ⚡ HYBRID UPDATE INTERVAL
// We verify cache every 30 seconds.
const UPDATE_INTERVAL = 30000;

let ratesCache = {
    data: null,
    timestamp: 0
};

const SUPPORTED_CURRENCIES = ['USD', 'SGD', 'EUR', 'CNY', 'IDR', 'THB', 'VND'];

async function fetchExchangeRates() {
    const now = Date.now();

    // 1. Check Cache
    if (ratesCache.data && (now - ratesCache.timestamp < UPDATE_INTERVAL)) {
        return ratesCache.data;
    }

    console.log(`🌍 [${new Date().toLocaleTimeString()}] Fetching rates (Hybrid Strategy)...`);

    let rates = { MYR: 1 };
    let missingCurrencies = [];

    // 2. Try Scraping Google Finance (Best for Real-Time)
    // We scrape in parallel but handle failures gracefully
    const scrapePromises = SUPPORTED_CURRENCIES.map(async (currency) => {
        try {
            const url = `https://www.google.com/finance/quote/MYR-${currency}`;
            const headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html',
                'Cache-Control': 'no-cache'
            };

            const response = await axios.get(url, { headers, timeout: 3000 });
            const $ = cheerio.load(response.data);
            const rateText = $('.YMlKec.fxKbKc').first().text();
            let rate = parseFloat(rateText.replace(/,/g, ''));

            if (rate && !isNaN(rate)) {
                return { currency, rate };
            }
        } catch (e) {
            // Ignore error, will fallback
        }
        return { currency, rate: null };
    });

    const results = await Promise.all(scrapePromises);

    results.forEach(({ currency, rate }) => {
        if (rate) {
            rates[currency] = rate;
            // console.log(`✅ Scraped ${currency}: ${rate}`);
        } else {
            missingCurrencies.push(currency);
        }
    });

    // 3. Fallback to API if Scrape Failed (Frankfurter / ExchangeRate-API)
    if (missingCurrencies.length > 0) {
        console.log(`⚠️ Scraping failed for [${missingCurrencies.join(', ')}]. using API fallback...`);
        try {
            // Priority 1: Frankfurter (Free, reliable, no key)
            const apiRes = await axios.get('https://api.frankfurter.app/latest?from=MYR');
            const apiRates = apiRes.data.rates;

            missingCurrencies.forEach(curr => {
                if (apiRates[curr]) {
                    rates[curr] = apiRates[curr];
                    console.log(`🔄 API Fallback for ${curr}: ${rates[curr]}`);
                }
            });
        } catch (apiError) {
            console.error('❌ Primary API Failed, trying secondary...');
            try {
                // Priority 2: ExchangeRate-API (Backup)
                const backupRes = await axios.get('https://api.exchangerate-api.com/v4/latest/MYR');
                const backupRates = backupRes.data.rates;

                missingCurrencies.forEach(curr => {
                    if (!rates[curr] && backupRates[curr]) {
                        rates[curr] = backupRates[curr];
                        console.log(`🔄 Secondary API Fallback for ${curr}: ${rates[curr]}`);
                    }
                });
            } catch (e2) {
                console.error('❌ All APIs failed.');
            }
        }
    }

    // 4. Final Safety Net (Hardcoded Last Resort)
    // Only used if BOTH Google scraping AND 2 APIs fail.
    const lastResort = {
        USD: 0.23,
        SGD: 0.32, // Updated to 0.32
        EUR: 0.21,
        CNY: 1.63,
        IDR: 4305, // Updated to 4305
        THB: 8.2,
        VND: 5700
    };

    SUPPORTED_CURRENCIES.forEach(c => {
        if (!rates[c]) rates[c] = lastResort[c] || 1;
    });

    ratesCache = {
        data: rates,
        timestamp: now
    };

    return rates;
}

// Convert price from MYR to target currency
async function convertPrice(priceInMYR, targetCurrency) {
    if (targetCurrency === 'MYR') return parseFloat(priceInMYR).toFixed(2);

    const rates = await fetchExchangeRates();
    const rate = rates[targetCurrency] || 1;

    const converted = priceInMYR * rate;

    // Formatting rules
    if (['IDR', 'VND', 'KRW', 'JPY'].includes(targetCurrency)) {
        return Math.ceil(converted);
    }

    return converted.toFixed(2);
}

function formatPrice(price, currency) {
    const symbols = {
        MYR: 'RM',
        USD: '$',
        SGD: 'S$',
        EUR: '€',
        CNY: '¥',
        IDR: 'Rp ',
        THB: '฿',
        VND: '₫'
    };

    const symbol = symbols[currency] || currency;

    if (['IDR', 'EUR', 'VND'].includes(currency)) {
        return `${symbol}${parseFloat(price).toLocaleString('id-ID')}`;
    }

    return `${symbol}${price}`;
}

async function getPriceDisplay(priceInMYR, userCurrency = 'MYR') {
    if (userCurrency === 'MYR') {
        return `RM${priceInMYR}`;
    }

    const convertedPrice = await convertPrice(priceInMYR, userCurrency);
    return `${formatPrice(convertedPrice, userCurrency)} (≈RM${priceInMYR})`;
}

module.exports = {
    fetchExchangeRates,
    convertPrice,
    formatPrice,
    getPriceDisplay
};
