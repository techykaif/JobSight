export interface AdaptiveLearningContext {
  runId: string;
  configId: string;
}

export interface LearningModifiers {
  [jobId: string]: number; // Priority adjustment (e.g., -15 to +15)
}

export interface TraitObservation {
  traitType: 'companyId' | 'remoteType';
  traitValue: string;
  positiveObservations: number;
  negativeObservations: number;
  totalObservations: number;
  confidence: number;
  modifier: number;
}
