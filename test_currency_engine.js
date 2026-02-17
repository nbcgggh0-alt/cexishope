const CurrencyEngine = require('./utils/currency/CurrencyEngine');

async function testEngine() {
    console.log('🚀 Starting Hydra Engine Test...');

    // 1. Fetch Rates (Should trigger the "Race")
    try {
        console.time('FetchDuration');
        const rates = await CurrencyEngine.getRates('MYR');
        console.timeEnd('FetchDuration');

        console.log('\n✅ Rates Fetched Successfully!');
        console.log(`📊 Total Currencies: ${Object.keys(rates).length}`);

        // Sample check
        const samples = ['USD', 'SGD', 'IDR', 'SAR', 'TRY', 'BTC'];
        console.log('\n🔍 Sample Rates (1 MYR = ?):');
        samples.forEach(c => {
            console.log(`   ${c}: ${rates[c] || 'N/A'}`);
        });

        // 2. Test Cache (Second call should be instant)
        console.log('\n🔄 Testing Cache (Should be instant)...');
        console.time('CacheDuration');
        await CurrencyEngine.getRates('MYR');
        console.timeEnd('CacheDuration');

    } catch (e) {
        console.error('❌ Engine Failed:', e);
    }
}

testEngine();
