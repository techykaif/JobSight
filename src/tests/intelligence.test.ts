import { describe, it, expect, vi } from 'vitest';
import { HiddenGemAnalyzer } from '../lib/intelligence/analyzers/HiddenGemAnalyzer.js';
import { VisibilityAnalyzer } from '../lib/intelligence/analyzers/VisibilityAnalyzer.js';
import { AuthenticityAnalyzer } from '../lib/intelligence/analyzers/AuthenticityAnalyzer.js';
import { CompetitionAnalyzer } from '../lib/intelligence/analyzers/CompetitionAnalyzer.js';
import { FreshnessAnalyzer } from '../lib/intelligence/analyzers/FreshnessAnalyzer.js';
import { DiscoverySourceAnalyzer } from '../lib/intelligence/analyzers/DiscoverySourceAnalyzer.js';
import { runDiscoveryIntelligence } from '../lib/intelligence/engine.js';
import { calculateOpportunityIntelligence } from '../lib/intelligence/opportunity.js';
import { generateOpportunityRadar } from '../lib/intelligence/radar.js';
import { detectHiringTrend } from '../lib/intelligence/trends.js';
import * as repos from '../lib/db/repositories/index.js';

// Mock DB
vi.mock('../lib/db/repositories/index.js', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    saveEvent: vi.fn(),
  };
});

describe('Discovery Intelligence Engine', () => {
  const baseJob = {
    sourceUrl: 'https://boards.greenhouse.io/test/jobs/123',
    title: 'Software Engineer',
    companyName: 'TestCo',
    location: 'Remote',
    remoteType: 'REMOTE' as const,
    rawContent: 'We are hiring now! Posted today. Remote anywhere worldwide.'
  };

  const context = {
    job: baseJob,
    runId: 'test_run',
    sourceProviderType: 'GREENHOUSE',
    sourceUrl: baseJob.sourceUrl
  };

  it('evaluates Hidden Gem', async () => {
    const analyzer = new HiddenGemAnalyzer();
    const result = await analyzer.analyze(context);
    expect(result.output.hiddenGem).toBe('HIGH');
  });

  it('evaluates Visibility', async () => {
    const analyzer = new VisibilityAnalyzer();
    const result = await analyzer.analyze(context);
    expect(result.output.visibility).toBe('VERY_LOW'); // Greenhouse direct is very low visibility compared to search engines
  });

  it('evaluates Authenticity', async () => {
    const analyzer = new AuthenticityAnalyzer();
    const result = await analyzer.analyze(context);
    expect(result.output.authenticity).toBe('HIGH'); // HTTPS + ATS
  });

  it('evaluates Competition', async () => {
    const analyzer = new CompetitionAnalyzer();
    const result = await analyzer.analyze(context);
    expect(result.output.competition).toBe('MEDIUM'); // No easy apply, but remote region adds +1
  });

  it('evaluates Freshness', async () => {
    const analyzer = new FreshnessAnalyzer();
    const result = await analyzer.analyze(context);
    expect(result.output.freshness).toBe('TODAY'); // Text has 'posted today'
  });

  it('evaluates Discovery Source', async () => {
    const analyzer = new DiscoverySourceAnalyzer();
    const result = await analyzer.analyze(context);
    expect(result.output.sourceTrust).toBe('VERY_HIGH'); // GREENHOUSE
  });

  it('runs complete intelligence engine', async () => {
    const intelligence = await runDiscoveryIntelligence(context);
    expect(intelligence.hiddenGem).toBeDefined();
    expect(intelligence.visibility).toBeDefined();
    expect(intelligence.authenticity).toBeDefined();
    expect(intelligence.competition).toBeDefined();
    expect(intelligence.freshness).toBeDefined();
    expect(intelligence.sourceTrust).toBeDefined();
    expect(intelligence.confidence).toBeGreaterThan(0);
  });

  it('calculates deterministic Opportunity Intelligence', async () => {
    const intelligence = await runDiscoveryIntelligence(context);
    const opportunity = calculateOpportunityIntelligence(intelligence);
    
    expect(opportunity.opportunityScore).toBeGreaterThanOrEqual(0);
    expect(opportunity.opportunityScore).toBeLessThanOrEqual(100);
    expect(['URGENT', 'HIGH', 'NORMAL', 'LOW', 'IGNORE']).toContain(opportunity.priority);
  });

  it('generates radar views', () => {
    const radar = generateOpportunityRadar([{
      jobId: '123',
      discovery: {
        hiddenGem: 'VERY_HIGH',
        visibility: 'LOW',
        authenticity: 'HIGH',
        competition: 'LOW',
        freshness: 'TODAY',
        sourceTrust: 'HIGHEST',
        confidence: 90,
        signals: [],
        unknowns: []
      },
      opportunity: {
        opportunityScore: 90,
        priority: 'URGENT',
        recommendedAction: 'Apply'
      }
    }]);

    expect(radar.hiddenGems.length).toBe(1);
    expect(radar.recentlyPosted.length).toBe(1);
    expect(radar.lowCompetition.length).toBe(1);
    expect(radar.highTrust.length).toBe(1);
    expect(radar.highestScore.length).toBe(1);
  });

  it('detects historical trends deterministically', () => {
    expect(detectHiringTrend([0, 0])).toBe('UNKNOWN');
    expect(detectHiringTrend([10, 15, 20])).toBe('GROWING');
    expect(detectHiringTrend([20, 15, 10])).toBe('DECLINING');
    expect(detectHiringTrend([20, 20, 21])).toBe('STABLE');
  });

  it('handles UNKNOWN appropriately', async () => {
    const badContext = {
      job: { ...baseJob, sourceUrl: '', rawContent: '', title: '', companyName: '' },
      runId: 'test_run'
    };
    const analyzer = new AuthenticityAnalyzer();
    const result = await analyzer.analyze(badContext);
    expect(result.output.authenticity).toBe('UNKNOWN');
    expect(result.unknowns.length).toBeGreaterThan(1);
  });
});
