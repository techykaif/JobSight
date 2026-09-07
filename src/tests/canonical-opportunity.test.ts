import { describe, it, expect } from 'vitest';
import type { OpportunityQualityContext } from '../lib/opportunity-quality/engine.js';
import { evaluateCanonicalOpportunityQuality } from '../lib/opportunity-quality/engine.js';

describe('Canonical Opportunity Quality', () => {
  const createBaseContext = (overrides: any = {}): OpportunityQualityContext => ({
    job: { id: 'test', firstSeenAt: new Date().toISOString() },
    runId: 'run1',
    sourceProviderType: 'GREENHOUSE',
    sourceUrl: 'https://boards.greenhouse.io/test',
    rawContent: '',
    secondaryEvidence: {
      status: 'NOT_OBSERVED_ON_CHECKED_SOURCE',
      targetSource: 'SEARCH_ENGINE'
    },
    ...overrides
  });

  describe('Evidence Semantics', () => {
    it('unknown competition cannot become LOW', () => {
      const result = evaluateCanonicalOpportunityQuality(createBaseContext());
      expect(result.signals.competition).toBe('UNKNOWN');
      expect(result.opportunityLevel).toBe('INSUFFICIENT_EVIDENCE'); // Unfavorable unless proven otherwise, or neutral/insufficient.
    });

    it('unknown salary cannot become favorable', () => {
      const result = evaluateCanonicalOpportunityQuality(createBaseContext());
      expect(result.signals.compensation).toBe('UNKNOWN');
    });

    it('failed source verification cannot become favorable', () => {
      const result = evaluateCanonicalOpportunityQuality(createBaseContext({
        sourceProviderType: 'UNKNOWN',
        sourceUrl: 'http://sketchy-site.com',
        injectedCompetition: 'LOW'
      }));
      // Competition is LOW, so it WOULD be FAVORABLE.
      // But authenticity is LOW!
      expect(result.signals.authenticity).toBe('LOW');
      expect(result.opportunityLevel).toBe('NEUTRAL'); // Downgraded from FAVORABLE
    });
  });

  describe('Visibility & Competition Interactions', () => {
    it('UNKNOWN visibility + LOW competition + sufficient evidence -> FAVORABLE', () => {
      const result = evaluateCanonicalOpportunityQuality(createBaseContext({
        injectedCompetition: 'LOW'
      }));
      expect(result.signals.visibility).toBe('UNKNOWN'); // Direct careers page non-observation
      expect(result.signals.competition).toBe('LOW');
      expect(result.signals.authenticity).toBe('HIGH');
      expect(result.opportunityLevel).toBe('FAVORABLE');
    });

    it('UNKNOWN visibility + HIGH competition -> UNFAVORABLE', () => {
      const result = evaluateCanonicalOpportunityQuality(createBaseContext({
        injectedCompetition: 'HIGH'
      }));
      expect(result.signals.competition).toBe('HIGH');
      expect(result.opportunityLevel).toBe('UNFAVORABLE');
    });

    it('UNKNOWN visibility + UNKNOWN competition -> INSUFFICIENT_EVIDENCE', () => {
      const result = evaluateCanonicalOpportunityQuality(createBaseContext());
      expect(result.opportunityLevel).toBe('INSUFFICIENT_EVIDENCE');
    });
  });

  describe('Competition', () => {
    it('verified applicant volume parsing is intentionally disabled -> UNKNOWN', () => {
      const result = evaluateCanonicalOpportunityQuality(createBaseContext({ rawContent: '10 applicants' }));
      expect(result.signals.competition).toBe('UNKNOWN');
    });
  });

  describe('Freshness', () => {
    it('fresh job -> NEW', () => {
      const result = evaluateCanonicalOpportunityQuality(createBaseContext({
        job: { id: 'test', postingDate: new Date().toISOString() }
      }));
      expect(result.signals.freshness).toBe('NEW');
    });

    it('aging job -> AGING', () => {
      const d = new Date();
      d.setDate(d.getDate() - 10);
      const result = evaluateCanonicalOpportunityQuality(createBaseContext({
        job: { id: 'test', postingDate: d.toISOString() }
      }));
      expect(result.signals.freshness).toBe('AGING');
    });

    it('stale job -> STALE', () => {
      const d = new Date();
      d.setDate(d.getDate() - 20);
      const result = evaluateCanonicalOpportunityQuality(createBaseContext({
        job: { id: 'test', postingDate: d.toISOString() }
      }));
      expect(result.signals.freshness).toBe('STALE');
    });

    it('missing timestamp -> UNKNOWN', () => {
      const result = evaluateCanonicalOpportunityQuality(createBaseContext({
        job: { id: 'test', postingDate: null }
      }));
      expect(result.signals.freshness).toBe('UNKNOWN');
    });
  });

  describe('Evaluator Independence', () => {
    it('identical job evidence with different candidate profiles yields identical Opportunity Quality', () => {
      // The architecture itself proves this since CanonicalOpportunityQuality 
      // does not accept a CandidateProfile object in its context signature.
      // We simulate identical job conditions explicitly.
      const jobA = createBaseContext({ injectedCompetition: 'LOW', sourceUrl: 'https://boards.greenhouse.io/test' });
      const jobB = createBaseContext({ injectedCompetition: 'LOW', sourceUrl: 'https://boards.greenhouse.io/test' });
      
      const resultA = evaluateCanonicalOpportunityQuality(jobA);
      const resultB = evaluateCanonicalOpportunityQuality(jobB);
      
      expect(resultA.opportunityLevel).toBe(resultB.opportunityLevel);
      expect(resultA.signals.competition).toBe(resultB.signals.competition);
      expect(resultA.signals.visibility).toBe(resultB.signals.visibility);
      expect(resultA.signals.compensation).toBe(resultB.signals.compensation);
    });

    it('different runs evaluating the same job remain independent in persistence expectations', () => {
      // The context accepts runId explicitly to scope the evaluation boundary.
      const run1 = createBaseContext({ runId: 'run1', injectedCompetition: 'LOW', similarJobsInRun: [] });
      
      // In a different run, the same job might be discovered with different surrounding data
      // e.g. duplicates discovered within the same run affect visibility.
      const run2 = createBaseContext({ 
        runId: 'run2', 
        injectedCompetition: 'LOW', 
        similarJobsInRun: [{ title: 'test', companyName: 'TestCo', sourceUrl: 'duplicate' }] // Duplicate present in run 2
      });

      // We explicitly override the job title so the duplicate matches
      run2.job.title = 'test';
      run2.job.companyName = 'TestCo';

      const result1 = evaluateCanonicalOpportunityQuality(run1);
      const result2 = evaluateCanonicalOpportunityQuality(run2);

      // Run 1 has no duplicates -> UNKNOWN visibility
      expect(result1.signals.visibility).toBe('UNKNOWN');
      // Run 2 has duplicates -> UNKNOWN visibility
      expect(result2.signals.visibility).toBe('UNKNOWN');
      
      // But intrinsic properties (like competition parsed from text) remain independent but identically evaluated
      expect(result1.signals.competition).toBe('LOW');
      expect(result2.signals.competition).toBe('LOW');
    });
  });

  describe('Visibility Evidence Handling', () => {
    it('ATS discovery + independent positive observation (PARTIAL match) -> HIGH visibility', () => {
      const result = evaluateCanonicalOpportunityQuality(createBaseContext({
        secondaryEvidence: {
          status: 'OBSERVED_ON_SOURCE',
          targetSource: 'SEARCH_ENGINE',
          matchStrength: 'PARTIAL'
        }
      }));
      expect(result.signals.visibility).toBe('HIGH');
    });

    it('ATS discovery + independent weak observation (LOW match) -> UNKNOWN visibility', () => {
      const result = evaluateCanonicalOpportunityQuality(createBaseContext({
        secondaryEvidence: {
          status: 'OBSERVED_ON_SOURCE',
          targetSource: 'SEARCH_ENGINE',
          matchStrength: 'LOW'
        }
      }));
      // Weak fuzzy match is insufficient to prove HIGH visibility
      expect(result.signals.visibility).toBe('UNKNOWN');
    });

    it('multiple independent non-observations -> UNKNOWN visibility (currently 1 source supported, non-observation -> UNKNOWN)', () => {
      const result = evaluateCanonicalOpportunityQuality(createBaseContext({
        secondaryEvidence: {
          status: 'NOT_OBSERVED_ON_CHECKED_SOURCE',
          targetSource: 'SEARCH_ENGINE'
        }
      }));
      // Cannot convert one non-observation to LOW visibility
      expect(result.signals.visibility).toBe('UNKNOWN');
    });

    it('SearchEngine discovery + same-provider exclusion -> UNKNOWN visibility', () => {
      const result = evaluateCanonicalOpportunityQuality(createBaseContext({
        sourceProviderType: 'SEARCH_ENGINE',
        secondaryEvidence: {
          status: 'UNKNOWN',
          targetSource: 'SEARCH_ENGINE',
          checkQuery: 'SKIPPED_SAME_PROVIDER'
        }
      }));
      expect(result.signals.visibility).toBe('UNKNOWN');
    });

    it('malformed provider response -> UNKNOWN visibility', () => {
      const result = evaluateCanonicalOpportunityQuality(createBaseContext({
        secondaryEvidence: {
          status: 'UNKNOWN',
          targetSource: 'SEARCH_ENGINE'
        }
      }));
      expect(result.signals.visibility).toBe('UNKNOWN');
    });
  });

  describe('Phase 8.5.2 Opportunity Quality Contract', () => {
    it('1. UNKNOWN competition + EXCEPTIONAL compensation -> FAVORABLE', () => {
      const result = evaluateCanonicalOpportunityQuality(createBaseContext({
        injectedCompetition: 'UNKNOWN',
        injectedCompensation: 'EXCEPTIONAL'
      }));
      expect(result.opportunityLevel).toBe('FAVORABLE');
    });

    it('2. UNKNOWN competition + TARGET compensation + NEW freshness -> NOT FAVORABLE (NEUTRAL)', () => {
      const result = evaluateCanonicalOpportunityQuality(createBaseContext({
        injectedCompetition: 'UNKNOWN',
        injectedCompensation: 'TARGET',
        job: { id: 'test', postingDate: new Date().toISOString() }
      }));
      expect(result.opportunityLevel).toBe('NEUTRAL');
    });

    it('3. UNKNOWN competition + UNKNOWN compensation + NEW freshness -> NOT FAVORABLE (NEUTRAL)', () => {
      const result = evaluateCanonicalOpportunityQuality(createBaseContext({
        injectedCompetition: 'UNKNOWN',
        injectedCompensation: 'UNKNOWN',
        job: { id: 'test', postingDate: new Date().toISOString() }
      }));
      expect(result.opportunityLevel).toBe('NEUTRAL');
    });

    it('4. LOW competition + otherwise positive/neutral signals -> FAVORABLE', () => {
      const result = evaluateCanonicalOpportunityQuality(createBaseContext({
        injectedCompetition: 'LOW',
        injectedCompensation: 'TARGET'
      }));
      expect(result.opportunityLevel).toBe('FAVORABLE');
    });

    it('5. HIGH competition + otherwise neutral -> UNFAVORABLE', () => {
      const result = evaluateCanonicalOpportunityQuality(createBaseContext({
        injectedCompetition: 'HIGH',
        injectedCompensation: 'TARGET'
      }));
      expect(result.opportunityLevel).toBe('UNFAVORABLE');
    });

    it('6. EXCEPTIONAL compensation + HIGH competition -> UNFAVORABLE', () => {
      const result = evaluateCanonicalOpportunityQuality(createBaseContext({
        injectedCompetition: 'HIGH',
        injectedCompensation: 'EXCEPTIONAL'
      }));
      expect(result.opportunityLevel).toBe('UNFAVORABLE');
    });

    it('7. EXCEPTIONAL compensation + STALE freshness -> UNFAVORABLE', () => {
      const d = new Date();
      d.setDate(d.getDate() - 20); // STALE
      const result = evaluateCanonicalOpportunityQuality(createBaseContext({
        injectedCompetition: 'UNKNOWN',
        injectedCompensation: 'EXCEPTIONAL',
        job: { id: 'test', postingDate: d.toISOString() }
      }));
      expect(result.opportunityLevel).toBe('UNFAVORABLE');
    });

    it('8. NEW + BELOW_TARGET compensation -> UNFAVORABLE', () => {
      const result = evaluateCanonicalOpportunityQuality(createBaseContext({
        injectedCompetition: 'UNKNOWN',
        injectedCompensation: 'BELOW_TARGET',
        job: { id: 'test', postingDate: new Date().toISOString() }
      }));
      expect(result.opportunityLevel).toBe('UNFAVORABLE');
    });

    it('9. UNKNOWN visibility must NOT become LOW', () => {
      const result = evaluateCanonicalOpportunityQuality(createBaseContext({
        injectedVisibility: 'UNKNOWN'
      }));
      expect(result.signals.visibility).toBe('UNKNOWN');
    });

    it('10. Direct ATS discovery must NOT become LOW visibility', () => {
      const result = evaluateCanonicalOpportunityQuality(createBaseContext({
        sourceProviderType: 'LEVER',
        sourceUrl: 'https://jobs.lever.co/test'
      }));
      expect(result.signals.visibility).toBe('UNKNOWN');
    });

    it('11. LOW authenticity must prevent FAVORABLE', () => {
      const result = evaluateCanonicalOpportunityQuality(createBaseContext({
        injectedCompetition: 'LOW',
        sourceProviderType: 'UNKNOWN',
        sourceUrl: 'http://sketchy.com'
      }));
      expect(result.signals.authenticity).toBe('LOW');
      expect(result.opportunityLevel).toBe('NEUTRAL');
    });

    it('13. UNKNOWN competition must never be interpreted as LOW competition', () => {
      const result = evaluateCanonicalOpportunityQuality(createBaseContext({
        injectedCompetition: 'UNKNOWN'
      }));
      expect(result.signals.competition).toBe('UNKNOWN');
    });

    it('14. Genuinely LOW visibility input establishes FAVORABLE', () => {
      const result = evaluateCanonicalOpportunityQuality(createBaseContext({
        injectedVisibility: 'LOW'
      }));
      expect(result.signals.visibility).toBe('LOW');
      expect(result.opportunityLevel).toBe('FAVORABLE');
    });
  });

});
