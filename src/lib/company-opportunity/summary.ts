import type { CompanyOpportunitySignal, CompanyOpportunityResult, CompanyOutlookResult, CompanyOpportunitySummary } from './interfaces';

export function generateSummary(
  signals: CompanyOpportunitySignal[],
  result: CompanyOpportunityResult,
  outlook: CompanyOutlookResult
): CompanyOpportunitySummary {
  let remoteHiring = 'Unknown';
  let engineeringHiring = 'Unknown';
  let competition = 'Unknown';
  let authenticity = 'Verified';

  for (const sig of signals) {
    if (sig.type === 'REMOTE_HIRING' && sig.value > 0) {
      remoteHiring = 'Active';
    }
    if (sig.type === 'ENGINEERING_HIRING' && sig.value > 0) {
      engineeringHiring = sig.value > 3 ? 'Strong' : 'Active';
    }
    if (sig.type === 'COMPETITION_SCORE') {
      if (sig.value <= 30) competition = 'Low';
      else if (sig.value >= 70) competition = 'High';
      else competition = 'Medium';
    }
  }

  return {
    outlook: result.level,
    hiringTrend: outlook.trend,
    remoteHiring,
    engineeringHiring,
    competition,
    authenticity,
    evidenceCount: signals.length,
    confidence: result.confidence
  };
}
