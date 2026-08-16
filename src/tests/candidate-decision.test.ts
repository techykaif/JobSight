import { describe, it, expect } from 'vitest';
import { evaluateCandidateDecision } from '../lib/candidate-decision/engine.js';
import type { CandidateFitSignal } from '../lib/candidate-fit/engine.js';
import type { DecisionType } from '../lib/decision/interfaces.js';
import type { GeographicEligibilityResult } from '../lib/geographic-eligibility/evaluator.js';

describe('Candidate Decision Engine (D1.7.5)', () => {

  const defaultFit = (level: string): CandidateFitSignal => ({
    level: level as any,
    score: 80,
    dimensions: { experience: 100, role: 100, skills: 80 },
    matchedSkills: [],
    missingSkills: [],
    reasons: []
  });

  const geoEligible: GeographicEligibilityResult = { eligibilityStatus: 'ELIGIBLE', remoteScope: 'WORLDWIDE', eligibilityConfidence: 'HIGH', eligibilityReason: '' };
  const geoNotEligible: GeographicEligibilityResult = { eligibilityStatus: 'NOT_ELIGIBLE', remoteScope: 'WORLDWIDE', eligibilityConfidence: 'HIGH', eligibilityReason: '' };
  const geoNeedsVerification: GeographicEligibilityResult = { eligibilityStatus: 'NEEDS_VERIFICATION', remoteScope: 'WORLDWIDE', eligibilityConfidence: 'LOW', eligibilityReason: '' };

  it('1. B6 NOT_ELIGIBLE overrides perfect fit → INELIGIBLE', () => {
    const res = evaluateCandidateDecision(true, defaultFit('strong'), 'APPLY_NOW', geoNotEligible);
    expect(res.finalDecision).toBe('INELIGIBLE');
    expect(res.primaryReason).toContain('Geographic eligibility restriction');
  });

  it('2. Profile-less run → INSUFFICIENT_EVIDENCE', () => {
    const res = evaluateCandidateDecision(false, null, 'APPLY_NOW', geoEligible);
    expect(res.finalDecision).toBe('INSUFFICIENT_EVIDENCE');
    expect(res.primaryReason).toContain('No candidate profile snapshot exists');
  });

  it('3. B7 IGNORE + strong fit → SKIP', () => {
    const res = evaluateCandidateDecision(true, defaultFit('strong'), 'IGNORE', geoEligible);
    expect(res.finalDecision).toBe('SKIP');
    expect(res.primaryReason).toContain('explicitly negative');
  });

  it('4. weak fit + favorable B7 → SKIP', () => {
    const res = evaluateCandidateDecision(true, defaultFit('weak'), 'APPLY_NOW', geoEligible);
    expect(res.finalDecision).toBe('SKIP');
    expect(res.primaryReason).toContain('Candidate fit is weak');
  });

  it('5. B6 NEEDS_VERIFICATION → REVIEW', () => {
    const res = evaluateCandidateDecision(true, defaultFit('strong'), 'APPLY_NOW', geoNeedsVerification);
    expect(res.finalDecision).toBe('REVIEW');
    expect(res.primaryReason).toContain('Geographic eligibility requires verification');
  });

  it('6. Candidate Fit insufficient_evidence → REVIEW', () => {
    const res = evaluateCandidateDecision(true, defaultFit('insufficient_evidence'), 'APPLY_NOW', geoEligible);
    expect(res.finalDecision).toBe('REVIEW');
    expect(res.primaryReason).toContain('Insufficient candidate evidence');
  });

  it('7. Candidate Fit partial → REVIEW', () => {
    const res = evaluateCandidateDecision(true, defaultFit('partial'), 'APPLY_NOW', geoEligible);
    expect(res.finalDecision).toBe('REVIEW');
    expect(res.primaryReason).toContain('Partial candidate fit');
  });

  it('8. strong fit + B7 MONITOR → REVIEW', () => {
    const res = evaluateCandidateDecision(true, defaultFit('strong'), 'MONITOR', geoEligible);
    expect(res.finalDecision).toBe('REVIEW');
    expect(res.primaryReason).toContain('Market opportunity requires caution');
  });

  it('9. strong fit + B7 WAIT → REVIEW', () => {
    const res = evaluateCandidateDecision(true, defaultFit('strong'), 'WAIT', geoEligible);
    expect(res.finalDecision).toBe('REVIEW');
    expect(res.primaryReason).toContain('Market opportunity requires caution');
  });

  it('10. strong fit + B7 RESEARCH_MORE → REVIEW', () => {
    const res = evaluateCandidateDecision(true, defaultFit('strong'), 'RESEARCH_MORE', geoEligible);
    expect(res.finalDecision).toBe('REVIEW');
    expect(res.primaryReason).toContain('Market opportunity requires caution');
  });

  it('11. good fit + favorable B7 + eligible → APPLY', () => {
    const res = evaluateCandidateDecision(true, defaultFit('good'), 'APPLY_THIS_WEEK', geoEligible);
    expect(res.finalDecision).toBe('APPLY');
    expect(res.primaryReason).toContain('Strong candidate fit and favorable market opportunity');
  });

  it('12. strong fit + favorable B7 + eligible → APPLY', () => {
    const res = evaluateCandidateDecision(true, defaultFit('strong'), 'APPLY_NOW', geoEligible);
    expect(res.finalDecision).toBe('APPLY');
    expect(res.primaryReason).toContain('Strong candidate fit and favorable market opportunity');
  });

  it('13. conflicting signals behave deterministically (geo veto wins)', () => {
    const res = evaluateCandidateDecision(true, defaultFit('weak'), 'IGNORE', geoNotEligible);
    expect(res.finalDecision).toBe('INELIGIBLE');
  });

  it('14. repeated evaluation produces identical output', () => {
    const res1 = evaluateCandidateDecision(true, defaultFit('good'), 'APPLY_NOW', geoEligible);
    const res2 = evaluateCandidateDecision(true, defaultFit('good'), 'APPLY_NOW', geoEligible);
    expect(res1).toEqual(res2);
  });

  it('15. profile-less run does not throw', () => {
    expect(() => evaluateCandidateDecision(false, null, 'APPLY_NOW', geoEligible)).not.toThrow();
  });

  it('16. missing optional signal does not corrupt unrelated decisions', () => {
    const res = evaluateCandidateDecision(true, null, null, geoEligible);
    expect(res.finalDecision).toBe('REVIEW');
  });

});
