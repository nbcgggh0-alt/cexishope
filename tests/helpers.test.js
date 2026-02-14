/**
 * Tests for helper utility functions.
 * We mock uuid since it's an ESM-only module.
 */

jest.mock('uuid', () => ({
    v4: () => 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
}));

const { safeNum, formatPrice, formatDate, generateId, generateOrderId, isSessionExpired } = require('../utils/helpers');

describe('safeNum', () => {
    test('returns number for valid numeric input', () => {
        expect(safeNum(42)).toBe(42);
        expect(safeNum(3.14)).toBe(3.14);
        expect(safeNum(0)).toBe(0);
        expect(safeNum(-10)).toBe(-10);
    });

    test('returns 0 for undefined, null, NaN', () => {
        expect(safeNum(undefined)).toBe(0);
        expect(safeNum(null)).toBe(0);
        expect(safeNum(NaN)).toBe(0);
        expect(safeNum(Infinity)).toBe(0);
        expect(safeNum(-Infinity)).toBe(0);
    });

    test('converts numeric strings', () => {
        expect(safeNum('42')).toBe(42);
        expect(safeNum('3.14')).toBe(3.14);
        expect(safeNum('')).toBe(0);
        expect(safeNum('abc')).toBe(0);
    });

    test('works with .toFixed() chaining', () => {
        expect(safeNum(undefined).toFixed(2)).toBe('0.00');
        expect(safeNum(null).toFixed(2)).toBe('0.00');
        expect(safeNum(42.567).toFixed(2)).toBe('42.57');
        expect(safeNum(NaN).toFixed(2)).toBe('0.00');
    });
});

describe('formatPrice', () => {
    test('formats valid prices', () => {
        expect(formatPrice(25.5)).toBe('RM 25.50');
        expect(formatPrice(100)).toBe('RM 100.00');
        expect(formatPrice(0)).toBe('RM 0.00');
    });

    test('handles string prices', () => {
        expect(formatPrice('25.5')).toBe('RM 25.50');
    });
});

describe('generateId', () => {
    test('generates IDs with prefix', () => {
        const id = generateId('ORD');
        expect(id).toMatch(/^ORD-[A-F0-9]{8}$/);
    });

    test('generates IDs without prefix', () => {
        const id = generateId();
        expect(id).toMatch(/^[A-F0-9]{8}$/);
    });
});

describe('generateOrderId', () => {
    test('generates order IDs with ORD prefix', () => {
        const id = generateOrderId();
        expect(id).toMatch(/^ORD-[A-F0-9]{8}$/);
    });
});

describe('isSessionExpired', () => {
    test('returns false for recent sessions', () => {
        const recent = new Date().toISOString();
        expect(isSessionExpired(recent)).toBe(false);
    });

    test('returns true for old sessions', () => {
        const old = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        expect(isSessionExpired(old)).toBe(true);
    });

    test('respects custom timeout', () => {
        const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
        expect(isSessionExpired(oneMinuteAgo, 30000)).toBe(true);
        expect(isSessionExpired(oneMinuteAgo, 120000)).toBe(false);
    });
});

describe('formatDate', () => {
    test('formats dates correctly', () => {
        const result = formatDate('2024-01-15T10:30:00Z');
        expect(result).toBeTruthy();
        expect(typeof result).toBe('string');
    });

    test('handles Date objects', () => {
        const result = formatDate(new Date());
        expect(result).toBeTruthy();
        expect(typeof result).toBe('string');
    });
});
