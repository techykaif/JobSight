import type { DiscoveryProvider, ProviderType, ProviderCapabilities } from './interfaces.js';

class DiscoveryProviderRegistry {
  private providers: Map<string, DiscoveryProvider> = new Map();

  register(provider: DiscoveryProvider): void {
    if (this.providers.has(provider.id)) {
      console.warn(`[Registry] Overwriting existing provider with ID: ${provider.id}`);
    }
    this.providers.set(provider.id, provider);
    console.log(`[Registry] Registered provider: ${provider.name} (${provider.id})`);
  }

  get(id: string): DiscoveryProvider | undefined {
    return this.providers.get(id);
  }

  getAll(): DiscoveryProvider[] {
    return Array.from(this.providers.values()).sort((a, b) => a.priority - b.priority);
  }

  getByType(type: ProviderType): DiscoveryProvider[] {
    return this.getAll().filter(p => p.providerType === type);
  }

  findCapableProviders(requirement: keyof ProviderCapabilities): DiscoveryProvider[] {
    return this.getAll().filter(p => p.capabilities()[requirement]);
  }

  findProviderForUrl(url: string): DiscoveryProvider | undefined {
    // Return the highest priority provider that supports this URL
    return this.getAll().find(p => p.supports(url));
  }

  clear(): void {
    this.providers.clear();
  }
}

// Export singleton instance
export const providerRegistry = new DiscoveryProviderRegistry();
