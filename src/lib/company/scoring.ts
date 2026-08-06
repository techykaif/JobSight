import type { CompanyResearch } from './schema.js';

export const COMPANY_SCORING_VERSION = 'company_v1';
export const HIRING_MOMENTUM_VERSION = 'hiring_momentum_v1';
export const OPPORTUNITY_V2_VERSION = 'opportunity_v2';

export function calculateCompanyScores(research: CompanyResearch | null) {
  let companyScore = 50;
  let hiringMomentum = 50;
  let confidence = 0.2; // base confidence if no research

  if (research) {
    confidence = 0.4;
    
    // Evaluate Sources for Confidence
    const officialSources = research.sources.filter(s => 
      ['OFFICIAL_WEBSITE', 'OFFICIAL_CAREERS', 'OFFICIAL_ANNOUNCEMENT', 'REGULATORY'].includes(s.type)
    );
    if (officialSources.length > 0) confidence += 0.3;
    if (research.companyProfile.employeeCountMin !== null && research.companyProfile.employeeCountMin !== undefined) confidence += 0.1;
    if (research.hiring.currentOpenings !== null && research.hiring.currentOpenings !== undefined) confidence += 0.2;

    // --- Hiring Momentum ---
    let momentumScore = 50;
    
    // Positive Signals
    if (research.hiring.currentOpenings && research.hiring.currentOpenings > 5) momentumScore += 10;
    if (research.hiring.currentOpenings && research.hiring.currentOpenings > 20) momentumScore += 10;
    if (research.hiring.engineeringOpenings && research.hiring.engineeringOpenings > 0) momentumScore += 15;
    if (research.hiring.recent30dPostings && research.hiring.recent30dPostings > 0) momentumScore += 15;
    
    const expansionFacts = research.signals.expansionSignals.length;
    momentumScore += (expansionFacts * 5);

    // Negative Signals
    const contractionFacts = research.signals.contractionSignals.length;
    momentumScore -= (contractionFacts * 10);
    
    if (research.layoffs?.recentLayoffEvidence && research.layoffs.recentLayoffEvidence.length > 0) {
      momentumScore -= 30; // heavy penalty for recent layoffs
    }

    hiringMomentum = Math.max(0, Math.min(100, Math.round(momentumScore)));

    // --- Company Score ---
    let compScore = 50;
    
    // Stability & Profile
    const stabilityFacts = research.signals.stabilitySignals.length;
    compScore += (stabilityFacts * 5);
    
    if (research.companyProfile.employeeCountMin) {
      if (research.companyProfile.employeeCountMin > 100) compScore += 10;
      if (research.companyProfile.employeeCountMin > 1000) compScore += 10;
    }
    
    if (research.funding?.amount) {
      compScore += 5; // Has funding info
    }

    // Remote compatibility
    const remoteFacts = research.signals.remoteSignals.length;
    compScore += (remoteFacts * 5);
    if (research.hiring.remoteOpenings && research.hiring.remoteOpenings > 0) {
      compScore += 10;
    }

    // Blend some momentum into company score as well
    compScore += (expansionFacts * 5);
    compScore -= (contractionFacts * 10);
    if (research.layoffs?.recentLayoffEvidence && research.layoffs.recentLayoffEvidence.length > 0) {
      compScore -= 20;
    }
    
    companyScore = Math.max(0, Math.min(100, Math.round(compScore)));
  }

  return {
    companyScore,
    hiringMomentum,
    confidence: Math.max(0, Math.min(1, confidence))
  };
}

export function calculateOpportunityV2(
  opportunityV1: number,
  companyScore: number,
  hiringMomentum: number
) {
  // Opportunity V2 calculation
  // Candidate/Job Fit should remain dominant (60%)
  // Company Intelligence (20%)
  // Hiring Momentum (20%)
  
  // Example conceptual weighting:
  const weightV1 = 0.6;
  const weightCompany = 0.2;
  const weightMomentum = 0.2;

  const v2 = (opportunityV1 * weightV1) + (companyScore * weightCompany) + (hiringMomentum * weightMomentum);
  
  // CRITICAL: Company attractiveness must NEVER rescue a fundamentally unqualified candidate.
  // If Opportunity V1 was below CONSIDER threshold (< 50), V2 MUST NOT cross it.
  let finalV2 = Math.round(v2);

  if (opportunityV1 < 50 && finalV2 >= 50) {
    finalV2 = 49; // Cap at SKIP
  }

  return Math.max(0, Math.min(100, finalV2));
}

export function calculateApplicationPriority(
  opportunityV2: number,
  hiringMomentum: number,
  confidence: number
) {
  // Simple heuristic for application priority
  const priority = (opportunityV2 * 0.7) + (hiringMomentum * 0.2) + (confidence * 10);
  return Math.max(0, Math.min(100, Math.round(priority)));
}
