export type CompanyOpportunityLevel = 'Excellent' | 'Strong' | 'Good' | 'Average' | 'Weak';
export type CompanyHiringTrend = 'Growing' | 'Stable' | 'Slowing' | 'Unknown';
export type CompanyHiringStability = 'High' | 'Medium' | 'Low';

export type CompanySignalType =
  | 'COMPANY_AUTHENTICITY'
  | 'OFFICIAL_CAREERS_PAGE'
  | 'OFFICIAL_ATS'
  | 'HIRING_MOMENTUM'
  | 'POSTING_FREQUENCY'
  | 'POSTING_FRESHNESS'
  | 'NUMBER_OF_ACTIVE_ROLES'
  | 'ROLE_DIVERSITY'
  | 'ENGINEERING_HIRING'
  | 'REMOTE_HIRING'
  | 'REMOTE_POLICY'
  | 'SALARY_TRANSPARENCY'
  | 'COMPETITION_SCORE'
  | 'EVIDENCE_CONFIDENCE'
  | 'DISCOVERY_SOURCE_QUALITY'
  | 'COMPANY_DOMAIN_QUALITY'
  | 'CAREER_PAGE_COMPLETENESS'
  | 'HISTORICAL_SNAPSHOTS'
  | 'PROVIDER_AVAILABILITY';

export interface CompanySignalMetadata {
  source?: string;
  timestamp?: string;
  [key: string]: any;
}
