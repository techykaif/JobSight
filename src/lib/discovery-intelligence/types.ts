export type DiscoveryIntelligenceLevel = 'Exceptional' | 'Excellent' | 'Strong' | 'Standard' | 'Weak';
export type DiscoveryVisibilityLevel = 'High' | 'Medium' | 'Low' | 'Hidden';
export type DiscoveryUniquenessLevel = 'High' | 'Medium' | 'Low';
export type DiscoveryAuthenticityLevel = 'Verified' | 'Probable' | 'Unverified' | 'Questionable';
export type SourceQualityLevel = 'Premium' | 'Standard' | 'Low';

export type DiscoverySignalType =
  | 'OFFICIAL_ATS'
  | 'DIRECT_CAREERS_PAGE'
  | 'AGGREGATOR_SOURCE'
  | 'DISCOVERY_PROVIDER'
  | 'PROVIDER_QUALITY'
  | 'DISCOVERY_STRATEGY'
  | 'SOURCE_AUTHENTICITY'
  | 'POSTING_FRESHNESS'
  | 'DUPLICATE_DETECTION'
  | 'MULTI_SOURCE_VERIFICATION'
  | 'EVIDENCE_CONFIDENCE'
  | 'COMPETITION_SCORE'
  | 'COMPANY_OPPORTUNITY'
  | 'DISCOVERY_DEPTH'
  | 'SOURCE_DIVERSITY'
  | 'VISIBILITY_SIGNALS'
  | 'INDEXABILITY'
  | 'HISTORICAL_DISCOVERY';

export interface DiscoverySignalMetadata {
  source?: string;
  timestamp?: string;
  [key: string]: any;
}
