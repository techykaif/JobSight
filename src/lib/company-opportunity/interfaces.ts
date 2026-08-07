import type { CompanySignalType, CompanySignalMetadata, CompanyOpportunityLevel, CompanyHiringTrend, CompanyHiringStability } from './types';
import type { jobs, companies, runs } from '../db/schema';
import type { NormalizedEvidence } from '../intelligence-foundation/interfaces';
import type { CompetitionResult } from '../competition/interfaces';

export interface CompanyOpportunityContext {
  company: typeof companies.$inferSelect;
  jobsForCompany: typeof jobs.$inferSelect[];
  runId: string;
  
  // Previous intelligence
  companyAnalysis?: any;
  foundationEvidenceByJob: Record<string, NormalizedEvidence[]>;
  foundationSignalsByJob: Record<string, { type: string; value: any }[]>;
  competitionResultsByJob: Record<string, CompetitionResult>;
}

export interface CompanyOpportunitySignal {
  type: CompanySignalType;
  value: any;
  weight: number; // positive means better opportunity
  metadata?: CompanySignalMetadata | undefined;
}

export interface CompanyOutlookResult {
  trend: CompanyHiringTrend;
  stability: CompanyHiringStability;
  momentum: number; // 0-100
}

export interface CompanyOpportunityResult {
  score: number;
  level: CompanyOpportunityLevel;
  confidence: number;
}

export interface CompanyOpportunitySummary {
  outlook: string;
  hiringTrend: string;
  remoteHiring: string;
  engineeringHiring: string;
  competition: string;
  authenticity: string;
  evidenceCount: number;
  confidence: number;
}

export interface CompanyOpportunityIntelligenceOutput {
  companyId: string;
  runId: string;
  signals: CompanyOpportunitySignal[];
  result: CompanyOpportunityResult;
  outlook: CompanyOutlookResult;
  summary: CompanyOpportunitySummary;
}

export interface BaseCompanyOpportunityProvider {
  type: CompanySignalType;
  extractSignal(context: CompanyOpportunityContext): Promise<CompanyOpportunitySignal | null>;
}
