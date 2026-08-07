import type { BaseDiscoveryIntelligenceProvider, DiscoveryIntelligenceContext, DiscoveryIntelligenceSignal } from '../interfaces';
import type { DiscoverySignalType } from '../types';

export class OfficialAtsProvider implements BaseDiscoveryIntelligenceProvider {
  type: DiscoverySignalType = 'OFFICIAL_ATS';

  async extractSignal(context: DiscoveryIntelligenceContext): Promise<DiscoveryIntelligenceSignal | null> {
    if (!context.source) return null;
    
    const isAts = context.source.sourceType === 'GREENHOUSE' || 
                  context.source.sourceType === 'LEVER' ||
                  context.source.sourceType === 'ASHBY' ||
                  context.source.sourceType === 'WORKDAY';
    
    if (isAts) {
      return {
        type: this.type,
        value: true,
        weight: 20, // High quality discovery source
        metadata: { source: context.source.sourceType }
      };
    }
    return null;
  }
}

export class DirectCareersPageProvider implements BaseDiscoveryIntelligenceProvider {
  type: DiscoverySignalType = 'DIRECT_CAREERS_PAGE';

  async extractSignal(context: DiscoveryIntelligenceContext): Promise<DiscoveryIntelligenceSignal | null> {
    if (!context.source) return null;
    
    const isCareers = context.source.sourceType === 'CAREERS_PAGE';
    
    if (isCareers) {
      return {
        type: this.type,
        value: true,
        weight: 15, // Good quality source
        metadata: { source: context.source.sourceType }
      };
    }
    return null;
  }
}

export class AggregatorSourceProvider implements BaseDiscoveryIntelligenceProvider {
  type: DiscoverySignalType = 'AGGREGATOR_SOURCE';

  async extractSignal(context: DiscoveryIntelligenceContext): Promise<DiscoveryIntelligenceSignal | null> {
    if (!context.source) return null;
    
    const isAggregator = context.source.sourceType === 'SEARCH_ENGINE' || 
                         context.source.sourceType === 'RSS_FEED';
    
    if (isAggregator) {
      return {
        type: this.type,
        value: true,
        weight: -10, // Lower quality / less unique discovery source
        metadata: { source: context.source.sourceType }
      };
    }
    return null;
  }
}

export class DuplicateDetectionProvider implements BaseDiscoveryIntelligenceProvider {
  type: DiscoverySignalType = 'DUPLICATE_DETECTION';

  async extractSignal(context: DiscoveryIntelligenceContext): Promise<DiscoveryIntelligenceSignal | null> {
    // Check if there are similar jobs (e.g. same canonical title in the same company in this run)
    const title = context.job.canonicalTitle?.toLowerCase() || '';
    
    if (!title) return null;

    let duplicates = 0;
    for (const other of context.similarJobsInRun) {
      if (other.id !== context.job.id && other.canonicalTitle?.toLowerCase() === title) {
        duplicates++;
      }
    }

    if (duplicates > 0) {
      return {
        type: this.type,
        value: duplicates,
        weight: -15, // Not a unique discovery if we found it multiple times
        metadata: { count: duplicates }
      };
    } else {
      return {
        type: this.type,
        value: 0,
        weight: 10, // Unique discovery in this run
        metadata: { count: 0 }
      };
    }
  }
}

export class SourceAuthenticityProvider implements BaseDiscoveryIntelligenceProvider {
  type: DiscoverySignalType = 'SOURCE_AUTHENTICITY';

  async extractSignal(context: DiscoveryIntelligenceContext): Promise<DiscoveryIntelligenceSignal | null> {
    if (!context.source) return null;
    
    const isAtsOrCareers = context.source.sourceType !== 'SEARCH_ENGINE' && 
                           context.source.sourceType !== 'CUSTOM';
    
    // We consider official ATS and Direct careers to be highly authentic.
    if (isAtsOrCareers) {
      return {
        type: this.type,
        value: 'Verified',
        weight: 15,
        metadata: { trust: 'high' }
      };
    }
    return null;
  }
}

export function registerDefaultProviders(registry: any) {
  registry.register(new OfficialAtsProvider());
  registry.register(new DirectCareersPageProvider());
  registry.register(new AggregatorSourceProvider());
  registry.register(new DuplicateDetectionProvider());
  registry.register(new SourceAuthenticityProvider());
}
