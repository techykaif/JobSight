import { describe, it, expect } from 'vitest';
import { normalizeSalary, evaluateSalaryAttractiveness } from '../lib/salary/index.js';

describe('normalizeSalary', () => {
  it('YEAR to MONTH normalization', () => {
    expect(normalizeSalary(1200000, 'YEAR', 'MONTH')).toBe(100000);
  });

  it('MONTH to YEAR normalization', () => {
    expect(normalizeSalary(100000, 'MONTH', 'YEAR')).toBe(1200000);
  });

  it('UNKNOWN period returns null', () => {
    expect(normalizeSalary(100000, 'UNKNOWN', 'MONTH')).toBeNull();
  });

  it('hourly period returns null (safety)', () => {
    expect(normalizeSalary(50, 'HOUR', 'MONTH')).toBeNull();
  });

  it('null amount returns null', () => {
    expect(normalizeSalary(null, 'YEAR', 'MONTH')).toBeNull();
  });

  it('same period returns unchanged', () => {
    expect(normalizeSalary(100000, 'MONTH', 'MONTH')).toBe(100000);
  });

  it('YEARLY alias normalizes correctly', () => {
    expect(normalizeSalary(1200000, 'YEARLY', 'MONTH')).toBe(100000);
  });
});

describe('evaluateSalaryAttractiveness', () => {
  it('above target salary returns HIGH', async () => {
    // ratio = 60000 / 50000 = 1.2 -> >= 1.2 -> HIGH
    const result = await evaluateSalaryAttractiveness(60000, null, 'INR', 'MONTH', 50000, 'INR', 'MONTH');
    expect(result).toBe('HIGH');
  });

  it('exceptional salary detected', async () => {
    // ratio = 100000 / 50000 = 2.0 -> >= 1.5 -> EXCEPTIONAL
    const result = await evaluateSalaryAttractiveness(100000, null, 'INR', 'MONTH', 50000, 'INR', 'MONTH');
    expect(result).toBe('EXCEPTIONAL');
  });

  it('below target salary is NOT hard rejected', async () => {
    // ratio = 45000 / 50000 = 0.9 -> >= 0.8 -> BELOW_TARGET
    const result = await evaluateSalaryAttractiveness(45000, null, 'INR', 'MONTH', 50000, 'INR', 'MONTH');
    expect(result).toBe('BELOW_TARGET');
  });

  it('significantly below target', async () => {
    // ratio = 30000 / 50000 = 0.6 -> < 0.8 -> SIGNIFICANTLY_BELOW_TARGET
    const result = await evaluateSalaryAttractiveness(30000, null, 'INR', 'MONTH', 50000, 'INR', 'MONTH');
    expect(result).toBe('SIGNIFICANTLY_BELOW_TARGET');
  });

  it('missing job salary returns UNKNOWN', async () => {
    const result = await evaluateSalaryAttractiveness(null, null, null, null, 50000, 'INR', 'MONTH');
    expect(result).toBe('UNKNOWN');
  });

  it('missing desired salary returns UNKNOWN', async () => {
    const result = await evaluateSalaryAttractiveness(60000, null, 'INR', 'MONTH', null, 'INR', 'MONTH');
    expect(result).toBe('UNKNOWN');
  });

  it('cross-currency evaluation (USD job, INR desired)', async () => {
    // FixedTestCurrencyProvider: USD -> INR rate = 83.5
    // convertedMin = 1000 * 83.5 = 83500
    // ratio = 83500 / 50000 = 1.67 -> >= 1.5 -> EXCEPTIONAL
    const result = await evaluateSalaryAttractiveness(1000, null, 'USD', 'MONTH', 50000, 'INR', 'MONTH');
    expect(result).toBe('EXCEPTIONAL');
  });
});
