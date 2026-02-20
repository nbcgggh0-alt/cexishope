require('dotenv').config();
const db = require('./utils/database');
const productsHandler = require('./handlers/products');

// Mock external dependencies to prevent side effects
const originalAddTransaction = db.addTransaction;
const originalSaveSession = db.saveSession;
const originalGetActiveSession = db.getActiveSessionByUserId;

db.addTransaction = async () => { }; // Prevent DB write
db.saveSession = async () => { }; // Prevent DB write
db.getActiveSessionByUserId = async () => null; // Mock session lookup

const mockCtx = {
    from: { id: 8402309532 }, // Dummy ID
    reply: async (msg, extra) => {
        // If the wrapper caught an error, it sends a System Error message
        if (msg && msg.includes('❌ System Error') || msg.includes('Ralat Sistem')) {
            throw new Error(`Wrapper Caught Error: ${msg}`);
        }
        // Otherwise, it was successful
    },
    answerCbQuery: async () => { },
    telegram: {
        sendMessage: async () => { }
    }
};

async function runTests() {
    console.log('Fetching products...');
    const products = await db.getProducts();
    const activeProducts = products.filter(p => p.active && p.stock > 0);
    console.log(`Testing ${activeProducts.length} active products in stock...\n`);

    let successCount = 0;
    let failCount = 0;

    for (const product of activeProducts) {
        try {
            await productsHandler.handleConfirmBuy(mockCtx, product.id);
            successCount++;
            process.stdout.write('.');
        } catch (err) {
            failCount++;
            console.error(`\n[FAIL] Product ID: ${product.id} | Name: ${product.name.ms || product.name.en || product.name}`);
            console.error(`       Error: ${err.message}`);
        }
    }

    console.log(`\n\n=== TEST RESULTS ===`);
    console.log(`Total Tested : ${activeProducts.length}`);
    console.log(`Successful   : ${successCount}`);
    console.log(`Failed       : ${failCount}`);

    // Clean up mocks
    db.addTransaction = originalAddTransaction;
    db.saveSession = originalSaveSession;
    db.getActiveSessionByUserId = originalGetActiveSession;
}

runTests().then(() => {
    process.exit(0);
}).catch(console.error);
