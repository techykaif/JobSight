export type CompetitionLevel = 'Very Low' | 'Low' | 'Medium' | 'High' | 'Very High';

export type CompetitionSignalType = 
  | 'OFFICIAL_ATS'
  | 'DIRECT_CAREERS_PAGE'
  | 'DISCOVERY_SOURCE'
  | 'POSTING_FRESHNESS'
  | 'JOB_AGE'
  | 'PROVIDER_TYPE'
  | 'COMPANY_SIZE'
  | 'REMOTE_AVAILABILITY'
  | 'WORLDWIDE_REMOTE'
  | 'APPLICATION_SIMPLICITY'
  | 'SALARY_TRANSPARENCY'
  | 'HIRING_MOMENTUM'
  | 'COMPANY_AUTHENTICITY'
  | 'EVIDENCE_CONFIDENCE'
  | 'VISIBILITY_SIGNALS'
  | 'PROVIDER_POPULARITY'
  | 'AGGREGATOR_PRESENCE'
  | 'MULTIPLE_SOURCE_DUPLICATION';

export interface CompetitionSignalMetadata {
  source?: string;
  timestamp?: string;
  [key: string]: any;
}
