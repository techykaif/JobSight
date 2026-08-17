import { describe, it, expect } from 'vitest';
import { VisibilityAnalyzer, CompetitionAnalyzer, HiringFrictionAnalyzer, OpportunityIntelligenceEvaluator } from '../lib/intelligence/market/analyzers.js';
import type { MarketIntelligenceContext } from '../lib/intelligence/market/interfaces.js';

describe('Market Intelligence Engine', () => {

  describe('VisibilityAnalyzer', () => {
    it('evaluates direct ATS source with no duplicates as LOW visibility', () => {
      const analyzer = new VisibilityAnalyzer();
      const ctx: MarketIntelligenceContext = {
        job: { id: 'j1', title: 'Engineer', companyName: 'Corp', sourceUrl: 'https://jobs.lever.co/corp' } as any,
        runId: 'r1',
        sourceProviderType: 'LEVER',
        sourceUrl: 'https://jobs.lever.co/corp',
        similarJobsInRun: []
      };

      const res = analyzer.analyze(ctx);
      expect(res.level).toBe('LOW');
      expect(res.evidence.directSource).toBe(true);
      expect(res.evidence.mainstreamAggregatorPresence).toBe(false);
      expect(res.confidence).toBe('MEDIUM');
    });

    it('evaluates mainstream aggregator as HIGH visibility', () => {
      const analyzer = new VisibilityAnalyzer();
      const ctx: MarketIntelligenceContext = {
        job: { id: 'j1', title: 'Engineer', companyName: 'Corp' } as any,
        runId: 'r1',
        sourceProviderType: 'SEARCH_ENGINE',
        sourceUrl: 'https://www.linkedin.com/jobs/view/123',
        similarJobsInRun: []
      };

      const res = analyzer.analyze(ctx);
      expect(res.level).toBe('HIGH');
      expect(res.evidence.mainstreamAggregatorPresence).toBe(true);
      expect(res.confidence).toBe('HIGH');
    });

    it('handles multiple discovery channels / duplicate jobs', () => {
      const analyzer = new VisibilityAnalyzer();
      const ctx: MarketIntelligenceContext = {
        job: { id: 'j1', title: 'Engineer', companyName: 'Corp', sourceUrl: 'https://jobs.lever.co/corp' } as any,
        runId: 'r1',
        sourceProviderType: 'LEVER',
        sourceUrl: 'https://jobs.lever.co/corp',
        similarJobsInRun: [
          { id: 'j2', title: 'Engineer', companyName: 'Corp', sourceUrl: 'https://otherboard.com' } as any
        ]
      };

      const res = analyzer.analyze(ctx);
      expect(res.evidence.duplicateCount).toBe(1);
      expect(res.evidence.discoverySourceCount).toBe(2);
      expect(res.level).toBe('MEDIUM'); // Direct source but duplicated
    });
  });

  describe('CompetitionAnalyzer & Applicant Volume', () => {
    it('extracts exact applicant count and evaluates as HIGH competition', () => {
      const analyzer = new CompetitionAnalyzer();
      const ctx: MarketIntelligenceContext = {
        job: { id: 'j1', title: 'Dev' } as any,
        runId: 'r1',
        rawContent: 'We are a great company. 120 applicants have applied so far. Apply now!'
      };
      const res = analyzer.analyze(ctx);
      expect(res.applicantVolume?.value).toBe(120);
      expect(res.applicantVolume?.isLowerBound).toBe(false);
      expect(res.level).toBe('HIGH');
    });

    it('extracts lower bound applicant count (+)', () => {
      const analyzer = new CompetitionAnalyzer();
      const ctx: MarketIntelligenceContext = {
        job: { id: 'j1', title: 'Dev' } as any,
        runId: 'r1',
        rawContent: 'Join our team. 250+ candidates.'
      };
      const res = analyzer.analyze(ctx);
      expect(res.applicantVolume?.value).toBe(250);
      expect(res.applicantVolume?.isLowerBound).toBe(true);
      expect(res.level).toBe('HIGH');
    });

    it('extracts "over X" lower bound applicant count', () => {
      const analyzer = new CompetitionAnalyzer();
      const ctx: MarketIntelligenceContext = {
        job: { id: 'j1', title: 'Dev' } as any,
        runId: 'r1',
        rawContent: 'Over 50 applicants.'
      };
      const res = analyzer.analyze(ctx);
      expect(res.applicantVolume?.value).toBe(50);
      expect(res.applicantVolume?.isLowerBound).toBe(true);
      expect(res.level).toBe('MEDIUM');
    });

    it('extracts "among the first X" count', () => {
      const analyzer = new CompetitionAnalyzer();
      const ctx: MarketIntelligenceContext = {
        job: { id: 'j1', title: 'Dev' } as any,
        runId: 'r1',
        rawContent: 'be among the first 25 applicants'
      };
      const res = analyzer.analyze(ctx);
      expect(res.applicantVolume?.value).toBe(25);
      expect(res.applicantVolume?.isLowerBound).toBe(true);
      expect(res.level).toBe('LOW'); // <= 30 is LOW
    });

    it('evaluates UNKNOWN when no evidence is found', () => {
      const analyzer = new CompetitionAnalyzer();
      const ctx: MarketIntelligenceContext = {
        job: { id: 'j1', title: 'Dev' } as any,
        runId: 'r1',
        rawContent: 'Just a normal job description with no stats.'
      };
      const res = analyzer.analyze(ctx);
      expect(res.applicantVolume).toBeUndefined();
      expect(res.level).toBe('UNKNOWN');
      expect(res.confidence).toBe('UNKNOWN');
    });
  });

  describe('HiringFrictionAnalyzer', () => {
    it('detects multiple friction signals and assigns HIGH friction', () => {
      const analyzer = new HiringFrictionAnalyzer();
      const ctx: MarketIntelligenceContext = {
        job: { id: 'j1', title: 'Dev' } as any,
        runId: 'r1',
        rawContent: 'Upload resume. Cover letter required. Sign in to apply. Complete assessment.'
      };
      const res = analyzer.analyze(ctx);
      expect(res.signals.resumeRequired).toBe(true);
      expect(res.signals.coverLetterRequired).toBe(true);
      expect(res.signals.accountRequired).toBe(true);
      expect(res.signals.assessmentRequired).toBe(true);
      expect(res.level).toBe('HIGH');
      expect(res.confidence).toBe('MEDIUM');
    });

    it('detects low friction', () => {
      const analyzer = new HiringFrictionAnalyzer();
      const ctx: MarketIntelligenceContext = {
        job: { id: 'j1', title: 'Dev' } as any,
        runId: 'r1',
        rawContent: 'Simple application. Upload resume. Nothing else. The text must be over 50 chars to be considered accessible so I will type more text here.'
      };
      const res = analyzer.analyze(ctx);
      expect(res.signals.resumeRequired).toBe(true);
      expect(res.signals.coverLetterRequired).toBe(false);
      expect(res.signals.accountRequired).toBe(false);
      expect(res.level).toBe('LOW');
      expect(res.confidence).toBe('MEDIUM');
    });

    it('handles inaccessible application pages as UNKNOWN', () => {
      const analyzer = new HiringFrictionAnalyzer();
      const ctx: MarketIntelligenceContext = {
        job: { id: 'j1', title: 'Dev' } as any,
        runId: 'r1',
        rawContent: '403 Forbidden'
      };
      const res = analyzer.analyze(ctx);
      expect(res.signals.accessible).toBe(false);
      expect(res.level).toBe('UNKNOWN');
      expect(res.confidence).toBe('LOW');
    });

    it('Workday provider + no account evidence -> accountRequired=false', () => {
      const analyzer = new HiringFrictionAnalyzer();
      const ctx: MarketIntelligenceContext = {
        job: { id: 'j1', title: 'Dev' } as any,
        runId: 'r1',
        sourceProviderType: 'WORKDAY',
        rawContent: 'Simple application. No account text anywhere here. This text is long enough to be accessible.'
      };
      const res = analyzer.analyze(ctx);
      expect(res.signals.accountRequired).toBe(false);
    });

    it('Workday provider + explicit account requirement in rawContent -> accountRequired=true', () => {
      const analyzer = new HiringFrictionAnalyzer();
      const ctx: MarketIntelligenceContext = {
        job: { id: 'j1', title: 'Dev' } as any,
        runId: 'r1',
        sourceProviderType: 'WORKDAY',
        rawContent: 'Please create an account to proceed with this application on workday.'
      };
      const res = analyzer.analyze(ctx);
      expect(res.signals.accountRequired).toBe(true);
    });

    it('Other ATS provider + no account evidence -> accountRequired=false', () => {
      const analyzer = new HiringFrictionAnalyzer();
      const ctx: MarketIntelligenceContext = {
        job: { id: 'j1', title: 'Dev' } as any,
        runId: 'r1',
        sourceProviderType: 'GREENHOUSE',
        rawContent: 'Simple greenhouse application. No account text. Must be long enough to be accessible text.'
      };
      const res = analyzer.analyze(ctx);
      expect(res.signals.accountRequired).toBe(false);
    });
  });

  describe('OpportunityIntelligenceEvaluator', () => {
    const evaluator = new OpportunityIntelligenceEvaluator();

    it('1. LOW visibility + UNKNOWN competition -> INSUFFICIENT_EVIDENCE', () => {
      const vis = { level: 'LOW', confidence: 'MEDIUM' } as any;
      const comp = { level: 'UNKNOWN', confidence: 'UNKNOWN' } as any;
      const fric = { level: 'UNKNOWN', confidence: 'UNKNOWN' } as any;

      expect(evaluator.evaluate(vis, comp, fric)).toBe('INSUFFICIENT_EVIDENCE');
    });

    it('2. LOW visibility + UNKNOWN competition + LOW friction -> NOT FAVORABLE (INSUFFICIENT_EVIDENCE)', () => {
      const vis = { level: 'LOW', confidence: 'MEDIUM' } as any;
      const comp = { level: 'UNKNOWN', confidence: 'UNKNOWN' } as any;
      const fric = { level: 'LOW', confidence: 'MEDIUM' } as any;

      expect(evaluator.evaluate(vis, comp, fric)).toBe('INSUFFICIENT_EVIDENCE');
    });

    it('3. LOW visibility + HIGH competition -> UNFAVORABLE', () => {
      const vis = { level: 'LOW', confidence: 'MEDIUM' } as any;
      const comp = { level: 'HIGH', confidence: 'HIGH' } as any;
      const fric = { level: 'LOW', confidence: 'MEDIUM' } as any;

      expect(evaluator.evaluate(vis, comp, fric)).toBe('UNFAVORABLE');
    });

    it('4. HIGH visibility + HIGH competition -> UNFAVORABLE', () => {
      const vis = { level: 'HIGH', confidence: 'HIGH' } as any;
      const comp = { level: 'HIGH', confidence: 'HIGH' } as any;
      const fric = { level: 'LOW', confidence: 'MEDIUM' } as any;

      expect(evaluator.evaluate(vis, comp, fric)).toBe('UNFAVORABLE');
    });

    it('5. LOW visibility + LOW competition -> FAVORABLE', () => {
      const vis = { level: 'LOW', confidence: 'MEDIUM' } as any;
      const comp = { level: 'LOW', confidence: 'HIGH' } as any;
      const fric = { level: 'LOW', confidence: 'MEDIUM' } as any;

      expect(evaluator.evaluate(vis, comp, fric)).toBe('FAVORABLE');
    });

    it('6. HIGH visibility + LOW competition -> FAVORABLE', () => {
      const vis = { level: 'HIGH', confidence: 'HIGH' } as any;
      const comp = { level: 'LOW', confidence: 'HIGH' } as any;
      const fric = { level: 'LOW', confidence: 'MEDIUM' } as any;

      expect(evaluator.evaluate(vis, comp, fric)).toBe('FAVORABLE');
    });

    it('7. LOW visibility + UNKNOWN competition + HIGH friction -> NOT FAVORABLE (INSUFFICIENT_EVIDENCE)', () => {
      const vis = { level: 'LOW', confidence: 'MEDIUM' } as any;
      const comp = { level: 'UNKNOWN', confidence: 'UNKNOWN' } as any;
      const fric = { level: 'HIGH', confidence: 'MEDIUM' } as any;

      expect(evaluator.evaluate(vis, comp, fric)).toBe('INSUFFICIENT_EVIDENCE');
    });

    it('11. Unknown competition never becomes LOW implicitly (Returns INSUFFICIENT_EVIDENCE)', () => {
      const vis = { level: 'MEDIUM', confidence: 'MEDIUM' } as any;
      const comp = { level: 'UNKNOWN', confidence: 'UNKNOWN' } as any;
      const fric = { level: 'MEDIUM', confidence: 'MEDIUM' } as any;

      expect(evaluator.evaluate(vis, comp, fric)).toBe('INSUFFICIENT_EVIDENCE');
    });

    it('12. Hidden/low visibility does not automatically become favorable (Returns INSUFFICIENT_EVIDENCE when comp is UNKNOWN)', () => {
      const vis = { level: 'LOW', confidence: 'HIGH' } as any;
      const comp = { level: 'UNKNOWN', confidence: 'UNKNOWN' } as any;
      const fric = { level: 'MEDIUM', confidence: 'MEDIUM' } as any;

      expect(evaluator.evaluate(vis, comp, fric)).toBe('INSUFFICIENT_EVIDENCE');
    });

  });
});
