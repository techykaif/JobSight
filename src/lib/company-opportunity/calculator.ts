import type { CompanyOpportunitySignal, CompanyOpportunityResult, CompanyOutlookResult } from './interfaces';
import type { CompanyOpportunityLevel, CompanyHiringTrend, CompanyHiringStability } from './types';

export function calculateOpportunity(
  signals: CompanyOpportunitySignal[],
  baseConfidence: number
): { result: CompanyOpportunityResult, outlook: CompanyOutlookResult } {
  let score = 40; // Base score (Average)
  let momentum = 30;

  for (const signal of signals) {
    score += signal.weight;
    
    // Calculate momentum based on specific signals
    if (signal.type === 'NUMBER_OF_ACTIVE_ROLES' && signal.value > 5) momentum += 20;
    if (signal.type === 'POSTING_FRESHNESS' && signal.value > 0) momentum += 25;
  }

  score = Math.max(0, Math.min(100, score));
  momentum = Math.max(0, Math.min(100, momentum));

  let level: CompanyOpportunityLevel = 'Average';
  if (score <= 20) level = 'Weak';
  else if (score <= 40) level = 'Average';
  else if (score <= 60) level = 'Good';
  else if (score <= 80) level = 'Strong';
  else level = 'Excellent';

  let trend: CompanyHiringTrend = 'Unknown';
  if (momentum > 70) trend = 'Growing';
  else if (momentum > 40) trend = 'Stable';
  else if (momentum > 20) trend = 'Slowing';
  
  let stability: CompanyHiringStability = 'Medium';
  if (score > 60) stability = 'High';
  else if (score < 30) stability = 'Low';

  let confidence = baseConfidence;
  if (signals.length < 2) confidence -= 20;
  if (signals.length > 5) confidence += 10;

  confidence = Math.max(0, Math.min(100, confidence));

  return {
    result: {
      score,
      level,
      confidence
    },
    outlook: {
      trend,
      stability,
      momentum
    }
  };
}
