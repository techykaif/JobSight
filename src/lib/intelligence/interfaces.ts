import type { DiscoveredJob } from '../discovery/interfaces.js';

export type HiddenGemLevel = 'VERY_HIGH' | 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
export type VisibilityLevel = 'VERY_LOW' | 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
export type AuthenticityLevel = 'VERY_HIGH' | 'HIGH' | 'MEDIUM' | 'LOW' | 'VERY_LOW' | 'UNKNOWN';
export type CompetitionLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
export type FreshnessLevel = 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'OLDER' | 'UNKNOWN';
export type SourceTrustLevel = 'HIGHEST' | 'VERY_HIGH' | 'HIGH' | 'MEDIUM' | 'LOWER' | 'UNKNOWN';

export interface AnalyzerResult {
  output: Record<string, any>;
  confidence: number; // 0-100
  signals: string[];
  unknowns: string[];
}

export interface AnalyzerContext {
  job: DiscoveredJob;
  runId: string;
  sourceProviderType?: string;
  sourceUrl?: string;
}

export interface DiscoveryAnalyzer {
  readonly id: string;
  readonly name: string;
  readonly version: string;

  analyze(context: AnalyzerContext): Promise<AnalyzerResult>;
  supports(context: AnalyzerContext): boolean;
}

export interface DiscoveryIntelligenceOutput {
  hiddenGem: HiddenGemLevel;
  visibility: VisibilityLevel;
  authenticity: AuthenticityLevel;
  competition: CompetitionLevel;
  freshness: FreshnessLevel;
  sourceTrust: SourceTrustLevel;
  confidence: number;
  signals: string[];
  unknowns: string[];
}
