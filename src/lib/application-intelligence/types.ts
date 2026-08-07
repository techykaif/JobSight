export type ApplicationReadinessLevel = 
  | 'Ready Now'
  | 'Almost Ready'
  | 'Needs Improvement'
  | 'Not Recommended';

export type ApplicationRecommendationAction = 
  | 'Apply Immediately'
  | 'Customize Resume First'
  | 'Upskill Before Applying'
  | 'Skip Application';

export type ApplicationSignalType = 
  | 'QUALIFICATION_MATCH'
  | 'SKILL_MATCH'
  | 'EXPERIENCE_MATCH'
  | 'REQUIRED_SKILLS'
  | 'PREFERRED_SKILLS'
  | 'RESUME_COMPLETENESS'
  | 'TECHNOLOGY_MATCH'
  | 'EMPLOYMENT_TYPE_MATCH'
  | 'LOCATION_MATCH'
  | 'SALARY_ALIGNMENT'
  | 'COMPETITION_SCORE'
  | 'COMPANY_OPPORTUNITY'
  | 'DISCOVERY_INTELLIGENCE'
  | 'EVIDENCE_CONFIDENCE'
  | 'OVERALL_CONFIDENCE';

export interface ApplicationSignalMetadata {
  description?: string;
  [key: string]: any;
}
