import { foundationRegistry } from './registry';
import type { FoundationContext, ObservableSignal, IntelligenceFoundationOutput } from './interfaces';
import { normalizeSignals } from './normalizer';
import { calculateConfidence } from './confidence';
import { generateSummary } from './summary';

export async function runIntelligenceFoundation(
  context: FoundationContext,
  baseOpportunityScore: number = 50
): Promise<IntelligenceFoundationOutput> {
  const providers = foundationRegistry.getProviders();
  const signals: ObservableSignal[] = [];

  for (const provider of providers) {
    try {
      const signal = await provider.extractSignal(context);
      if (signal) {
        signals.push(signal);
      }
    } catch (e) {
      console.error(`[IntelligenceFoundation] Provider ${provider.type} failed:`, e);
    }
  }

  const evidence = normalizeSignals(signals);
  const confidence = calculateConfidence(evidence);
  const summary = generateSummary(evidence, confidence, baseOpportunityScore);

  return {
    jobId: context.job.id,
    runId: context.runId,
    signals,
    evidence,
    confidence,
    summary
  };
}
