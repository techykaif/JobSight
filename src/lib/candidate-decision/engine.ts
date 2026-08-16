import type { CandidateFitSignal } from '../candidate-fit/engine.js';
import type { DecisionType } from '../decision/interfaces.js';
import type { GeographicEligibilityResult } from '../geographic-eligibility/evaluator.js';

export type CandidateDecisionState = 'APPLY' | 'REVIEW' | 'SKIP' | 'INELIGIBLE' | 'INSUFFICIENT_EVIDENCE';

export interface CandidateDecisionResult {
  finalDecision: CandidateDecisionState;
  primaryReason: string;
}

export function evaluateCandidateDecision(
  hasProfileSnapshot: boolean,
  candidateFit: CandidateFitSignal | null | undefined,
  b7Decision: DecisionType | null | undefined,
  geoEligibility: GeographicEligibilityResult | null | undefined
): CandidateDecisionResult {
  
  // RULE A: Geographic Veto (Highest Precedence)
  if (geoEligibility?.eligibilityStatus === 'NOT_ELIGIBLE') {
    return {
      finalDecision: 'INELIGIBLE',
      primaryReason: 'Geographic eligibility restriction.'
    };
  }

  // RULE B: Profile-less Fallback
  if (!hasProfileSnapshot) {
    return {
      finalDecision: 'INSUFFICIENT_EVIDENCE',
      primaryReason: 'No candidate profile snapshot exists for this run.'
    };
  }

  // RULE C: Market Opportunity Veto
  if (b7Decision === 'IGNORE') {
    return {
      finalDecision: 'SKIP',
      primaryReason: 'B7 classified the opportunity as explicitly negative.'
    };
  }

  // RULE D: Candidate Fit Veto
  if (candidateFit?.level === 'weak') {
    return {
      finalDecision: 'SKIP',
      primaryReason: 'Candidate fit is weak.'
    };
  }

  // RULE E: Geographic Uncertainty
  if (geoEligibility?.eligibilityStatus === 'NEEDS_VERIFICATION') {
    return {
      finalDecision: 'REVIEW',
      primaryReason: 'Geographic eligibility requires verification.'
    };
  }

  // RULE F: Insufficient Candidate Evidence
  if (!candidateFit || candidateFit.level === 'insufficient_evidence') {
    return {
      finalDecision: 'REVIEW',
      primaryReason: 'Insufficient candidate evidence.'
    };
  }

  // RULE G: Partial Fit
  if (candidateFit.level === 'partial') {
    return {
      finalDecision: 'REVIEW',
      primaryReason: 'Partial candidate fit.'
    };
  }

  // RULE H: Cautionary Market Opportunity
  if (b7Decision === 'MONITOR' || b7Decision === 'WAIT' || b7Decision === 'RESEARCH_MORE') {
    return {
      finalDecision: 'REVIEW',
      primaryReason: 'Market opportunity requires caution/further review.'
    };
  }

  // RULE I: Apply (Alignment)
  if (
    geoEligibility?.eligibilityStatus === 'ELIGIBLE' &&
    (candidateFit.level === 'strong' || candidateFit.level === 'good') &&
    (b7Decision === 'APPLY_NOW' || b7Decision === 'APPLY_THIS_WEEK')
  ) {
    return {
      finalDecision: 'APPLY',
      primaryReason: 'Strong candidate fit and favorable market opportunity.'
    };
  }

  // Fallback for missing/unknown job intelligence or unhandled states
  return {
    finalDecision: 'REVIEW',
    primaryReason: 'Missing or conflicting intelligence signals.'
  };
}
