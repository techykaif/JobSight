import type { CompetitionSignal, CompetitionResult } from './interfaces';
import type { CompetitionLevel } from './types';

export function calculateCompetition(
  signals: CompetitionSignal[],
  foundationConfidence: number
): CompetitionResult {
  // Base competition score (average competition assumption)
  let score = 40;

  // Aggregate weights
  for (const signal of signals) {
    score += signal.weight;
  }

  // Constrain between 0 and 100
  score = Math.max(0, Math.min(100, score));

  // Determine Level
  let level: CompetitionLevel = 'Medium';
  if (score <= 20) level = 'Very Low';
  else if (score <= 40) level = 'Low';
  else if (score <= 60) level = 'Medium';
  else if (score <= 80) level = 'High';
  else level = 'Very High';

  // Confidence inherits heavily from Foundation, but we might penalize if we have few signals
  let confidence = foundationConfidence;
  if (signals.length < 2) {
    confidence -= 20; // Hard to be confident with almost no competition signals
  } else if (signals.length >= 4) {
    confidence += 10;
  }

  confidence = Math.max(0, Math.min(100, confidence));

  return {
    score,
    level,
    confidence
  };
}
