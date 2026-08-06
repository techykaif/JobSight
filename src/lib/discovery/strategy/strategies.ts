import { BaseStrategy } from './BaseStrategy.js';
import type { DiscoverySourceTarget, StrategyConfiguration } from './interfaces.js';

export class DefaultStrategy extends BaseStrategy {
  id = 'strategy_default';
  name = 'Default Strategy';
  version = '1.0.0';

  // Uses default base weights
  prioritizeSources(sources: DiscoverySourceTarget[]): DiscoverySourceTarget[] {
    return sources
      .map(s => ({ ...s, weight: this.getSourceTypeWeight(s.type) }))
      .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));
  }
}

export class StealthStrategy extends BaseStrategy {
  id = 'strategy_stealth';
  name = 'Stealth Strategy';
  version = '1.0.0';

  getConfiguration(): StrategyConfiguration {
    return {
      maxUsableOpportunities: 3, // Very focused
      maxBudgetMs: 120000, // Higher budget because we dig deeper
      maxProviderRuntimeMs: 30000
    };
  }

  prioritizeSources(sources: DiscoverySourceTarget[]): DiscoverySourceTarget[] {
    return sources.map(s => {
      let weight = this.getSourceTypeWeight(s.type);
      // Stealth highly prioritizes direct channels over aggregators/search
      if (s.type === 'CAREERS_PAGE') weight = 100;
      else if (['GREENHOUSE', 'LEVER', 'ASHBY'].includes(s.type)) weight = 98;
      else if (s.type === 'RSS') weight = 95;
      else if (s.type === 'SITEMAP') weight = 90;
      else if (s.type === 'SEARCH_ENGINE') weight = 40; // Deprioritize
      return { ...s, weight };
    }).sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));
  }
}

export class HighCompensationStrategy extends BaseStrategy {
  id = 'strategy_high_comp';
  name = 'High Compensation Strategy';
  version = '1.0.0';
  
  prioritizeSources(sources: DiscoverySourceTarget[]): DiscoverySourceTarget[] {
    return sources.map(s => {
      let weight = this.getSourceTypeWeight(s.type);
      // Might prioritize high-end ATS providers over random RSS
      if (['GREENHOUSE', 'LEVER'].includes(s.type)) weight += 5;
      return { ...s, weight };
    }).sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));
  }
}

export class RemoteFirstStrategy extends BaseStrategy {
  id = 'strategy_remote_first';
  name = 'Remote First Strategy';
  version = '1.0.0';
  
  prioritizeSources(sources: DiscoverySourceTarget[]): DiscoverySourceTarget[] {
    return sources.map(s => ({ ...s, weight: this.getSourceTypeWeight(s.type) }))
      .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));
  }
}

export class StartupStrategy extends BaseStrategy {
  id = 'strategy_startup';
  name = 'Startup Strategy';
  version = '1.0.0';

  prioritizeSources(sources: DiscoverySourceTarget[]): DiscoverySourceTarget[] {
    return sources.map(s => {
      let weight = this.getSourceTypeWeight(s.type);
      if (s.type === 'ASHBY' || s.type === 'LEVER') weight = 100; // Common startup ATS
      if (s.type === 'WORKDAY') weight = 20; // Very rare for startups
      return { ...s, weight };
    }).sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));
  }
}

export class EnterpriseStrategy extends BaseStrategy {
  id = 'strategy_enterprise';
  name = 'Enterprise Strategy';
  version = '1.0.0';

  prioritizeSources(sources: DiscoverySourceTarget[]): DiscoverySourceTarget[] {
    return sources.map(s => {
      let weight = this.getSourceTypeWeight(s.type);
      if (s.type === 'WORKDAY') weight = 100; // Common enterprise ATS
      return { ...s, weight };
    }).sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));
  }
}

export class FastHiringStrategy extends BaseStrategy {
  id = 'strategy_fast_hiring';
  name = 'Fast Hiring Strategy';
  version = '1.0.0';

  prioritizeSources(sources: DiscoverySourceTarget[]): DiscoverySourceTarget[] {
    return sources.map(s => ({ ...s, weight: this.getSourceTypeWeight(s.type) }))
      .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));
  }
}
