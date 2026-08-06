import { describe, it, expect } from 'vitest';
import { CurrencyConverter, FixedTestCurrencyProvider } from '../lib/currency/converter.js';

describe('CurrencyConverter', () => {
  const provider = new FixedTestCurrencyProvider();
  const converter = new CurrencyConverter(provider);

  it('USD → INR conversion at fixed rate 83.5', async () => {
    const result = await converter.convert(1000, 'USD', 'INR');
    expect(result).not.toBeNull();
    expect(result!.convertedAmount).toBe(83500);
    expect(result!.rate).toBe(83.5);
  });

  it('EUR → INR conversion at fixed rate 90.0', async () => {
    const result = await converter.convert(1000, 'EUR', 'INR');
    expect(result).not.toBeNull();
    expect(result!.convertedAmount).toBe(90000);
    expect(result!.rate).toBe(90.0);
  });

  it('GBP → INR conversion at fixed rate 105.0', async () => {
    const result = await converter.convert(1000, 'GBP', 'INR');
    expect(result).not.toBeNull();
    expect(result!.convertedAmount).toBe(105000);
    expect(result!.rate).toBe(105.0);
  });

  it('INR → INR identity conversion', async () => {
    const result = await converter.convert(50000, 'INR', 'INR');
    expect(result).not.toBeNull();
    expect(result!.convertedAmount).toBe(50000);
    expect(result!.rate).toBe(1.0);
  });

  it('salary range conversion preserves both bounds', async () => {
    const minResult = await converter.convert(100000, 'USD', 'INR');
    const maxResult = await converter.convert(150000, 'USD', 'INR');
    expect(minResult).not.toBeNull();
    expect(maxResult).not.toBeNull();
    expect(minResult!.convertedAmount).toBe(8350000);
    expect(maxResult!.convertedAmount).toBe(12525000);
  });

  it('unsupported currency returns null', async () => {
    const result = await converter.convert(1000, 'JPY', 'INR');
    expect(result).toBeNull();
  });

  it('provider failure returns null for unknown pair', async () => {
    const result = await converter.convert(1000, 'AUD', 'INR');
    expect(result).toBeNull();
  });

  it('null/undefined amount returns null', async () => {
    const result = await converter.convert(null as unknown as number, 'USD', 'INR');
    expect(result).toBeNull();
  });

  it('result includes provider name and timestamp', async () => {
    const result = await converter.convert(1000, 'USD', 'INR');
    expect(result).not.toBeNull();
    expect(result!.provider).toBe('FIXED_TEST_PROVIDER');
    expect(result!.convertedAt).toBeDefined();
    const parsed = Date.parse(result!.convertedAt);
    expect(Number.isNaN(parsed)).toBe(false);
    // Verify it's a valid ISO 8601 string by round-tripping through Date
    expect(new Date(result!.convertedAt).toISOString()).toBe(result!.convertedAt);
  });
});
