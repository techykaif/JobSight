import type { ApplicationIntelligenceSignal, ApplicationIntelligenceSummary, ApplicationIntelligenceResult } from './interfaces';
import type { ApplicationRecommendationAction } from './types';

export function generateApplicationSummary(
  signals: ApplicationIntelligenceSignal[],
  result: ApplicationIntelligenceResult
): { summary: ApplicationIntelligenceSummary, recommendation: ApplicationRecommendationAction } {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const riskFactors: string[] = [];
  let missingSkills: string[] = [];

  let isMissingCrucialSkills = false;

  for (const sig of signals) {
    if (sig.type === 'QUALIFICATION_MATCH') {
      if (sig.weight > 0) strengths.push('Strong Qualification Match');
      else if (sig.weight < 0) weaknesses.push('Weak Qualification Match');
    }
    if (sig.type === 'SKILL_MATCH') {
      missingSkills = sig.value || [];
      if (missingSkills.length === 0) strengths.push('All Required Skills Met');
      else if (missingSkills.length > 3) {
        weaknesses.push('Missing Multiple Key Skills');
        isMissingCrucialSkills = true;
      } else {
        weaknesses.push('Missing Some Preferred Skills');
      }
    }
    if (sig.type === 'COMPETITION_SCORE') {
      if (sig.weight > 0) strengths.push('Low Competition Opportunity');
      else if (sig.weight < 0) riskFactors.push('High Competition Role');
    }
    if (sig.type === 'COMPANY_OPPORTUNITY') {
      if (sig.weight > 0) strengths.push('Excellent Company Opportunity');
      else if (sig.weight < 0) riskFactors.push('Poor Company Outlook or Rating');
    }
    if (sig.type === 'DISCOVERY_INTELLIGENCE') {
      if (sig.weight > 0) strengths.push('High Quality Discovery Source');
    }
  }

  let recommendation: ApplicationRecommendationAction = 'Skip Application';

  if (result.readinessLevel === 'Ready Now') {
    recommendation = 'Apply Immediately';
  } else if (result.readinessLevel === 'Almost Ready') {
    recommendation = 'Customize Resume First';
  } else if (result.readinessLevel === 'Needs Improvement') {
    if (isMissingCrucialSkills) recommendation = 'Upskill Before Applying';
    else recommendation = 'Customize Resume First';
  } else {
    recommendation = 'Skip Application';
  }

  return {
    summary: {
      strengths,
      weaknesses,
      missingSkills,
      riskFactors
    },
    recommendation
  };
}
