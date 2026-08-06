import { describe, it, expect, vi } from 'vitest';
import { estimateApplicationRoi, estimateUrgency } from '../lib/decision/estimators.js';
import { 
  IgnoreStrategy, 
  ApplyNowStrategy, 
  ApplyThisWeekStrategy, 
  MonitorStrategy, 
  FallbackStrategy 
} from '../lib/decision/strategies.js';
import { runDecisionEngine, generateDecisionQueue, generateWeeklyStrategy } from '../lib/decision/engine.js';
import * as repos from '../lib/db/repositories/index.js';
import { bootstrap } from '../lib/bootstrap.js';

bootstrap();

// Mock DB
vi.mock('../lib/db/repositories/index.js', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    saveEvent: vi.fn(),
  };
});

describe('Decision Intelligence Engine', () => {
  const baseJob = {
    sourceUrl: 'https://boards.greenhouse.io/test/jobs/123',
    title: 'Software Engineer',
    companyName: 'TestCo',
    location: 'Remote',
    remoteType: 'REMOTE' as const,
    rawContent: 'We are hiring now! Posted today. Remote anywhere worldwide.'
  };

  const discoveryOutput = {
    hiddenGem: 'HIGH' as const,
    visibility: 'LOW' as const,
    authenticity: 'VERY_HIGH' as const,
    competition: 'LOW' as const,
    freshness: 'TODAY' as const,
    sourceTrust: 'HIGHEST' as const,
    confidence: 90,
    signals: [],
    unknowns: []
  };

  const opportunityOutput = {
    opportunityScore: 90,
    priority: 'URGENT' as const,
    recommendedAction: 'Apply immediately'
  };

  const context = {
    job: baseJob,
    runId: 'test_run',
    discovery: discoveryOutput,
    opportunity: opportunityOutput
  };

  it('estimates Application ROI deterministically', () => {
    expect(estimateApplicationRoi(context)).toBe('MEDIUM'); // Greenhouse
    
    expect(estimateApplicationRoi({ ...context, job: { ...baseJob, rawContent: 'take-home project' } })).toBe('LOW');
    expect(estimateApplicationRoi({ ...context, job: { ...baseJob, sourceUrl: 'easy-apply' } })).toBe('HIGH');
  });

  it('estimates Urgency deterministically', () => {
    expect(estimateUrgency(context)).toBe('TODAY'); // Priority is URGENT
    
    expect(estimateUrgency({ 
      ...context, 
      discovery: { ...discoveryOutput, freshness: 'THIS_WEEK' },
      opportunity: { ...opportunityOutput, priority: 'NORMAL' } 
    })).toBe('THIS_WEEK');
    
    expect(estimateUrgency({ 
      ...context, 
      job: { ...baseJob, rawContent: 'closing soon' },
      discovery: { ...discoveryOutput, freshness: 'UNKNOWN' },
      opportunity: { ...opportunityOutput, priority: 'NORMAL' } 
    })).toBe('SOON');
  });

  it('IgnoreStrategy applies correctly', () => {
    const ignoreContext = { 
      ...context, 
      opportunity: { ...opportunityOutput, priority: 'IGNORE' as const } 
    };
    const strategy = new IgnoreStrategy();
    expect(strategy.supports(ignoreContext)).toBe(true);
    const result = strategy.evaluate(ignoreContext);
    expect(result?.decision).toBe('IGNORE');
    expect(result?.priority).toBe(0);
  });

  it('ApplyNowStrategy applies correctly', () => {
    const strategy = new ApplyNowStrategy();
    expect(strategy.supports(context)).toBe(true);
    const result = strategy.evaluate(context);
    expect(result?.decision).toBe('APPLY_NOW');
    expect(result?.urgencyLevel).toBe('TODAY');
    expect(result?.requiredActions).toContain('Apply now');
  });

  it('Decision Engine resolves to highest priority strategy', async () => {
    const result = await runDecisionEngine(context);
    expect(result.decision).toBe('APPLY_NOW'); // Since ApplyNow and ApplyThisWeek might both support it, ApplyNow has higher priority (90 vs 80)
  });

  it('generates deterministic decision queue', async () => {
    const applyNowResult = (new ApplyNowStrategy()).evaluate(context)!;
    const ignoreResult = (new IgnoreStrategy()).evaluate({ 
      ...context, opportunity: { ...opportunityOutput, priority: 'IGNORE' }
    })!;

    const queue = await generateDecisionQueue('test_run', [
      { context: { ...context, opportunity: { ...opportunityOutput, priority: 'IGNORE' } }, result: ignoreResult },
      { context, result: applyNowResult }
    ]);

    expect(queue.length).toBe(2);
    expect(queue[0]!.result.decision).toBe('APPLY_NOW'); // Highest priority first
    expect(queue[1]!.result.decision).toBe('IGNORE');
  });

  it('generates weekly strategy', async () => {
    const applyNowResult = (new ApplyNowStrategy()).evaluate(context)!;
    const queue = await generateDecisionQueue('test_run', [
      { context, result: applyNowResult }
    ]);

    const strategy = await generateWeeklyStrategy('test_run', queue);
    expect(strategy.jobsToApplyToday.length).toBe(1);
    expect(strategy.highestPriorityCompanies).toContain('TestCo');
    expect(strategy.remoteOpportunities.length).toBe(1);
  });
});
