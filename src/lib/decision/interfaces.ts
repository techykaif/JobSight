import type { DiscoveryIntelligenceOutput } from '../intelligence/interfaces.js';
import type { OpportunityIntelligenceOutput } from '../intelligence/opportunity.js';
import type { DiscoveredJob } from '../discovery/interfaces.js';

export type DecisionType = 'APPLY_NOW' | 'APPLY_THIS_WEEK' | 'MONITOR' | 'WAIT' | 'RESEARCH_MORE' | 'IGNORE';
export type RoiLevel = 'VERY_LOW' | 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
export type UrgencyLevel = 'TODAY' | 'THIS_WEEK' | 'SOON' | 'LATER' | 'UNKNOWN';

export interface DecisionContext {
  job: DiscoveredJob;
  runId: string;
  discovery: DiscoveryIntelligenceOutput;
  opportunity: OpportunityIntelligenceOutput;
  // Placedholders for future dependencies
  qualification?: any;
  company?: any;
}

export interface DecisionResult {
  decision: DecisionType;
  priority: number; // Higher is better (e.g. 1-100)
  confidence: number; // 0-100
  reasons: string[];
  unknowns: string[];
  requiredActions: string[];
  roiLevel: RoiLevel;
  urgencyLevel: UrgencyLevel;
}

export interface DecisionStrategy {
  readonly id: string;
  readonly name: string;
  readonly version: string;

  evaluate(context: DecisionContext): DecisionResult | null; // Return null if strategy declines to make a decision
  supports(context: DecisionContext): boolean;
  priority(): number; // 1-100, highest priority strategy that returns a result wins
}

export interface QueuedDecision {
  jobId: string;
  rank: number;
  result: DecisionResult;
  context: DecisionContext;
}

export interface WeeklyStrategy {
  highestPriorityCompanies: string[];
  jobsToApplyToday: QueuedDecision[];
  jobsToMonitor: QueuedDecision[];
  jobsToIgnore: QueuedDecision[];
  jobsToResearch: QueuedDecision[];
  companiesExpanding: string[];
  highestSalaryOpportunities: QueuedDecision[];
  remoteOpportunities: QueuedDecision[];
}
