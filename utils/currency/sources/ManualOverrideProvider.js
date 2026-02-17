const fs = require('fs');
const path = require('path');
const BaseProvider = require('../BaseProvider');

const CUSTOM_FILE = path.join(__dirname, '../../../currency_custom.json');

class ManualOverrideProvider extends BaseProvider {
    constructor() {
        super('Admin Manual Override', 1000); // Priority 1000 (GOD TIER)
    }

    async fetchRates(base = 'MYR') {
        try {
            if (!fs.existsSync(CUSTOM_FILE)) {
                return null;
            }

            const rawData = fs.readFileSync(CUSTOM_FILE, 'utf8');
            const customRates = JSON.parse(rawData);

            // Filter for dirty data
            const cleanRates = {};
            for (const [key, value] of Object.entries(customRates)) {
                if (value && !isNaN(parseFloat(value))) {
                    cleanRates[key.toUpperCase()] = parseFloat(value);
                }
            }

            if (Object.keys(cleanRates).length > 0) {
                return cleanRates;
            }
        } catch (e) {
            console.error(`[ManualOverride] Error reading custom file: ${e.message}`);
        }
        return null;
    }
}

module.exports = ManualOverrideProvider;
