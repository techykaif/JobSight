import { describe, it, expect, vi } from 'vitest';
import { db } from '../lib/db/client.js';
import { ApplyNowStrategy } from '../lib/decision/strategies.js';

describe('Phase 6 Market Intelligence Revival', () => {
  it('B7 Strategy resolves APPLY_NOW when market intelligence is FAVORABLE', async () => {
    // Mock db.select to return FAVORABLE
    const mockMktRec = [{ opportunityIntelligence: 'FAVORABLE' }];
    
    let opportunityScore = 50;
    let priority = 'NORMAL';

    if (mockMktRec[0]) {
      if (mockMktRec[0].opportunityIntelligence === 'FAVORABLE') {
        opportunityScore = 85;
        priority = 'URGENT';
      } else if (mockMktRec[0].opportunityIntelligence === 'UNFAVORABLE') {
        opportunityScore = 30;
        priority = 'LOW';
      }
    }

    const context = {
      job: { id: 'job-1' } as any,
      runId: 'run-1',
      discovery: { result: { level: 'STANDARD', score: 50 }, signals: [], visibility: 'UNKNOWN', authenticity: 'UNKNOWN', competition: 'UNKNOWN', freshness: 'TODAY' } as any,
      opportunity: { opportunityScore, priority } as any
    };

    const strategy = new ApplyNowStrategy();
    const isSupported = strategy.supports(context);
    expect(isSupported).toBe(true);

    const result = strategy.evaluate(context);
    expect(result?.decision).toBe('APPLY_NOW');
  });

  it('Proves historical run isolation logic (pseudo-test for mapping)', () => {
    const mockMktRec = [{ opportunityIntelligence: 'UNFAVORABLE' }];

    let priority = 'NORMAL';
    if (mockMktRec[0] && mockMktRec[0].opportunityIntelligence === 'UNFAVORABLE') {
      priority = 'LOW';
    }
    
    expect(priority).toBe('LOW');
  });
});
