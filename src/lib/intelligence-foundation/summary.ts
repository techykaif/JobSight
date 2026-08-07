import type { NormalizedEvidence, ConfidenceResult, SummaryResult } from './interfaces';

export function generateSummary(
  evidenceList: NormalizedEvidence[],
  confidenceResult: ConfidenceResult,
  baseOpportunityScore: number = 50
): SummaryResult {
  const checklist: string[] = [];

  evidenceList.forEach(e => {
    if (e.weight >= 2) {
      checklist.push(`✓ ${e.title}`);
    }
  });

  // Deduplicate
  const uniqueChecklist = Array.from(new Set(checklist));

  return {
    opportunityScore: baseOpportunityScore,
    confidence: confidenceResult.score,
    evidenceChecklist: uniqueChecklist.slice(0, 7) // Keep top 7 points
  };
}
