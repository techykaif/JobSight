import { describe, it, expect, beforeEach } from 'vitest';
import { foundationRegistry } from '../lib/intelligence-foundation/registry';
import { runIntelligenceFoundation } from '../lib/intelligence-foundation/engine';
import type { FoundationContext, BaseSignalProvider, ObservableSignal } from '../lib/intelligence-foundation/interfaces';
import type { SignalCategory, SignalType } from '../lib/intelligence-foundation/types';
import { registerDefaultProviders } from '../lib/intelligence-foundation/providers/signals';

describe('Intelligence Foundation Engine', () => {
  beforeEach(() => {
    foundationRegistry.clear();
    registerDefaultProviders(foundationRegistry);
  });

  it('should register core providers correctly', () => {
    const providers = foundationRegistry.getProviders();
    expect(providers.length).toBeGreaterThan(0);
    expect(providers.some(p => p.type === 'SALARY_MIN')).toBe(true);
    expect(providers.some(p => p.type === 'REMOTE_POLICY')).toBe(true);
  });

  it('should allow registering custom plugins', () => {
    class CustomProvider implements BaseSignalProvider {
      type: SignalType = 'TECHNOLOGY_MATCH';
      category: SignalCategory = 'REQUIREMENTS';
      async extractSignal(ctx: FoundationContext): Promise<ObservableSignal | null> {
        return { type: this.type, value: 'React' };
      }
    }
    foundationRegistry.register(new CustomProvider());
    const providers = foundationRegistry.getProviders();
    expect(providers.some(p => p.type === 'TECHNOLOGY_MATCH')).toBe(true);
  });

  it('should generate salary and remote evidence when available', async () => {
    const ctx: FoundationContext = {
      runId: 'test-run',
      job: {
        id: 'job-1',
        salaryMin: 100000,
        salaryMax: 150000,
        remoteType: 'REMOTE'
      } as any
    };

    const result = await runIntelligenceFoundation(ctx, 60);

    expect(result.signals.length).toBe(3); // SALARY_MIN, SALARY_MAX, REMOTE_POLICY
    expect(result.evidence.length).toBe(3);

    const salaryEv = result.evidence.find(e => e.title === 'Minimum Salary Disclosed');
    expect(salaryEv).toBeDefined();
    expect(salaryEv?.category).toBe('SALARY');
    expect(salaryEv?.observedValue).toBe(100000);

    const remoteEv = result.evidence.find(e => e.title === 'Remote Policy Available');
    expect(remoteEv).toBeDefined();
    expect(remoteEv?.category).toBe('REMOTE');
    expect(remoteEv?.observedValue).toBe('REMOTE');

    // Confidence should be high because salary and remote are present
    expect(result.confidence.score).toBeGreaterThan(50);
  });

  it('should handle missing salary appropriately', async () => {
    const ctx: FoundationContext = {
      runId: 'test-run',
      job: {
        id: 'job-2',
        remoteType: 'REMOTE'
      } as any
    };

    const result = await runIntelligenceFoundation(ctx, 60);

    expect(result.signals.some(s => s.type === 'SALARY_MIN')).toBe(false);
    expect(result.evidence.some(e => e.category === 'SALARY')).toBe(false);

    // Confidence should be lower because salary is missing
    expect(result.confidence.score).toBeLessThan(75);
    expect(result.confidence.factors.some(f => f.includes('missing'))).toBe(true);
  });

  it('should handle missing company and minimum information', async () => {
    const ctx: FoundationContext = {
      runId: 'test-run',
      job: {
        id: 'job-3'
      } as any
    };

    const result = await runIntelligenceFoundation(ctx, 50);
    
    // With nothing provided, we might have 0 signals depending on the providers
    expect(result.signals.length).toBe(0);
    expect(result.confidence.score).toBeLessThanOrEqual(50);
  });

  it('should generate summary appropriately', async () => {
    class ATSProvider implements BaseSignalProvider {
      type: SignalType = 'OFFICIAL_ATS';
      category: SignalCategory = 'COMPANY';
      async extractSignal(): Promise<ObservableSignal> {
        return { type: this.type, value: true };
      }
    }
    foundationRegistry.register(new ATSProvider());

    const ctx: FoundationContext = {
      runId: 'test-run',
      job: {
        id: 'job-4',
        salaryMin: 80000,
        remoteType: 'ONSITE'
      } as any
    };

    const result = await runIntelligenceFoundation(ctx, 80);

    expect(result.summary.opportunityScore).toBe(80);
    expect(result.summary.evidenceChecklist.length).toBeGreaterThan(0);
    // Should contain "Minimum Salary Disclosed" because weight >= 2
    expect(result.summary.evidenceChecklist.some(item => item.includes('Salary'))).toBe(true);
  });
});
