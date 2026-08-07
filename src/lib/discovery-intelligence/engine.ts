import { discoveryIntelligenceRegistry } from './registry';
import type { DiscoveryIntelligenceContext, DiscoveryIntelligenceSignal, DiscoveryIntelligenceOutput } from './interfaces';
import { calculateDiscoveryIntelligence } from './calculator';
import { generateDiscoverySummary } from './summary';

export async function runDiscoveryIntelligence(
  context: DiscoveryIntelligenceContext
): Promise<DiscoveryIntelligenceOutput> {
  const providers = discoveryIntelligenceRegistry.getProviders();
  const signals: DiscoveryIntelligenceSignal[] = [];

  for (const provider of providers) {
    try {
      const signal = await provider.extractSignal(context);
      if (signal) {
        signals.push(signal);
      }
    } catch (e) {
      console.error(`[DiscoveryIntelligence] Provider ${provider.type} failed:`, e);
    }
  }

  // Base confidence is high because we rely strictly on deterministic observable source metadata.
  let baseConf = 80;

  const result = calculateDiscoveryIntelligence(signals, baseConf);
  const summary = generateDiscoverySummary(signals, result);

  // Bring in Competition result if available to the summary for an aggregated view
  if (context.competitionResult) {
    if (context.competitionResult.score <= 30) summary.competition = 'Low';
    else if (context.competitionResult.score >= 70) summary.competition = 'High';
  }

  return {
    jobId: context.job.id,
    runId: context.runId,
    signals,
    result,
    summary
  };
}
