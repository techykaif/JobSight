import type { jobs, runs, jobObservations, companies } from '../db/schema';
import type { CandidateProfile } from '../qualification/schema';
import type { CompetitionResult } from '../competition/interfaces';
import type { CompanyOpportunityResult } from '../company-opportunity/interfaces';
import type { DiscoveryIntelligenceOutput } from '../discovery-intelligence/interfaces';
import type { 
  ApplicationReadinessLevel, 
  ApplicationRecommendationAction, 
  ApplicationSignalType, 
  ApplicationSignalMetadata 
} from './types';

export interface ApplicationIntelligenceContext {
  job: typeof jobs.$inferSelect;
  company?: typeof companies.$inferSelect;
  runId: string;
  candidateProfile?: CandidateProfile;
  qualificationScore?: number;
  qualificationSkills?: string[];
  
  // Intelligence inputs
  competitionResult?: CompetitionResult;
  companyOpportunityResult?: CompanyOpportunityResult;
  discoveryIntelligenceOutput?: DiscoveryIntelligenceOutput;
}

export interface ApplicationIntelligenceSignal {
  type: ApplicationSignalType;
  value: any;
  weight: number; // positive increases readiness, negative decreases
  metadata?: ApplicationSignalMetadata;
}

export interface ApplicationIntelligenceResult {
  score: number;
  readinessLevel: ApplicationReadinessLevel;
  confidence: number;
}

export interface ApplicationIntelligenceSummary {
  strengths: string[];
  weaknesses: string[];
  missingSkills: string[];
  riskFactors: string[];
}

export interface ApplicationIntelligenceOutput {
  jobId: string;
  runId: string;
  signals: ApplicationIntelligenceSignal[];
  result: ApplicationIntelligenceResult;
  summary: ApplicationIntelligenceSummary;
  recommendation: ApplicationRecommendationAction;
}

export interface BaseApplicationIntelligenceProvider {
  type: ApplicationSignalType;
  extractSignal(context: ApplicationIntelligenceContext): Promise<ApplicationIntelligenceSignal | null>;
}
