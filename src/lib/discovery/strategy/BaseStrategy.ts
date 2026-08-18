import type { DiscoveryStrategy, DiscoverySourceTarget, StrategyConfiguration } from './interfaces.js';

export abstract class BaseStrategy implements DiscoveryStrategy {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly version: string;

  // By default, just return sources in the order they were provided, all with weight 50
  prioritizeSources(sources: DiscoverySourceTarget[]): DiscoverySourceTarget[] {
    return sources.map(s => ({ ...s, weight: s.weight ?? 50 }));
  }

  shouldTerminateEarly(metrics: { elapsedMs: number; usableFound: number; providersExhausted: boolean }, config: StrategyConfiguration) {
    if (metrics.providersExhausted) {
      return { terminate: true, reason: 'Providers exhausted' };
    }
    if (metrics.elapsedMs >= config.maxBudgetMs) {
      return { terminate: true, reason: 'Discovery budget exhausted' };
    }
    if (metrics.usableFound >= config.maxUsableOpportunities) {
      return { terminate: true, reason: 'Maximum usable opportunities reached' };
    }
    return { terminate: false };
  }

  getConfiguration(huntConfig?: any): StrategyConfiguration {
    return {
      maxUsableOpportunities: huntConfig?.maximumUsableResults ?? 5,
      maxBudgetMs: huntConfig?.maximumRuntime ?? 60000,
      maxProviderRuntimeMs: huntConfig?.maximumRuntime ?? 15000
    };
  }

  protected getSourceTypeWeight(type: string): number {
    switch(type) {
      case 'CAREERS_PAGE': return 90;
      case 'GREENHOUSE':
      case 'LEVER':
      case 'ASHBY':
      case 'WORKDAY': return 85;
      case 'RSS': return 80;
      case 'SITEMAP': return 75;
      case 'SEARCH_ENGINE': return 50;
      case 'CUSTOM': return 70;
      default: return 40;
    }
  }
}
