import type { CompetitionContext, CompetitionIntelligenceOutput } from './interfaces';

export async function runCompetitionIntelligence(context: CompetitionContext): Promise<CompetitionIntelligenceOutput> {
  // Phase 8.5 Audit: No reliable source of competition data exists.
  // We explicitly return UNKNOWN for competition level and score 0.
  // All speculative proxies (remote status, job age) are disabled.
  return {
    jobId: context.job?.id || 'unknown',
    runId: context.runId,
    signals: [],
    result: {
      score: 0,
      level: 'UNKNOWN' as any,
      confidence: 0
    },
    summary: {
      reasons: ['Competition is UNKNOWN: No legitimate evidence available.']
    }
  };
}
