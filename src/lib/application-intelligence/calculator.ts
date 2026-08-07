import type { ApplicationIntelligenceSignal, ApplicationIntelligenceResult } from './interfaces';
import type { ApplicationReadinessLevel } from './types';

export function calculateApplicationIntelligence(
  signals: ApplicationIntelligenceSignal[],
  baseConfidence: number
): ApplicationIntelligenceResult {
  let score = 50; // Neutral base

  for (const signal of signals) {
    score += signal.weight;
  }

  score = Math.max(0, Math.min(100, score));

  let readinessLevel: ApplicationReadinessLevel = 'Needs Improvement';
  if (score >= 80) readinessLevel = 'Ready Now';
  else if (score >= 60) readinessLevel = 'Almost Ready';
  else if (score >= 40) readinessLevel = 'Needs Improvement';
  else readinessLevel = 'Not Recommended';

  let confidence = baseConfidence;
  if (signals.length < 3) confidence -= 20;
  if (signals.length >= 5) confidence += 10;
  confidence = Math.max(0, Math.min(100, confidence));

  return {
    score,
    readinessLevel,
    confidence
  };
}
