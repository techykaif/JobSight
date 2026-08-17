import type { DiscoveredJob } from '../../discovery/interfaces.js';

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
export type AssessmentLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
export type OpportunityLevel = 'FAVORABLE' | 'NEUTRAL' | 'UNFAVORABLE' | 'INSUFFICIENT_EVIDENCE';

export interface MarketIntelligenceContext {
  job: DiscoveredJob;
  runId: string;
  sourceUrl?: string;
  sourceProviderType?: string;
  rawContent?: string;
  similarJobsInRun?: DiscoveredJob[];
}

export interface VisibilityAssessment {
  level: AssessmentLevel;
  evidence: {
    directSource: boolean;
    mainstreamAggregatorPresence: boolean;
    discoverySourceCount: number;
    duplicateCount: number;
    freshness: string;
  };
  confidence: ConfidenceLevel;
}

export interface ApplicantVolumeEvidence {
  value: number;
  isLowerBound: boolean;
  source: string;
  observedAt: string;
}

export interface CompetitionAssessment {
  level: AssessmentLevel;
  applicantVolume?: ApplicantVolumeEvidence;
  evidence: {
    directEvidence: boolean;
    indicators: string[];
  };
  confidence: ConfidenceLevel;
}

export interface HiringFrictionAssessment {
  level: AssessmentLevel;
  signals: {
    resumeRequired: boolean;
    coverLetterRequired: boolean;
    accountRequired: boolean;
    assessmentRequired: boolean;
    externalRedirect: boolean;
    multiStep: boolean;
    accessible: boolean;
  };
  confidence: ConfidenceLevel;
}

export interface MarketIntelligenceResult {
  visibility: VisibilityAssessment;
  competition: CompetitionAssessment;
  friction: HiringFrictionAssessment;
  opportunityIntelligence: OpportunityLevel;
}
