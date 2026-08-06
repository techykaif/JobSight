export interface ConversionResult {
  convertedAmount: number;
  rate: number;
  provider: string;
  convertedAt: string;
}

export interface CurrencyProvider {
  getRate(sourceCurrency: string, targetCurrency: string): Promise<number | null>;
  getName(): string;
}

export class FixedTestCurrencyProvider implements CurrencyProvider {
  async getRate(sourceCurrency: string, targetCurrency: string): Promise<number | null> {
    if (sourceCurrency === targetCurrency) return 1.0;
    if (sourceCurrency === 'USD' && targetCurrency === 'INR') return 83.5;
    if (sourceCurrency === 'EUR' && targetCurrency === 'INR') return 90.0;
    if (sourceCurrency === 'GBP' && targetCurrency === 'INR') return 105.0;
    return null;
  }

  getName(): string {
    return 'FIXED_TEST_PROVIDER';
  }
}

export class CurrencyConverter {
  private provider: CurrencyProvider;

  constructor(provider?: CurrencyProvider) {
    this.provider = provider || new FixedTestCurrencyProvider();
  }

  async convert(amount: number, sourceCurrency: string, targetCurrency: string): Promise<ConversionResult | null> {
    if (amount === null || amount === undefined || !sourceCurrency || !targetCurrency) return null;
    
    const sc = sourceCurrency.toUpperCase();
    const tc = targetCurrency.toUpperCase();

    if (sc === tc) {
      return {
        convertedAmount: amount,
        rate: 1.0,
        provider: this.provider.getName(),
        convertedAt: new Date().toISOString()
      };
    }

    const rate = await this.provider.getRate(sc, tc);
    if (!rate) return null;

    return {
      convertedAmount: amount * rate,
      rate,
      provider: this.provider.getName(),
      convertedAt: new Date().toISOString()
    };
  }
}

export const currencyConverter = new CurrencyConverter(
  new FixedTestCurrencyProvider()
);
