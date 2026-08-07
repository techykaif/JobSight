import type { SignalCategory, SignalType, SignalMetadata } from './types';
import type { jobs, companies, runs } from '../db/schema';

export interface FoundationContext {
  job: typeof jobs.$inferSelect;
  company?: typeof companies.$inferSelect | undefined;
  runId: string;
}

export interface ObservableSignal {
  type: SignalType;
  value: any;
  metadata?: SignalMetadata;
}

export interface NormalizedEvidence {
  id?: string;
  category: SignalCategory;
  title: string;
  description: string;
  observedValue: any;
  normalizedValue: any;
  weight: number;
  confidence: number;
  source: string;
  timestamp: string;
  metadata?: Record<string, any> | undefined;
}

export interface ConfidenceResult {
  score: number;
  factors: string[];
}

export interface SummaryResult {
  opportunityScore: number;
  confidence: number;
  evidenceChecklist: string[];
}

export interface IntelligenceFoundationOutput {
  jobId: string;
  runId: string;
  signals: ObservableSignal[];
  evidence: NormalizedEvidence[];
  confidence: ConfidenceResult;
  summary: SummaryResult;
}

export interface BaseSignalProvider {
  type: SignalType;
  category: SignalCategory;
  extractSignal(context: FoundationContext): Promise<ObservableSignal | null>;
}
