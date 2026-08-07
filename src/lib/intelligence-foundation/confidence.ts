import type { NormalizedEvidence, ConfidenceResult } from './interfaces';

export function calculateConfidence(evidenceList: NormalizedEvidence[]): ConfidenceResult {
  let score = 50; // base score
  const factors: string[] = [];

  const hasSalary = evidenceList.some(e => e.category === 'SALARY');
  if (hasSalary) {
    score += 15;
    factors.push('Salary data is present (+15)');
  } else {
    score -= 10;
    factors.push('Salary data is missing (-10)');
  }

  const hasRemote = evidenceList.some(e => e.category === 'REMOTE');
  if (hasRemote) {
    score += 10;
    factors.push('Remote policy is known (+10)');
  }

  const hasRequirements = evidenceList.some(e => e.category === 'REQUIREMENTS');
  if (hasRequirements) {
    score += 15;
    factors.push('Requirements are well defined (+15)');
  }

  const avgEvidenceConfidence = evidenceList.reduce((acc, e) => acc + e.confidence, 0) / (evidenceList.length || 1);
  if (avgEvidenceConfidence >= 90) {
    score += 10;
    factors.push('High confidence in extracted evidence (+10)');
  }

  score = Math.max(0, Math.min(100, score));

  return {
    score: Math.round(score),
    factors
  };
}
