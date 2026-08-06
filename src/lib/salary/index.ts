import { currencyConverter } from '../currency/converter.js';

export function normalizeSalary(
  amount: number | null | undefined, 
  period: string | null | undefined, 
  targetPeriod: 'MONTH' | 'YEAR' = 'MONTH'
): number | null {
  if (amount === null || amount === undefined) return null;
  if (!period || period.toUpperCase() === 'UNKNOWN') return null; // Cannot safely normalize

  const p = period.toUpperCase();
  if (p === targetPeriod) return amount;

  if (targetPeriod === 'MONTH') {
    if (p === 'YEAR' || p === 'YEARLY') return amount / 12;
  } else if (targetPeriod === 'YEAR') {
    if (p === 'MONTH' || p === 'MONTHLY') return amount * 12;
  }

  // Do not normalize hourly without work-hours assumption
  return null;
}

export async function evaluateSalaryAttractiveness(
  jobMinOrig: number | null | undefined,
  jobMaxOrig: number | null | undefined,
  jobCurrency: string | null | undefined,
  jobPeriod: string | null | undefined,
  desiredMin: number | null | undefined,
  desiredCurrency: string = 'INR',
  desiredPeriod: 'MONTH' | 'YEAR' = 'MONTH'
): Promise<'EXCEPTIONAL' | 'HIGH' | 'GOOD' | 'BELOW_TARGET' | 'SIGNIFICANTLY_BELOW_TARGET' | 'UNKNOWN'> {
  if (desiredMin === null || desiredMin === undefined) return 'UNKNOWN';
  if (jobMinOrig === null || jobMinOrig === undefined) return 'UNKNOWN';

  // Normalize job bounds to desired period
  const jobMinNormalized = normalizeSalary(jobMinOrig, jobPeriod, desiredPeriod);
  if (jobMinNormalized === null) return 'UNKNOWN';

  // Convert job currency to desired currency
  const convertedMinResult = await currencyConverter.convert(jobMinNormalized, jobCurrency || 'USD', desiredCurrency);
  if (!convertedMinResult) return 'UNKNOWN';

  const convertedMin = convertedMinResult.convertedAmount;

  const ratio = convertedMin / desiredMin;

  if (ratio >= 1.5) return 'EXCEPTIONAL';
  if (ratio >= 1.2) return 'HIGH';
  if (ratio >= 1.0) return 'GOOD';
  if (ratio >= 0.8) return 'BELOW_TARGET';
  return 'SIGNIFICANTLY_BELOW_TARGET';
}
