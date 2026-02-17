
require('dotenv').config();
const { handleBuyProducts } = require('./handlers/products');
const db = require('./utils/database');

// Mock Context
const mockCtx = {
    from: { id: 8402309532, first_name: 'Debug', username: 'debugger' }, // Use user's ID
    chat: { id: 8402309532 },
    callbackQuery: { data: 'buy_products' },
    answerCbQuery: async (msg) => console.log('CTX: answerCbQuery', msg),
    editMessageText: async (text, opts) => console.log('CTX: editMessageText', text),
    reply: async (text, opts) => console.log('CTX: reply', text),
    deleteMessage: async () => console.log('CTX: deleteMessage'),
    replyWithPhoto: async () => console.log('CTX: replyWithPhoto'),
    telegram: {
        sendMessage: async (id, msg) => console.log(`CTX: sendMessage to ${id}`, msg)
    }
};

async function runTest() {
    console.log('--- STARTING DEEP DEBUG ---');
    try {
        console.log('1. Testing DB Connection...');
        const user = await db.getUser(mockCtx.from.id);
        console.log('User found:', user ? 'YES' : 'NO');
        if (user) console.log('Language:', user.language);

        console.log('2. Testing Categories...');
        const categories = await db.getCategories();
        console.log('Categories found:', categories ? categories.length : 'NULL');

        console.log('3. Running handleBuyProducts...');
        await handleBuyProducts(mockCtx);
        console.log('✅ handleBuyProducts finished successfully.');
    } catch (error) {
        console.error('❌ CRASH DETECTED:');
        console.error('Message:', error.message);
        console.error('Stack:', error.stack);
    }
    console.log('--- END DEBUG ---');
}

runTest();
