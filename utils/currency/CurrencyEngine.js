const fs = require('fs');
const path = require('path');

class CurrencyEngine {
    constructor() {
        this.providers = [];
        this.cache = {
            rates: null,
            timestamp: 0
        };
        this.CACHE_TTL = 30 * 60 * 1000; // 30 minutes cache
        this.init();
    }

    // Load all provider files from /sources directory mechanism
    init() {
        const sourcesDir = path.join(__dirname, 'sources');
        if (!fs.existsSync(sourcesDir)) return;

        const files = fs.readdirSync(sourcesDir).filter(f => f.endsWith('.js'));

        console.log(`🔌 [HydraEngine] Loading ${files.length} providers...`);

        files.forEach(file => {
            try {
                const ProviderClass = require(path.join(sourcesDir, file));
                const instance = new ProviderClass();
                this.providers.push(instance);
                console.log(`   ✅ Loaded: ${instance.name} (Priority: ${instance.priority})`);
            } catch (e) {
                console.error(`   ❌ Failed to load ${file}:`, e.message);
            }
        });

        // Sort by priority (High to Low)
        this.providers.sort((a, b) => b.priority - a.priority);
    }

    async getRates(base = 'MYR') {
        // 1. Check Cache
        const now = Date.now();
        if (this.cache.rates && (now - this.cache.timestamp < this.CACHE_TTL)) {
            return this.cache.rates;
        }

        console.log(`🦁 [HydraEngine] Waking up to fetch rates for ${base}...`);

        // 2. The "Race" - Try providers in order
        let aggressiveRates = {};

        // We iterate through providers. If one fails, we go to the next.
        // We can also merge results if needed, but for now, we take the best single source.

        for (const provider of this.providers) {
            console.log(`   👉 Attempting: ${provider.name}...`);
            try {
                const rates = await provider.fetchRates(base);
                if (rates && Object.keys(rates).length > 0) {
                    console.log(`      ✅ Success! Got ${Object.keys(rates).length} rates.`);

                    // Merge strategies could go here. For now, we trust the high priority one.
                    // But to be "Hydra", we should merge.
                    aggressiveRates = { ...aggressiveRates, ...rates };

                    // If we have "enough" rates (e.g. > 10), we can stop.
                    // Or we keep going to fill gaps.
                    if (Object.keys(aggressiveRates).length > 100) {
                        break;
                    }
                }
            } catch (err) {
                console.warn(`      ⚠️ ${provider.name} Failed: ${err.message}`);
            }
        }

        // 3. Fallback Hardcoded
        if (Object.keys(aggressiveRates).length === 0) {
            console.error('🔥 [HydraEngine] CRITICAL: All providers failed. Using static fallback.');
            aggressiveRates = this.getStaticFallback();
        }

        // 4. Update Cache
        this.cache.rates = aggressiveRates;
        this.cache.timestamp = now;

        return aggressiveRates;
    }

    getStaticFallback() {
        return {
            USD: 0.23, SGD: 0.32, EUR: 0.21, CNY: 1.63,
            IDR: 4305, THB: 8.2, VND: 5700, GBP: 0.18
        };
    }
}

// Singleton Instance
module.exports = new CurrencyEngine();
