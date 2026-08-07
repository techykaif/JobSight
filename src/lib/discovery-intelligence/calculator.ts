import type { DiscoveryIntelligenceSignal, DiscoveryIntelligenceResult } from './interfaces';
import type { DiscoveryIntelligenceLevel } from './types';

export function calculateDiscoveryIntelligence(
  signals: DiscoveryIntelligenceSignal[],
  baseConfidence: number
): DiscoveryIntelligenceResult {
  let score = 40; // Base score (Standard)
  
  for (const signal of signals) {
    score += signal.weight;
  }

  score = Math.max(0, Math.min(100, score));

  let level: DiscoveryIntelligenceLevel = 'Standard';
  if (score <= 20) level = 'Weak';
  else if (score <= 40) level = 'Standard';
  else if (score <= 60) level = 'Strong';
  else if (score <= 80) level = 'Excellent';
  else level = 'Exceptional';

  let confidence = baseConfidence;
  if (signals.length < 2) confidence -= 20;
  if (signals.length > 3) confidence += 10;
  
  // High uniqueness increases confidence in discovery value
  const duplicateSignal = signals.find(s => s.type === 'DUPLICATE_DETECTION');
  if (duplicateSignal && duplicateSignal.value === 0) confidence += 10;

  confidence = Math.max(0, Math.min(100, confidence));

  return {
    score,
    level,
    confidence
  };
}
