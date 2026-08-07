import type { BaseCompanyOpportunityProvider } from './interfaces';

class CompanyOpportunityRegistry {
  private providers: BaseCompanyOpportunityProvider[] = [];

  register(provider: BaseCompanyOpportunityProvider) {
    this.providers.push(provider);
  }

  getProviders(): BaseCompanyOpportunityProvider[] {
    return this.providers;
  }

  clear() {
    this.providers = [];
  }
}

export const companyOpportunityRegistry = new CompanyOpportunityRegistry();
