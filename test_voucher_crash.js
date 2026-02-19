
const { applyVoucherToOrder } = require('./handlers/voucher');
const db = require('./utils/database');

// Mock DB
db.getUser = async (id) => {
    console.log('Mock getUser called for', id);
    if (id === 123) return { id: 123, activeVoucher: 'TEST' }; // Valid voucher user
    if (id === 456) return { id: 456, activeVoucher: null };   // No voucher user
    if (id === 789) return { id: 789, activeVoucher: 'INVALID' }; // Invalid voucher
    return null;
};

db.getVoucher = async (code) => {
    console.log('Mock getVoucher called for', code);
    if (code === 'TEST') return { code: 'TEST', value: 10, maxUses: 100, usedCount: 0, active: true };
    return null;
};

db.updateUser = async (id, update) => {
    console.log('Mock updateUser:', id, update);
};

db.saveVouchers = async () => { };

async function test() {
    try {
        console.log('Testing User 456 (No Voucher)...');
        await applyVoucherToOrder(456, 100);
        console.log('User 456 passed');

        console.log('Testing User 123 (Valid Voucher)...');
        await applyVoucherToOrder(123, 100);
        console.log('User 123 passed');

        console.log('Testing User 789 (Invalid Voucher)...');
        await applyVoucherToOrder(789, 100);
        console.log('User 789 passed');

    } catch (e) {
        console.error('CRASH DETECTED:', e);
    }
}

test();
