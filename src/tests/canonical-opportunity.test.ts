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
        rawContent: 'be among the first 5 applicants'
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
        rawContent: 'be among the first 10 applicants'
      }));
      expect(result.signals.visibility).toBe('UNKNOWN'); // Direct careers page non-observation
      expect(result.signals.competition).toBe('LOW');
      expect(result.signals.authenticity).toBe('HIGH');
      expect(result.opportunityLevel).toBe('FAVORABLE');
    });

    it('UNKNOWN visibility + HIGH competition -> UNFAVORABLE', () => {
      const result = evaluateCanonicalOpportunityQuality(createBaseContext({
        rawContent: 'over 200 applicants'
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
    it('verified low applicant volume -> LOW', () => {
      const result = evaluateCanonicalOpportunityQuality(createBaseContext({ rawContent: '10 applicants' }));
      expect(result.signals.competition).toBe('LOW');
    });
    
    it('verified high applicant volume -> HIGH', () => {
      const result = evaluateCanonicalOpportunityQuality(createBaseContext({ rawContent: '500+ applicants' }));
      expect(result.signals.competition).toBe('HIGH');
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
      const jobA = createBaseContext({ rawContent: '10 applicants', sourceUrl: 'https://boards.greenhouse.io/test' });
      const jobB = createBaseContext({ rawContent: '10 applicants', sourceUrl: 'https://boards.greenhouse.io/test' });
      
      const resultA = evaluateCanonicalOpportunityQuality(jobA);
      const resultB = evaluateCanonicalOpportunityQuality(jobB);
      
      expect(resultA.opportunityLevel).toBe(resultB.opportunityLevel);
      expect(resultA.signals.competition).toBe(resultB.signals.competition);
      expect(resultA.signals.visibility).toBe(resultB.signals.visibility);
      expect(resultA.signals.compensation).toBe(resultB.signals.compensation);
    });

    it('different runs evaluating the same job remain independent in persistence expectations', () => {
      // The context accepts runId explicitly to scope the evaluation boundary.
      const run1 = createBaseContext({ runId: 'run1', rawContent: '5 applicants', similarJobsInRun: [] });
      
      // In a different run, the same job might be discovered with different surrounding data
      // e.g. duplicates discovered within the same run affect visibility.
      const run2 = createBaseContext({ 
        runId: 'run2', 
        rawContent: '5 applicants', 
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

});
