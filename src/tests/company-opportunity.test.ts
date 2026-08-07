import { describe, it, expect, beforeEach } from 'vitest';
import { companyOpportunityRegistry } from '../lib/company-opportunity/registry';
import { runCompanyOpportunityIntelligence } from '../lib/company-opportunity/engine';
import type { CompanyOpportunityContext, BaseCompanyOpportunityProvider, CompanyOpportunitySignal } from '../lib/company-opportunity/interfaces';
import type { CompanySignalType } from '../lib/company-opportunity/types';
import { registerDefaultProviders } from '../lib/company-opportunity/providers/signals';

describe('Company Opportunity Intelligence Engine', () => {
  beforeEach(() => {
    companyOpportunityRegistry.clear();
    registerDefaultProviders(companyOpportunityRegistry);
  });

  it('should register core providers correctly', () => {
    const providers = companyOpportunityRegistry.getProviders();
    expect(providers.length).toBeGreaterThan(0);
    expect(providers.some(p => p.type === 'NUMBER_OF_ACTIVE_ROLES')).toBe(true);
    expect(providers.some(p => p.type === 'REMOTE_HIRING')).toBe(true);
  });

  it('should calculate growing hiring outlook for companies with many active and fresh roles', async () => {
    const ctx: CompanyOpportunityContext = {
      runId: 'test-run',
      company: { id: 'comp-1' } as any,
      jobsForCompany: [
        { id: 'job-1', canonicalTitle: 'Software Engineer' } as any,
        { id: 'job-2', canonicalTitle: 'Senior Dev' } as any,
        { id: 'job-3', canonicalTitle: 'DevOps' } as any,
        { id: 'job-4', canonicalTitle: 'Frontend' } as any,
        { id: 'job-5', canonicalTitle: 'Backend' } as any,
        { id: 'job-6', canonicalTitle: 'QA' } as any
      ],
      foundationEvidenceByJob: {},
      foundationSignalsByJob: {
        'job-1': [{ type: 'POSTING_FRESHNESS', value: 2 }, { type: 'REMOTE_POLICY', value: 'REMOTE' }],
        'job-2': [{ type: 'POSTING_FRESHNESS', value: 5 }]
      },
      competitionResultsByJob: {
        'job-1': { score: 20, level: 'Very Low', confidence: 90 },
        'job-2': { score: 25, level: 'Low', confidence: 90 }
      }
    };

    const result = await runCompanyOpportunityIntelligence(ctx);

    // Score checks
    expect(result.result.score).toBeGreaterThan(40); // Base is 40 + signals
    expect(result.outlook.trend).toBe('Growing'); // High momentum
    
    // Summary checks
    expect(result.summary.hiringTrend).toBe('Growing');
    expect(result.summary.remoteHiring).toBe('Active');
    expect(result.summary.engineeringHiring).toBe('Active');
    expect(result.summary.competition).toBe('Low');
  });

  it('should calculate slowing outlook for companies with few, old roles and high competition', async () => {
    const ctx: CompanyOpportunityContext = {
      runId: 'test-run',
      company: { id: 'comp-2' } as any,
      jobsForCompany: [{ id: 'job-3', canonicalTitle: 'Marketing Manager' } as any],
      foundationEvidenceByJob: {},
      foundationSignalsByJob: {
        'job-3': [{ type: 'POSTING_FRESHNESS', value: 45 }]
      },
      competitionResultsByJob: {
        'job-3': { score: 85, level: 'Very High', confidence: 80 }
      }
    };

    const result = await runCompanyOpportunityIntelligence(ctx);

    // Score checks
    expect(result.result.score).toBeLessThanOrEqual(40);
    expect(result.outlook.trend).toBe('Slowing');
    
    // Summary checks
    expect(result.summary.engineeringHiring).toBe('Unknown');
    expect(result.summary.competition).toBe('High');
  });

  it('should allow registering custom plugins', () => {
    class CustomProvider implements BaseCompanyOpportunityProvider {
      type: CompanySignalType = 'COMPANY_AUTHENTICITY';
      async extractSignal(ctx: CompanyOpportunityContext): Promise<CompanyOpportunitySignal | null> {
        return { type: this.type, value: true, weight: 10 };
      }
    }
    companyOpportunityRegistry.register(new CustomProvider());
    
    const providers = companyOpportunityRegistry.getProviders();
    expect(providers.some(p => p.type === 'COMPANY_AUTHENTICITY')).toBe(true);
  });
});
