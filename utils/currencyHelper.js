const CurrencyEngine = require('./currency/CurrencyEngine');

// ⚡ HYBRID UPDATE INTERVAL handled internally by Engine

async function fetchExchangeRates() {
    return await CurrencyEngine.getRates('MYR');
}

// Convert price from MYR to target currency
async function convertPrice(priceInMYR, targetCurrency) {
    if (!targetCurrency || targetCurrency === 'MYR') return parseFloat(priceInMYR).toFixed(2);

    const rates = await fetchExchangeRates();
    // Safety check: if rates unavailable, default to 1 (MYR)
    const rate = (rates && rates[targetCurrency]) ? rates[targetCurrency] : 1;

    const converted = priceInMYR * rate;

    // Formatting rules (No decimals for weak currencies)
    if (['IDR', 'VND', 'KRW', 'JPY', 'IQD', 'IRR'].includes(targetCurrency)) {
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
        VND: '₫',
        GBP: '£',
        AUD: 'A$',
        JPY: '¥',
        KRW: '₩',
        TRY: '₺',
        RUB: '₽',
        SAR: '﷼',
        AED: 'AED '
    };

    const symbol = symbols[currency] || currency + ' ';

    if (['IDR', 'EUR', 'VND', 'RUB', 'TRY'].includes(currency)) {
        // European/Indonesian format: 1.234,56
        return `${symbol}${parseFloat(price).toLocaleString('id-ID')}`;
    }

    // Standard format: 1,234.56
    return `${symbol}${parseFloat(price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
