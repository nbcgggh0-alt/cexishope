// Diagnostic script to check which operations fail during ordering
const db = require('../utils/database');
const queueManager = require('../utils/queueManager');

async function diagnose() {
    console.log('=== ORDER FLOW DIAGNOSTICS ===\n');

    // 1. Test db.getSettings()
    try {
        const settings = await db.getSettings();
        console.log('✅ db.getSettings() OK');
        console.log('   Settings keys:', Object.keys(settings));
        console.log('   storeOpen:', settings.storeOpen);
        console.log('   qrPayment:', JSON.stringify(settings.qrPayment));
        console.log('   welcomeMedia:', JSON.stringify(settings.welcomeMedia));
        console.log('   sessionTimeout:', settings.sessionTimeout);
    } catch (e) {
        console.log('❌ db.getSettings() FAILED:', e.message);
    }

    // 2. Test db.getProducts()
    try {
        const products = await db.getProducts();
        console.log('\n✅ db.getProducts() OK - Count:', products.length);
        if (products.length > 0) {
            const p = products[0];
            console.log('   Sample product:', JSON.stringify({
                id: p.id,
                name: p.name,
                price: p.price,
                stock: p.stock,
                categoryId: p.categoryId,
                active: p.active,
                deliveryType: p.deliveryType
            }));
        }
    } catch (e) {
        console.log('❌ db.getProducts() FAILED:', e.message);
    }

    // 3. Test db.getTransactions()
    try {
        const transactions = await db.getTransactions();
        console.log('\n✅ db.getTransactions() OK - Count:', transactions.length);
    } catch (e) {
        console.log('❌ db.getTransactions() FAILED:', e.message);
    }

    // 4. Test db.getSessions()
    try {
        const sessions = await db.getSessions();
        console.log('\n✅ db.getSessions() OK - Count:', sessions.length);
        if (sessions.length > 0) {
            console.log('   Sample session keys:', Object.keys(sessions[0]));
        }
    } catch (e) {
        console.log('❌ db.getSessions() FAILED:', e.message);
    }

    // 5. Test db.getActiveSessionByUserId()
    try {
        const activeSession = await db.getActiveSessionByUserId(8402309532);
        console.log('\n✅ db.getActiveSessionByUserId() OK:', activeSession ? 'Found' : 'None');
    } catch (e) {
        console.log('❌ db.getActiveSessionByUserId() FAILED:', e.message);
    }

    // 6. Test db.getAdmins()
    try {
        const admins = await db.getAdmins();
        console.log('\n✅ db.getAdmins() OK');
        console.log('   Owner:', admins.owner, '(type:', typeof admins.owner, ')');
        console.log('   Admins:', admins.admins);
        const allAdmins = [admins.owner, ...admins.admins].filter(Boolean);
        console.log('   All admins:', allAdmins);
    } catch (e) {
        console.log('❌ db.getAdmins() FAILED:', e.message);
    }

    // 7. Test db.saveSession() with a dummy session
    try {
        const testToken = 'TEST-DIAG-' + Date.now();
        const testSession = {
            token: testToken,
            userId: 99999999,
            adminId: null,
            status: 'test',
            createdAt: new Date().toISOString(),
            messages: []
        };
        const result = await db.saveSession(testSession);
        console.log('\n✅ db.saveSession() OK:', result);

        // Clean up test session
        const supabase = require('../utils/supabase');
        await supabase.from('cexi_sessions').delete().eq('token', testToken);
        console.log('   Cleaned up test session');
    } catch (e) {
        console.log('❌ db.saveSession() FAILED:', e.message);
    }

    // 8. Test queueManager
    try {
        const queue = await queueManager.getQueue();
        console.log('\n✅ queueManager.getQueue() OK - Count:', queue.length);
        const stats = await queueManager.getQueueStats();
        console.log('   Stats:', JSON.stringify(stats));
    } catch (e) {
        console.log('❌ queueManager FAILED:', e.message);
    }

    // 9. Test db.saveTransactions with current data (read-only check)
    try {
        const transactions = await db.getTransactions();
        console.log('\n✅ Transactions read OK - Count:', transactions.length);
        if (transactions.length > 0) {
            const t = transactions[0];
            console.log('   Sample transaction keys:', Object.keys(t));
            console.log('   Sample id:', t.id, 'status:', t.status);
        }
    } catch (e) {
        console.log('❌ Transaction check FAILED:', e.message);
    }

    // 10. Check db.getUser
    try {
        const user = await db.getUser(8402309532);
        console.log('\n✅ db.getUser(8402309532) OK');
        console.log('   User:', JSON.stringify(user));
    } catch (e) {
        console.log('❌ db.getUser() FAILED:', e.message);
    }

    // 11. Check helpers
    try {
        const { generateOrderId, generateSessionToken, isSessionExpired } = require('../utils/helpers');
        console.log('\n✅ helpers imported OK');
        console.log('   generateOrderId:', generateOrderId());
        console.log('   generateSessionToken:', generateSessionToken());
        console.log('   isSessionExpired (now):', isSessionExpired(new Date().toISOString()));
        console.log('   isSessionExpired (old):', isSessionExpired('2020-01-01T00:00:00.000Z'));
    } catch (e) {
        console.log('❌ helpers FAILED:', e.message);
    }

    // 12. Check voucher
    try {
        const { applyVoucherToOrder } = require('../handlers/voucher');
        const result = await applyVoucherToOrder(8402309532, 5.00);
        console.log('\n✅ applyVoucherToOrder() OK:', JSON.stringify(result));
    } catch (e) {
        console.log('❌ applyVoucherToOrder() FAILED:', e.message);
    }

    // 13. Simulate full saveTransactions flow
    try {
        const transactions = await db.getTransactions();
        const testTx = {
            id: 'TEST-DIAG-' + Date.now(),
            userId: 99999999,
            productId: 'test',
            productName: { ms: 'Test', en: 'Test' },
            originalPrice: 5.00,
            price: 5.00,
            discount: 0,
            voucherCode: null,
            discountPercentage: 0,
            status: 'test',
            createdAt: new Date().toISOString(),
            paymentProof: null,
            deliveredItem: null
        };
        transactions.push(testTx);
        const saveResult = await db.saveTransactions(transactions);
        console.log('\n✅ db.saveTransactions() OK:', saveResult);

        // Cleanup
        const supabase = require('../utils/supabase');
        await supabase.from('cexi_transactions').delete().eq('id', testTx.id);
        console.log('   Cleaned up test transaction');
    } catch (e) {
        console.log('❌ db.saveTransactions() FAILED:', e.message);
        console.log('   Stack:', e.stack);
    }

    console.log('\n=== DIAGNOSTICS COMPLETE ===');
}

diagnose();
