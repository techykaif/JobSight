import type { DiscoveryIntelligenceOutput } from './interfaces.js';

export interface OpportunityIntelligenceOutput {
  opportunityScore: number; // 0-100
  priority: 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW' | 'IGNORE';
  recommendedAction: string;
}

export function calculateOpportunityIntelligence(
  discovery: DiscoveryIntelligenceOutput,
  // Other inputs like salary, qualification, company would go here in the future
  // e.g. salaryMatch: boolean, qualificationScore: number
): OpportunityIntelligenceOutput {
  
  let score = 50; // Base score
  let priority: OpportunityIntelligenceOutput['priority'] = 'NORMAL';
  let recommendedAction = 'Consider applying';

  // 1. Hidden Gem boost
  if (discovery.hiddenGem === 'VERY_HIGH') score += 20;
  else if (discovery.hiddenGem === 'HIGH') score += 10;
  
  // 2. Authenticity gating
  if (discovery.authenticity === 'VERY_LOW' || discovery.authenticity === 'LOW') {
    score -= 30;
    recommendedAction = 'Verify authenticity before applying';
    priority = 'LOW';
  } else if (discovery.authenticity === 'VERY_HIGH') {
    score += 10;
  }

  // 3. Competition reduction
  if (discovery.competition === 'HIGH') score -= 15;
  else if (discovery.competition === 'LOW') score += 10;

  // 4. Freshness
  if (discovery.freshness === 'TODAY') score += 15;
  else if (discovery.freshness === 'THIS_WEEK') score += 5;
  else if (discovery.freshness === 'OLDER') score -= 10;

  // 5. Source Trust
  if (discovery.sourceTrust === 'HIGHEST' || discovery.sourceTrust === 'VERY_HIGH') {
    score += 5;
  } else if (discovery.sourceTrust === 'LOWER') {
    score -= 10;
  }

  // Bound score
  score = Math.max(0, Math.min(100, score));

  // Determine Priority
  if (score >= 85 && discovery.freshness === 'TODAY') {
    priority = 'URGENT';
    recommendedAction = 'Apply immediately (High Quality & Fresh)';
  } else if (score >= 70) {
    priority = 'HIGH';
    recommendedAction = 'Prioritize application';
  } else if (score < 40) {
    priority = 'LOW';
    recommendedAction = 'Skip or low priority';
  }
  
  if (discovery.authenticity === 'LOW' || discovery.authenticity === 'VERY_LOW') {
    priority = 'IGNORE';
  }

  return {
    opportunityScore: score,
    priority,
    recommendedAction
  };
}
