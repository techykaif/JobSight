import type { BaseCompetitionProvider, CompetitionContext, CompetitionSignal } from '../interfaces';
import type { CompetitionSignalType } from '../types';

export class OfficialATSProvider implements BaseCompetitionProvider {
  type: CompetitionSignalType = 'OFFICIAL_ATS';

  async extractSignal(context: CompetitionContext): Promise<CompetitionSignal | null> {
    const isATS = context.foundationSignals.some(s => s.type === 'OFFICIAL_ATS' && s.value === true);
    // ATS usually means higher visibility / competition because it's indexed by Google Jobs, aggregators, etc.
    if (isATS) {
      return {
        type: this.type,
        value: true,
        weight: 15,
        metadata: { source: 'foundation' }
      };
    }
    return null;
  }
}

export class DirectCareersPageProvider implements BaseCompetitionProvider {
  type: CompetitionSignalType = 'DIRECT_CAREERS_PAGE';

  async extractSignal(context: CompetitionContext): Promise<CompetitionSignal | null> {
    const isDirect = context.foundationSignals.some(s => s.type === 'DIRECT_CAREERS_PAGE' && s.value === true);
    // If it's only on the direct careers page and NOT ATS, it might be lower competition.
    // If it's direct careers page, we'll assign a weight. Wait, direct usually implies lower if it's hard to find, but higher if it's a big company.
    // Let's just output it.
    if (isDirect) {
      return {
        type: this.type,
        value: true,
        weight: -5, // Slightly lower competition if they have to apply on a custom direct page without easy-apply
        metadata: { source: 'foundation' }
      };
    }
    return null;
  }
}

export class RemoteAvailabilityProvider implements BaseCompetitionProvider {
  type: CompetitionSignalType = 'REMOTE_AVAILABILITY';

  async extractSignal(context: CompetitionContext): Promise<CompetitionSignal | null> {
    const remoteSignal = context.foundationSignals.find(s => s.type === 'REMOTE_POLICY');
    if (remoteSignal && ['REMOTE', 'WORLDWIDE_REMOTE'].includes(remoteSignal.value)) {
      return {
        type: this.type,
        value: remoteSignal.value,
        weight: 20, // Remote jobs are significantly more competitive
        metadata: { source: 'foundation' }
      };
    }
    return null;
  }
}

export class PostingFreshnessProvider implements BaseCompetitionProvider {
  type: CompetitionSignalType = 'POSTING_FRESHNESS';

  async extractSignal(context: CompetitionContext): Promise<CompetitionSignal | null> {
    const freshness = context.foundationSignals.find(s => s.type === 'POSTING_FRESHNESS');
    if (freshness && typeof freshness.value === 'number') {
      const days = freshness.value;
      let weight = 0;
      if (days <= 3) weight = 15; // Very fresh -> surge of applicants
      else if (days <= 7) weight = 10;
      else if (days > 30) weight = -10; // Old job, fewer active applicants now (or it's a ghost job)

      return {
        type: this.type,
        value: days,
        weight,
        metadata: { source: 'foundation' }
      };
    }
    return null;
  }
}

export class ProviderPopularityProvider implements BaseCompetitionProvider {
  type: CompetitionSignalType = 'PROVIDER_POPULARITY';

  async extractSignal(context: CompetitionContext): Promise<CompetitionSignal | null> {
    // If discovered via a major job board aggregator, competition is high
    const sourceSignal = context.foundationSignals.find(s => s.type === 'DISCOVERY_SOURCE');
    if (sourceSignal) {
      const sourceStr = String(sourceSignal.value).toLowerCase();
      let weight = 0;
      if (sourceStr.includes('linkedin') || sourceStr.includes('indeed') || sourceStr.includes('glassdoor')) {
        weight = 25; // Massive competition
      } else if (sourceStr.includes('ycombinator') || sourceStr.includes('weworkremotely')) {
        weight = 10;
      }
      
      if (weight > 0) {
        return {
          type: this.type,
          value: sourceSignal.value,
          weight,
          metadata: { source: 'discovery' }
        };
      }
    }
    return null;
  }
}

export function registerDefaultProviders(registry: any) {
  registry.register(new OfficialATSProvider());
  registry.register(new DirectCareersPageProvider());
  registry.register(new RemoteAvailabilityProvider());
  registry.register(new PostingFreshnessProvider());
  registry.register(new ProviderPopularityProvider());
}
