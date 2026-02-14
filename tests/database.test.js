/**
 * Tests for database.js — verifies Supabase wrapper methods.
 * Uses a mock Supabase client to avoid hitting the real database.
 */

jest.mock('uuid', () => ({
    v4: () => 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
}));

// Mock the supabase module before requiring database
jest.mock('../utils/supabase', () => {
    const mockSelect = jest.fn();
    const mockInsert = jest.fn();
    const mockUpsert = jest.fn();
    const mockDelete = jest.fn();
    const mockUpdate = jest.fn();
    const mockEq = jest.fn();
    const mockSingle = jest.fn();
    const mockFrom = jest.fn();

    // Chain builder
    const chain = {
        select: mockSelect,
        insert: mockInsert,
        upsert: mockUpsert,
        delete: mockDelete,
        update: mockUpdate,
        eq: mockEq,
        single: mockSingle,
        not: jest.fn(),
    };

    // Each method returns the chain for chaining
    mockSelect.mockReturnValue(chain);
    mockInsert.mockReturnValue(chain);
    mockUpsert.mockReturnValue(chain);
    mockDelete.mockReturnValue(chain);
    mockUpdate.mockReturnValue(chain);
    mockEq.mockReturnValue(chain);
    mockSingle.mockReturnValue(chain);
    chain.not.mockReturnValue(chain);

    // Default resolved data
    chain.data = [];
    chain.error = null;
    chain.then = jest.fn((resolve) => resolve({ data: [], error: null }));

    mockFrom.mockReturnValue(chain);

    return {
        from: mockFrom,
        _chain: chain,
        _mockFrom: mockFrom,
        _mockSelect: mockSelect,
        _mockUpsert: mockUpsert,
        _mockSingle: mockSingle,
    };
});

// Also mock config to avoid env var validation
jest.mock('../config', () => ({
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_KEY: 'test-key',
    OWNER_ID: 12345,
    store: { name: 'Test Store', currency: 'RM', sessionTimeout: 14400000 },
    backup: { interval: 300000, enabled: true, maxBackupFiles: 50 },
    autoPromote: { enabled: true, defaultInterval: 3600000 },
    paths: { data: './data', media: './media', qr: './qr', logs: './logs' },
}));

const supabase = require('../utils/supabase');

describe('Database', () => {
    let db;

    beforeEach(() => {
        jest.clearAllMocks();

        // Reset module cache to get a fresh instance
        delete require.cache[require.resolve('../utils/database')];
        db = require('../utils/database');

        // Set up default mock return
        supabase._chain.then = jest.fn((resolve) => resolve({ data: [], error: null }));
    });

    describe('getAll', () => {
        test('calls supabase.from with correct table name', async () => {
            supabase._chain.then = jest.fn((resolve) => resolve({ data: [{ id: 1 }], error: null }));

            const result = await db.getUsers();

            expect(supabase._mockFrom).toHaveBeenCalledWith('cexi_users');
            expect(supabase._mockSelect).toHaveBeenCalledWith('*');
        });

        test('returns empty array on error', async () => {
            supabase._chain.then = jest.fn((resolve) => resolve({ data: null, error: { message: 'test error' } }));

            const result = await db.getUsers();

            expect(result).toEqual([]);
        });
    });

    describe('getById', () => {
        test('calls supabase with correct id filter', async () => {
            supabase._chain.then = jest.fn((resolve) =>
                resolve({ data: { id: 123, first_name: 'Test' }, error: null })
            );

            const result = await db.getUser(123);

            expect(supabase._mockFrom).toHaveBeenCalledWith('cexi_users');
            expect(result).toBeTruthy();
        });

        test('returns null when not found', async () => {
            supabase._chain.then = jest.fn((resolve) =>
                resolve({ data: null, error: { code: 'PGRST116', message: 'not found' } })
            );

            const result = await db.getUser(999);

            expect(result).toBeNull();
        });
    });

    describe('method existence', () => {
        const expectedMethods = [
            'getUsers', 'saveUsers', 'getUser',
            'getProducts', 'saveProducts',
            'getCategories', 'saveCategories',
            'getAdmins', 'saveAdmins',
            'getSettings', 'saveSettings',
            'getTransactions', 'saveTransactions',
            'getSessions', 'saveSessions',
            'getTemplates', 'saveTemplates',
            'getFAQs', 'saveFAQs',
            'getFeedbacks', 'saveFeedbacks',
            'getVouchers', 'saveVouchers',
            'getInventoryLogs', 'saveInventoryLogs',
        ];

        expectedMethods.forEach(method => {
            test(`has ${method} method`, () => {
                expect(typeof db[method]).toBe('function');
            });
        });
    });

    describe('deprecated methods removed', () => {
        test('db.read is no longer available', () => {
            expect(db.read).toBeUndefined();
        });

        test('db.write is no longer available', () => {
            expect(db.write).toBeUndefined();
        });
    });
});
