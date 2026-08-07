import { competitionRegistry } from './registry';
import type { CompetitionContext, CompetitionSignal, CompetitionIntelligenceOutput } from './interfaces';
import { calculateCompetition } from './calculator';
import { generateSummary } from './summary';

export async function runCompetitionIntelligence(
  context: CompetitionContext
): Promise<CompetitionIntelligenceOutput> {
  const providers = competitionRegistry.getProviders();
  const signals: CompetitionSignal[] = [];

  for (const provider of providers) {
    try {
      const signal = await provider.extractSignal(context);
      if (signal) {
        signals.push(signal);
      }
    } catch (e) {
      console.error(`[CompetitionIntelligence] Provider ${provider.type} failed:`, e);
    }
  }

  const result = calculateCompetition(signals, context.foundationConfidence);
  const summary = generateSummary(signals, result);

  return {
    jobId: context.job.id,
    runId: context.runId,
    signals,
    result,
    summary
  };
}
