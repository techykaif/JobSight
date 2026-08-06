import type { Decision, HardFilterResult, QualificationResult, AgyRequirementAnalysis } from './schema.js';

export function makeDecision(
  hardFilter: HardFilterResult,
  scores: { opportunity: number; confidence: number; extremeExperienceGap?: boolean },
  analysis: AgyRequirementAnalysis | null
): { decision: Decision, reasons: string[] } {
  const reasons: string[] = [];

  if (!hardFilter.passed) {
    reasons.push(...hardFilter.reasons);
    return { decision: 'SKIP', reasons };
  }

  if (scores.extremeExperienceGap) {
    reasons.push('EXTREME_EXPERIENCE_GAP');
    return { decision: 'SKIP', reasons };
  }

  if (scores.opportunity >= 80) {
    reasons.push(`High opportunity score (${scores.opportunity}/100)`);
    return { decision: 'APPLY', reasons };
  }

  if (scores.opportunity >= 50) {
    if (scores.confidence < 0.6) {
      reasons.push(`Moderate score (${scores.opportunity}) with low confidence (${scores.confidence})`);
      return { decision: 'RESEARCH_REQUIRED', reasons };
    }
    reasons.push(`Moderate opportunity score (${scores.opportunity}/100)`);
    return { decision: 'CONSIDER', reasons };
  }

  reasons.push(`Low opportunity score (${scores.opportunity}/100)`);
  return { decision: 'SKIP', reasons };
}
