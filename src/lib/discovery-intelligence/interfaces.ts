import type { 
  DiscoverySignalType, 
  DiscoverySignalMetadata, 
  DiscoveryIntelligenceLevel, 
  DiscoveryVisibilityLevel, 
  DiscoveryUniquenessLevel, 
  DiscoveryAuthenticityLevel,
  SourceQualityLevel
} from './types';
import type { jobs, companies, runs, jobObservations, jobSources } from '../db/schema';
import type { NormalizedEvidence } from '../intelligence-foundation/interfaces';
import type { CompetitionResult } from '../competition/interfaces';
import type { CompanyOpportunityResult } from '../company-opportunity/interfaces';

export interface DiscoveryIntelligenceContext {
  job: typeof jobs.$inferSelect;
  company?: typeof companies.$inferSelect;
  runId: string;
  observation: typeof jobObservations.$inferSelect;
  source?: typeof jobSources.$inferSelect;
  
  // Previous intelligence outputs
  foundationEvidence: NormalizedEvidence[];
  foundationSignals: { type: string; value: any }[];
  competitionResult?: CompetitionResult;
  companyOpportunityResult?: CompanyOpportunityResult;
  
  // To identify uniqueness
  similarJobsInRun: typeof jobs.$inferSelect[];
}

export interface DiscoveryIntelligenceSignal {
  type: DiscoverySignalType;
  value: any;
  weight: number; // positive means better discovery (more unique, higher quality)
  metadata?: DiscoverySignalMetadata | undefined;
}

export interface DiscoveryIntelligenceResult {
  score: number;
  level: DiscoveryIntelligenceLevel;
  confidence: number;
}

export interface DiscoveryIntelligenceSummary {
  quality: SourceQualityLevel;
  source: string;
  visibility: DiscoveryVisibilityLevel;
  uniqueness: DiscoveryUniquenessLevel;
  competition: string;
  authenticity: DiscoveryAuthenticityLevel;
  evidenceCount: number;
  confidence: number;
}

export interface DiscoveryIntelligenceOutput {
  jobId: string;
  runId: string;
  signals: DiscoveryIntelligenceSignal[];
  result: DiscoveryIntelligenceResult;
  summary: DiscoveryIntelligenceSummary;
}

export interface BaseDiscoveryIntelligenceProvider {
  type: DiscoverySignalType;
  extractSignal(context: DiscoveryIntelligenceContext): Promise<DiscoveryIntelligenceSignal | null>;
}
