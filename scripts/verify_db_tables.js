/**
 * Database-Code Pairing Verification Script
 * 
 * Checks that ALL tables referenced in database.js actually exist in Supabase
 * and reports on column structure, row counts, and any mismatches.
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY,
    { auth: { persistSession: false } }
);

// All tables referenced in database.js with their expected ID fields
const EXPECTED_TABLES = [
    { table: 'cexi_users', idField: 'id', description: 'User accounts' },
    { table: 'cexi_products', idField: 'id', description: 'Product catalog' },
    { table: 'cexi_categories', idField: 'id', description: 'Product categories' },
    { table: 'cexi_transactions', idField: 'id', description: 'Orders/transactions' },
    { table: 'cexi_sessions', idField: 'token', description: 'Support chat sessions' },
    { table: 'cexi_admins', idField: 'user_id', description: 'Admin roles (owner/admin)' },
    { table: 'cexi_settings', idField: 'key', description: 'Store settings key-value' },
    { table: 'cexi_vouchers', idField: 'code', description: 'Voucher/discount codes' },
    { table: 'cexi_admin_permissions', idField: 'admin_id', description: 'Admin permission sets' },
    { table: 'cexi_admin_logs', idField: 'id', description: 'Admin action audit log' },
    { table: 'cexi_feedbacks', idField: 'id', description: 'User feedback/ratings' },
    { table: 'cexi_inventory_logs', idField: 'id', description: 'Stock change history' },
    { table: 'cexi_templates', idField: 'id', description: 'Quick reply templates' },
    { table: 'cexi_faqs', idField: 'id', description: 'FAQ entries' },
    { table: 'cexi_campaigns', idField: 'id', description: 'Auto-promote campaigns' },
    { table: 'cexi_scheduled_messages', idField: 'id', description: 'Scheduled broadcast messages' },
    { table: 'cexi_promo_templates', idField: 'id', description: 'Promotion templates' },
    { table: 'cexi_discount_codes', idField: 'code', description: 'Discount code entries' },
    { table: 'cexi_flash_sales', idField: 'id', description: 'Flash sale events' },
    { table: 'cexi_repeat_campaigns', idField: 'id', description: 'Repeating campaign configs' },
    { table: 'cexi_ab_tests', idField: 'id', description: 'A/B test configurations' },
];

// Database methods and the tables they use (from database.js)
const DB_METHODS = [
    { method: 'getUsers()', table: 'cexi_users', type: 'READ' },
    { method: 'saveUsers()', table: 'cexi_users', type: 'WRITE' },
    { method: 'getUser(userId)', table: 'cexi_users', type: 'READ' },
    { method: 'addUser(user)', table: 'cexi_users', type: 'WRITE' },
    { method: 'updateUser(userId, updates)', table: 'cexi_users', type: 'WRITE' },
    { method: 'getProducts()', table: 'cexi_products', type: 'READ' },
    { method: 'saveProducts()', table: 'cexi_products', type: 'WRITE' },
    { method: 'getCategories()', table: 'cexi_categories', type: 'READ' },
    { method: 'saveCategories()', table: 'cexi_categories', type: 'WRITE' },
    { method: 'getTransactions()', table: 'cexi_transactions', type: 'READ' },
    { method: 'saveTransactions()', table: 'cexi_transactions', type: 'WRITE' },
    { method: 'getSessions()', table: 'cexi_sessions', type: 'READ' },
    { method: 'saveSessions()', table: 'cexi_sessions', type: 'WRITE' },
    { method: 'getSession(token)', table: 'cexi_sessions', type: 'READ' },
    { method: 'getActiveSessionByUserId()', table: 'cexi_sessions', type: 'READ' },
    { method: 'getActiveSessionsByAdminId()', table: 'cexi_sessions', type: 'READ' },
    { method: 'saveSession(session)', table: 'cexi_sessions', type: 'WRITE' },
    { method: 'addSessionMessage()', table: 'cexi_sessions', type: 'WRITE' },
    { method: 'getAdmins()', table: 'cexi_admins', type: 'READ' },
    { method: 'saveAdmins()', table: 'cexi_admins', type: 'WRITE' },
    { method: 'getSettings()', table: 'cexi_settings', type: 'READ' },
    { method: 'saveSettings()', table: 'cexi_settings', type: 'WRITE' },
    { method: 'getVouchers()', table: 'cexi_vouchers', type: 'READ' },
    { method: 'saveVouchers()', table: 'cexi_vouchers', type: 'WRITE' },
    { method: 'getVoucher(code)', table: 'cexi_vouchers', type: 'READ' },
    { method: 'getAdminPermissions()', table: 'cexi_admin_permissions', type: 'READ' },
    { method: 'saveAdminPermissions()', table: 'cexi_admin_permissions', type: 'WRITE' },
    { method: 'getAdminLogs()', table: 'cexi_admin_logs', type: 'READ' },
    { method: 'logAdminAction()', table: 'cexi_admin_logs', type: 'WRITE' },
    { method: 'getFeedbacks()', table: 'cexi_feedbacks', type: 'READ' },
    { method: 'saveFeedbacks()', table: 'cexi_feedbacks', type: 'WRITE' },
    { method: 'getInventoryLogs()', table: 'cexi_inventory_logs', type: 'READ' },
    { method: 'saveInventoryLogs()', table: 'cexi_inventory_logs', type: 'WRITE' },
    { method: 'getTemplates()', table: 'cexi_templates', type: 'READ' },
    { method: 'saveTemplates()', table: 'cexi_templates', type: 'WRITE' },
    { method: 'getFAQs()', table: 'cexi_faqs', type: 'READ' },
    { method: 'saveFAQs()', table: 'cexi_faqs', type: 'WRITE' },
    { method: 'getCampaigns()', table: 'cexi_campaigns', type: 'READ' },
    { method: 'saveCampaigns()', table: 'cexi_campaigns', type: 'WRITE' },
    { method: 'getScheduledMessages()', table: 'cexi_scheduled_messages', type: 'READ' },
    { method: 'saveScheduledMessages()', table: 'cexi_scheduled_messages', type: 'WRITE' },
    { method: 'getPromoTemplates()', table: 'cexi_promo_templates', type: 'READ' },
    { method: 'savePromoTemplates()', table: 'cexi_promo_templates', type: 'WRITE' },
    { method: 'getDiscountCodes()', table: 'cexi_discount_codes', type: 'READ' },
    { method: 'saveDiscountCodes()', table: 'cexi_discount_codes', type: 'WRITE' },
    { method: 'getFlashSales()', table: 'cexi_flash_sales', type: 'READ' },
    { method: 'saveFlashSales()', table: 'cexi_flash_sales', type: 'WRITE' },
    { method: 'getRepeatCampaigns()', table: 'cexi_repeat_campaigns', type: 'READ' },
    { method: 'saveRepeatCampaigns()', table: 'cexi_repeat_campaigns', type: 'WRITE' },
    { method: 'getABTests()', table: 'cexi_ab_tests', type: 'READ' },
    { method: 'saveABTests()', table: 'cexi_ab_tests', type: 'WRITE' },
];

async function checkTable(tableName) {
    try {
        const { data, error, count } = await supabase
            .from(tableName)
            .select('*', { count: 'exact', head: false })
            .limit(1);

        if (error) {
            return { exists: false, error: error.message, rows: 0, columns: [] };
        }

        // Get column names from the first row (or empty if no data)
        const columns = data && data.length > 0 ? Object.keys(data[0]) : [];

        // Get actual count
        const { count: rowCount } = await supabase
            .from(tableName)
            .select('*', { count: 'exact', head: true });

        return { exists: true, rows: rowCount || 0, columns, sampleRow: data?.[0] || null };
    } catch (err) {
        return { exists: false, error: err.message, rows: 0, columns: [] };
    }
}

async function main() {
    console.log('='.repeat(70));
    console.log('  DATABASE-CODE PAIRING VERIFICATION');
    console.log('  Supabase URL:', process.env.SUPABASE_URL);
    console.log('  Timestamp:', new Date().toISOString());
    console.log('='.repeat(70));
    console.log();

    const results = [];
    let existCount = 0;
    let missingCount = 0;

    for (const { table, idField, description } of EXPECTED_TABLES) {
        process.stdout.write(`  Checking ${table}... `);
        const result = await checkTable(table);
        result.table = table;
        result.idField = idField;
        result.description = description;
        results.push(result);

        if (result.exists) {
            existCount++;
            console.log(`✅ EXISTS (${result.rows} rows, ${result.columns.length} columns)`);
        } else {
            missingCount++;
            console.log(`❌ MISSING — ${result.error}`);
        }
    }

    // Summary
    console.log();
    console.log('─'.repeat(70));
    console.log('  SUMMARY');
    console.log('─'.repeat(70));
    console.log(`  ✅ Tables found: ${existCount}/${EXPECTED_TABLES.length}`);
    console.log(`  ❌ Tables missing: ${missingCount}/${EXPECTED_TABLES.length}`);
    console.log();

    // Show existing tables with details
    const existing = results.filter(r => r.exists);
    if (existing.length > 0) {
        console.log('  📋 EXISTING TABLES:');
        console.log('  ' + '─'.repeat(60));
        for (const r of existing) {
            console.log(`  ✅ ${r.table}`);
            console.log(`     Description: ${r.description}`);
            console.log(`     ID Field: ${r.idField}`);
            console.log(`     Rows: ${r.rows}`);
            console.log(`     Columns: ${r.columns.join(', ')}`);
            console.log();
        }
    }

    // Show missing tables
    const missing = results.filter(r => !r.exists);
    if (missing.length > 0) {
        console.log('  ❌ MISSING TABLES (need to be created):');
        console.log('  ' + '─'.repeat(60));
        for (const r of missing) {
            console.log(`  ❌ ${r.table}`);
            console.log(`     Description: ${r.description}`);
            console.log(`     ID Field: ${r.idField}`);
            console.log(`     Error: ${r.error}`);
            console.log();
        }
    }

    // Method mapping
    console.log('  📊 DATABASE METHOD → TABLE MAPPING:');
    console.log('  ' + '─'.repeat(60));
    const tableStatus = {};
    results.forEach(r => { tableStatus[r.table] = r.exists; });

    for (const m of DB_METHODS) {
        const status = tableStatus[m.table] ? '✅' : '❌';
        console.log(`  ${status} db.${m.method} → ${m.table} [${m.type}]`);
    }

    console.log();
    console.log('='.repeat(70));

    if (missingCount > 0) {
        console.log(`  ⚠️  ${missingCount} table(s) are MISSING and need to be created!`);
        console.log('  Run the migration script to create them.');
    } else {
        console.log('  ✅ ALL TABLES PAIRED CORRECTLY!');
    }

    console.log('='.repeat(70));

    process.exit(0);
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
