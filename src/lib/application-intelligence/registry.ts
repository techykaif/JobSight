import type { BaseApplicationIntelligenceProvider } from './interfaces';

class ApplicationIntelligenceRegistry {
  private providers: BaseApplicationIntelligenceProvider[] = [];

  register(provider: BaseApplicationIntelligenceProvider) {
    this.providers.push(provider);
  }

  getProviders(): BaseApplicationIntelligenceProvider[] {
    return this.providers;
  }

  clear() {
    this.providers = [];
  }
}

export const applicationIntelligenceRegistry = new ApplicationIntelligenceRegistry();
