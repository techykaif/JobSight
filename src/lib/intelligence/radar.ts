import type { DiscoveryIntelligenceOutput } from './interfaces.js';
import type { OpportunityIntelligenceOutput } from './opportunity.js';

export interface RadarJob {
  jobId: string;
  discovery: DiscoveryIntelligenceOutput;
  opportunity: OpportunityIntelligenceOutput;
}

export function generateOpportunityRadar(jobs: RadarJob[]) {
  const hiddenGems = jobs.filter(j => j.discovery.hiddenGem === 'VERY_HIGH' || j.discovery.hiddenGem === 'HIGH');
  const recentlyPosted = jobs.filter(j => j.discovery.freshness === 'TODAY');
  const lowCompetition = jobs.filter(j => j.discovery.competition === 'LOW');
  const highTrust = jobs.filter(j => j.discovery.sourceTrust === 'HIGHEST' || j.discovery.sourceTrust === 'VERY_HIGH');
  
  // Example for sorting by highest opportunity score
  const highestScore = [...jobs].sort((a, b) => b.opportunity.opportunityScore - a.opportunity.opportunityScore).slice(0, 5);

  return {
    hiddenGems,
    recentlyPosted,
    lowCompetition,
    highTrust,
    highestScore
  };
}
