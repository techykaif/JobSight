import { applicationIntelligenceRegistry } from './registry';
import type { ApplicationIntelligenceContext, ApplicationIntelligenceSignal, ApplicationIntelligenceOutput } from './interfaces';
import { calculateApplicationIntelligence } from './calculator';
import { generateApplicationSummary } from './summary';

export async function runApplicationIntelligence(
  context: ApplicationIntelligenceContext
): Promise<ApplicationIntelligenceOutput> {
  const providers = applicationIntelligenceRegistry.getProviders();
  const signals: ApplicationIntelligenceSignal[] = [];

  for (const provider of providers) {
    try {
      const signal = await provider.extractSignal(context);
      if (signal) {
        signals.push(signal);
      }
    } catch (e) {
      console.error(`[ApplicationIntelligence] Provider ${provider.type} failed:`, e);
    }
  }

  // Base confidence is high unless inputs are missing
  let baseConf = 80;

  const result = calculateApplicationIntelligence(signals, baseConf);
  const { summary, recommendation } = generateApplicationSummary(signals, result);

  return {
    jobId: context.job.id,
    runId: context.runId,
    signals,
    result,
    summary,
    recommendation
  };
}
