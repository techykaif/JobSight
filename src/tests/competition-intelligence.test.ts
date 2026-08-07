import { describe, it, expect, beforeEach } from 'vitest';
import { competitionRegistry } from '../lib/competition/registry';
import { runCompetitionIntelligence } from '../lib/competition/engine';
import type { CompetitionContext, BaseCompetitionProvider, CompetitionSignal } from '../lib/competition/interfaces';
import type { CompetitionSignalType } from '../lib/competition/types';
import { registerDefaultProviders } from '../lib/competition/providers/signals';

describe('Competition Intelligence Engine', () => {
  beforeEach(() => {
    competitionRegistry.clear();
    registerDefaultProviders(competitionRegistry);
  });

  it('should register core providers correctly', () => {
    const providers = competitionRegistry.getProviders();
    expect(providers.length).toBeGreaterThan(0);
    expect(providers.some(p => p.type === 'OFFICIAL_ATS')).toBe(true);
    expect(providers.some(p => p.type === 'REMOTE_AVAILABILITY')).toBe(true);
  });

  it('should calculate high competition for fresh, remote jobs on major job boards', async () => {
    const ctx: CompetitionContext = {
      runId: 'test-run',
      job: { id: 'job-1' } as any,
      foundationEvidence: [],
      foundationSignals: [
        { type: 'REMOTE_POLICY', value: 'REMOTE' },
        { type: 'POSTING_FRESHNESS', value: 2 },
        { type: 'DISCOVERY_SOURCE', value: 'linkedin' }
      ],
      foundationConfidence: 90
    };

    const result = await runCompetitionIntelligence(ctx);

    // 40 (base) + 20 (remote) + 15 (fresh) + 25 (linkedin) = 100
    expect(result.result.score).toBe(100);
    expect(result.result.level).toBe('Very High');
    expect(result.summary.reasons.length).toBeGreaterThan(0);
    expect(result.summary.reasons.some(r => r.includes('Remote Role'))).toBe(true);
    expect(result.summary.reasons.some(r => r.includes('Fresh Posting'))).toBe(true);
    expect(result.summary.reasons.some(r => r.includes('Major Job Board'))).toBe(true);
  });

  it('should calculate low competition for old jobs not on major boards', async () => {
    const ctx: CompetitionContext = {
      runId: 'test-run',
      job: { id: 'job-2' } as any,
      foundationEvidence: [],
      foundationSignals: [
        { type: 'POSTING_FRESHNESS', value: 45 },
        { type: 'DISCOVERY_SOURCE', value: 'some-obscure-site' },
        { type: 'DIRECT_CAREERS_PAGE', value: true }
      ],
      foundationConfidence: 80
    };

    const result = await runCompetitionIntelligence(ctx);

    // 40 (base) - 10 (old job) - 5 (direct page) = 25 (Low)
    expect(result.result.score).toBe(25);
    expect(result.result.level).toBe('Low');
    expect(result.summary.reasons.some(r => r.includes('Older Job'))).toBe(true);
  });

  it('should allow registering custom plugins', () => {
    class CustomProvider implements BaseCompetitionProvider {
      type: CompetitionSignalType = 'COMPANY_SIZE';
      async extractSignal(ctx: CompetitionContext): Promise<CompetitionSignal | null> {
        return { type: this.type, value: 1000, weight: 5 };
      }
    }
    competitionRegistry.register(new CustomProvider());
    
    const providers = competitionRegistry.getProviders();
    expect(providers.some(p => p.type === 'COMPANY_SIZE')).toBe(true);
  });

  it('should maintain backward compatibility and handle missing data gracefully', async () => {
    const ctx: CompetitionContext = {
      runId: 'test-run',
      job: { id: 'job-3' } as any,
      foundationEvidence: [],
      foundationSignals: [],
      foundationConfidence: 50
    };

    const result = await runCompetitionIntelligence(ctx);

    expect(result.result.score).toBe(40); // Base score
    expect(result.result.level).toBe('Low'); // Wait, 40 is 'Low'. Let's check calculator: <= 40 is Low. Yes!
    
    // Confidence penalty for having 0 signals
    expect(result.result.confidence).toBeLessThan(50);
  });
});
