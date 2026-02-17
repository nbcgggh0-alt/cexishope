
require('dotenv').config();
const db = require('./utils/database');
const { t } = require('./utils/translations');

async function debugData() {
    console.log('--- DATA DEBUG START ---');
    try {
        console.log('Checking Translation key "btnBack":');
        const btnBackMs = t('btnBack', 'ms');
        const btnBackEn = t('btnBack', 'en');
        console.log(`btnBack (ms): "${btnBackMs}" (${typeof btnBackMs})`);
        console.log(`btnBack (en): "${btnBackEn}" (${typeof btnBackEn})`);

        console.log('\nChecking Categories:');
        const categories = await db.getCategories();
        if (!categories || categories.length === 0) {
            console.log('No categories found.');
        } else {
            categories.forEach((cat, index) => {
                console.log(`[${index}] ID: ${cat.id} | Name: ${JSON.stringify(cat.name)} (${typeof cat.name})`);
                if (typeof cat.name !== 'string') {
                    console.error(`❌ CRITICAL: Category [${index}] has non-string name!`);
                }
            });
        }
    } catch (e) {
        console.error('Error:', e);
    }
    console.log('--- DATA DEBUG END ---');
}

debugData();
