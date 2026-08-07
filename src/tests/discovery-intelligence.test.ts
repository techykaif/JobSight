import { describe, it, expect, beforeEach } from 'vitest';
import { discoveryIntelligenceRegistry } from '../lib/discovery-intelligence/registry';
import { runDiscoveryIntelligence } from '../lib/discovery-intelligence/engine';
import type { DiscoveryIntelligenceContext, BaseDiscoveryIntelligenceProvider, DiscoveryIntelligenceSignal } from '../lib/discovery-intelligence/interfaces';
import type { DiscoverySignalType } from '../lib/discovery-intelligence/types';
import { registerDefaultProviders } from '../lib/discovery-intelligence/providers/signals';

describe('Discovery Intelligence Engine', () => {
  beforeEach(() => {
    discoveryIntelligenceRegistry.clear();
    registerDefaultProviders(discoveryIntelligenceRegistry);
  });

  it('should register core providers correctly', () => {
    const providers = discoveryIntelligenceRegistry.getProviders();
    expect(providers.length).toBeGreaterThan(0);
    expect(providers.some(p => p.type === 'OFFICIAL_ATS')).toBe(true);
    expect(providers.some(p => p.type === 'DUPLICATE_DETECTION')).toBe(true);
  });

  it('should calculate Exceptional discovery level for unique ATS postings', async () => {
    const job = { id: 'job-ats', canonicalTitle: 'Staff Engineer' } as any;
    const ctx: DiscoveryIntelligenceContext = {
      runId: 'test-run',
      job,
      observation: {} as any,
      source: { sourceType: 'GREENHOUSE' } as any,
      similarJobsInRun: [job], // Itself only, so 0 duplicates
      foundationEvidence: [],
      foundationSignals: []
    };

    const result = await runDiscoveryIntelligence(ctx);

    // Score checks
    // Base 40 + ATS 20 + Unique 10 + Authenticity 15 = 85 (Exceptional > 80)
    expect(result.result.score).toBeGreaterThan(80); 
    expect(result.result.level).toBe('Exceptional');
    
    // Summary checks
    expect(result.summary.quality).toBe('Premium');
    expect(result.summary.uniqueness).toBe('High');
    expect(result.summary.authenticity).toBe('Verified');
    expect(result.summary.visibility).toBe('Low'); // Premium + High Uniqueness -> Low visibility
  });

  it('should calculate Standard or Weak discovery level for duplicated aggregator postings', async () => {
    const job = { id: 'job-agg-1', canonicalTitle: 'Frontend Developer' } as any;
    const duplicate = { id: 'job-agg-2', canonicalTitle: 'Frontend Developer' } as any;
    
    const ctx: DiscoveryIntelligenceContext = {
      runId: 'test-run',
      job,
      observation: {} as any,
      source: { sourceType: 'SEARCH_ENGINE' } as any,
      similarJobsInRun: [job, duplicate], // 1 duplicate
      foundationEvidence: [],
      foundationSignals: []
    };

    const result = await runDiscoveryIntelligence(ctx);

    // Score checks
    // Base 40 + Aggregator -10 + Duplicate -15 = 15 (Weak)
    expect(result.result.score).toBeLessThanOrEqual(20);
    expect(result.result.level).toBe('Weak');
    
    // Summary checks
    expect(result.summary.quality).toBe('Low');
    expect(result.summary.visibility).toBe('High'); // Low quality -> High visibility
    expect(result.summary.authenticity).toBe('Unverified');
  });

  it('should allow registering custom plugins', () => {
    class CustomProvider implements BaseDiscoveryIntelligenceProvider {
      type: DiscoverySignalType = 'DISCOVERY_DEPTH';
      async extractSignal(ctx: DiscoveryIntelligenceContext): Promise<DiscoveryIntelligenceSignal | null> {
        return { type: this.type, value: true, weight: 10 };
      }
    }
    discoveryIntelligenceRegistry.register(new CustomProvider());
    
    const providers = discoveryIntelligenceRegistry.getProviders();
    expect(providers.some(p => p.type === 'DISCOVERY_DEPTH')).toBe(true);
  });
});
