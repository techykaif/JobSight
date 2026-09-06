import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '../lib/db/client.js';
import * as schema from '../lib/db/schema.js';
import { evaluateGeographicEligibility } from '../lib/geographic-eligibility/evaluator.js';
import { DuplicateDetectionProvider, AggregatorSourceProvider } from '../lib/discovery-intelligence/providers/signals.js';

vi.mock('../lib/db/client.js', () => ({
  db: {
    select: vi.fn(),
  }
}));

describe('Phase A Correctness Fixes', () => {

  describe('Fix 2 - Geo "US" False Positive', () => {
    it('matches explicit US abbreviations safely', () => {
      // Must match 'us' when it's the specific target
      const res1 = evaluateGeographicEligibility('Remote', 'Looking for someone in the US to join our team.', 'REMOTE', 'us');
      expect(res1.eligibilityStatus).toBe('ELIGIBLE');

      const res2 = evaluateGeographicEligibility('Remote - US', 'Global company.', 'REMOTE', 'us');
      expect(res2.eligibilityStatus).toBe('ELIGIBLE');
      
      const res3 = evaluateGeographicEligibility('Anywhere', 'Must reside in the U.S. for tax reasons.', 'REMOTE', 'us');
      expect(res3.eligibilityStatus).toBe('ELIGIBLE');
    });

    it('rejects ordinary pronoun "us" when candidate is in north america region', () => {
      const res1 = evaluateGeographicEligibility('Remote', 'Please contact us for more info. Join us today!', 'REMOTE', 'canada');
      expect(res1.eligibilityStatus).not.toBe('ELIGIBLE');
      
      const res2 = evaluateGeographicEligibility('Austin, TX', 'Come visit us', 'ONSITE', 'us');
      // Should not consider "us" pronoun as the location "us"
      expect(res2.eligibilityStatus).not.toBe('ELIGIBLE');
    });
    
    it('preserves existing worldwide exclusion logic', () => {
      const res1 = evaluateGeographicEligibility('Remote', 'Worldwide except US.', 'REMOTE', 'us');
      expect(res1.eligibilityStatus).toBe('NOT_ELIGIBLE');
    });
  });

  describe('Fix 3 - Duplicate Detection Company Scoping', () => {
    it('does not penalize same-title jobs across different companies', async () => {
      const provider = new DuplicateDetectionProvider();
      const context = {
        job: { id: 'job-1', companyId: 'comp-A', canonicalTitle: 'Software Engineer' },
        similarJobsInRun: [
          { id: 'job-1', companyId: 'comp-A', canonicalTitle: 'Software Engineer' },
          { id: 'job-2', companyId: 'comp-B', canonicalTitle: 'Software Engineer' }
        ]
      } as any;

      const sig = await provider.extractSignal(context);
      // Value should be 0 since the other job is at comp-B
      expect(sig?.value).toBe(0);
      expect(sig?.weight).toBe(10);
    });

    it('penalizes same-title jobs at the same company', async () => {
      const provider = new DuplicateDetectionProvider();
      const context = {
        job: { id: 'job-1', companyId: 'comp-A', canonicalTitle: 'Software Engineer' },
        similarJobsInRun: [
          { id: 'job-1', companyId: 'comp-A', canonicalTitle: 'Software Engineer' },
          { id: 'job-2', companyId: 'comp-A', canonicalTitle: 'Software Engineer' }
        ]
      } as any;

      const sig = await provider.extractSignal(context);
      expect(sig?.value).toBe(1);
      expect(sig?.weight).toBe(-15);
    });
  });

  describe('Fix 4 - RSS Type Typo', () => {
    it('recognizes RSS source correctly', async () => {
      const provider = new AggregatorSourceProvider();
      const context = {
        source: { sourceType: 'RSS' }
      } as any;
      const sig = await provider.extractSignal(context);
      expect(sig?.weight).toBe(-10);
    });
  });
});
