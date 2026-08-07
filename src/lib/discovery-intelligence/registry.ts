import type { BaseDiscoveryIntelligenceProvider } from './interfaces';

class DiscoveryIntelligenceRegistry {
  private providers: BaseDiscoveryIntelligenceProvider[] = [];

  register(provider: BaseDiscoveryIntelligenceProvider) {
    this.providers.push(provider);
  }

  getProviders(): BaseDiscoveryIntelligenceProvider[] {
    return this.providers;
  }

  clear() {
    this.providers = [];
  }
}

export const discoveryIntelligenceRegistry = new DiscoveryIntelligenceRegistry();
