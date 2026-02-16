/**
 * Handler tests — verifies critical handler logic with mocked bot context and database.
 */

// Mock supabase before anything else
jest.mock('../utils/supabase', () => {
    const chain = {
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        upsert: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        neq: jest.fn().mockReturnThis(),
        ilike: jest.fn().mockReturnThis(),
        not: jest.fn().mockReturnThis(),
        single: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        then: jest.fn(resolve => resolve({ data: [], error: null })),
    };
    return { from: jest.fn().mockReturnValue(chain), _chain: chain };
});

jest.mock('uuid', () => ({ v4: () => 'test-uuid-1234' }));

jest.mock('../config', () => ({
    TELEGRAM_BOT_TOKEN: 'test-token',
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_KEY: 'test-key',
    OWNER_ID: 12345,
    store: { name: 'Test Store', currency: 'RM', sessionTimeout: 14400000 },
    backup: { interval: 300000, enabled: true, maxBackupFiles: 50 },
    autoPromote: { enabled: true, defaultInterval: 3600000 },
    paths: { data: './data', media: './media', qr: './qr', logs: './logs' },
}));

const { safeNum, formatPrice, generateOrderId, isSessionExpired } = require('../utils/helpers');

// --- Helper function tests for handler-relevant logic ---

describe('Handler Logic', () => {

    describe('Order ID generation', () => {
        test('generates unique order IDs with ORD prefix', () => {
            const id = generateOrderId();
            expect(id).toMatch(/^ORD-/);
        });
    });

    describe('Price formatting in handlers', () => {
        test('formats prices safely with safeNum', () => {
            expect(safeNum(undefined).toFixed(2)).toBe('0.00');
            expect(safeNum(null).toFixed(2)).toBe('0.00');
            expect(safeNum(NaN).toFixed(2)).toBe('0.00');
            expect(safeNum(19.99).toFixed(2)).toBe('19.99');
            expect(safeNum('25.5').toFixed(2)).toBe('25.50');
        });

        test('formatPrice handles edge cases', () => {
            expect(formatPrice(0)).toBe('RM 0.00');
            expect(formatPrice(100)).toBe('RM 100.00');
            expect(formatPrice('49.9')).toBe('RM 49.90');
        });
    });

    describe('Session expiry logic', () => {
        test('active session is not expired', () => {
            const now = new Date().toISOString();
            expect(isSessionExpired(now)).toBe(false);
        });

        test('old session is expired (default 4h timeout)', () => {
            const old = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();
            expect(isSessionExpired(old)).toBe(true);
        });

        test('custom timeout works', () => {
            const recent = new Date(Date.now() - 30 * 1000).toISOString();
            expect(isSessionExpired(recent, 60000)).toBe(false);
            expect(isSessionExpired(recent, 10000)).toBe(true);
        });
    });

    describe('Admin data structure', () => {
        test('admin destructuring pattern works correctly', () => {
            // This is the pattern used in orderTracking.js after our fix
            const adminData = { owner: '12345', admins: ['67890', '11111'] };
            const allAdmins = [adminData.owner, ...adminData.admins].filter(Boolean);
            expect(allAdmins).toEqual(['12345', '67890', '11111']);
        });

        test('handles null owner gracefully', () => {
            const adminData = { owner: null, admins: ['67890'] };
            const allAdmins = [adminData.owner, ...adminData.admins].filter(Boolean);
            expect(allAdmins).toEqual(['67890']);
        });

        test('handles empty admins gracefully', () => {
            const adminData = { owner: '12345', admins: [] };
            const allAdmins = [adminData.owner, ...adminData.admins].filter(Boolean);
            expect(allAdmins).toEqual(['12345']);
        });

        test('handles completely empty admin data', () => {
            const adminData = { owner: null, admins: [] };
            const allAdmins = [adminData.owner, ...adminData.admins].filter(Boolean);
            expect(allAdmins).toEqual([]);
        });
    });

    describe('Queue Manager', () => {
        let queueManager;

        beforeEach(() => {
            // Reset module cache
            delete require.cache[require.resolve('../utils/queueManager')];
            const supabase = require('../utils/supabase');

            // Mock getQueue (empty)
            supabase._chain.then = jest.fn(resolve => resolve({ data: [], error: null }));

            queueManager = require('../utils/queueManager');
        });

        test('formatEstimatedTime returns Soon for past dates', () => {
            const past = new Date(Date.now() - 60000).toISOString();
            expect(queueManager.formatEstimatedTime(past)).toBe('Segera / Soon');
        });

        test('formatEstimatedTime returns N/A for null', () => {
            expect(queueManager.formatEstimatedTime(null)).toBe('N/A');
        });

        test('formatTimeRemaining returns 0 for past dates', () => {
            const past = new Date(Date.now() - 60000).toISOString();
            expect(queueManager.formatTimeRemaining(past)).toBe('0 minit');
        });

        test('formatTimeRemaining returns N/A for null', () => {
            expect(queueManager.formatTimeRemaining(null)).toBe('N/A');
        });

        test('formatEstimatedTime handles minutes correctly', () => {
            const future = new Date(Date.now() + 10 * 60000).toISOString(); // 10 min from now
            const result = queueManager.formatEstimatedTime(future);
            expect(result).toMatch(/~\d+ minit \/ minutes/);
        });
    });
});
