export type OpportunityLevel = 'FAVORABLE' | 'NEUTRAL' | 'UNFAVORABLE' | 'INSUFFICIENT_EVIDENCE';
export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';

export type SignalLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
export type VisibilitySignalLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN' | 'NOT_OBSERVED_ON_CHECKED_SOURCES';
export type CompensationSignalLevel = 'EXCEPTIONAL' | 'TARGET' | 'BELOW_TARGET' | 'UNKNOWN';
export type FreshnessSignalLevel = 'NEW' | 'AGING' | 'STALE' | 'UNKNOWN';

export interface OpportunityQualitySignals {
  visibility: VisibilitySignalLevel;
  competition: SignalLevel;
  applicantVolume: number | 'UNKNOWN';
  compensation: CompensationSignalLevel;
  freshness: FreshnessSignalLevel;
  friction: SignalLevel;
  authenticity: SignalLevel;
}

export interface CanonicalOpportunityQuality {
  opportunityLevel: OpportunityLevel;
  confidence: ConfidenceLevel;
  signals: OpportunityQualitySignals;
  evidence: string[]; // reasons/provenance
}
