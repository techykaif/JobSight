import type { CompetitionSignalType, CompetitionSignalMetadata, CompetitionLevel } from './types';
import type { jobs, companies, runs } from '../db/schema';
import type { NormalizedEvidence, IntelligenceFoundationOutput } from '../intelligence-foundation/interfaces';

export interface CompetitionContext {
  job: typeof jobs.$inferSelect;
  company?: typeof companies.$inferSelect | undefined;
  runId: string;
  foundationEvidence: NormalizedEvidence[];
  foundationConfidence: number;
  foundationSignals: { type: string; value: any }[];
  // we can also add other scores or data here
  hiringMomentum?: number;
  companyAuthenticity?: number;
}

export interface CompetitionSignal {
  type: CompetitionSignalType;
  value: any;
  weight: number; // positive weight means more competition
  metadata?: CompetitionSignalMetadata | undefined;
}

export interface CompetitionResult {
  score: number;
  level: CompetitionLevel;
  confidence: number;
}

export interface CompetitionSummary {
  reasons: string[];
}

export interface CompetitionIntelligenceOutput {
  jobId: string;
  runId: string;
  signals: CompetitionSignal[];
  result: CompetitionResult;
  summary: CompetitionSummary;
}

export interface BaseCompetitionProvider {
  type: CompetitionSignalType;
  extractSignal(context: CompetitionContext): Promise<CompetitionSignal | null>;
}
