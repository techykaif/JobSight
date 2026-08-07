import { companyOpportunityRegistry } from './registry';
import type { CompanyOpportunityContext, CompanyOpportunitySignal, CompanyOpportunityIntelligenceOutput } from './interfaces';
import { calculateOpportunity } from './calculator';
import { generateSummary } from './summary';

export async function runCompanyOpportunityIntelligence(
  context: CompanyOpportunityContext
): Promise<CompanyOpportunityIntelligenceOutput> {
  const providers = companyOpportunityRegistry.getProviders();
  const signals: CompanyOpportunitySignal[] = [];

  for (const provider of providers) {
    try {
      const signal = await provider.extractSignal(context);
      if (signal) {
        signals.push(signal);
      }
    } catch (e) {
      console.error(`[CompanyOpportunity] Provider ${provider.type} failed:`, e);
    }
  }

  // Calculate base confidence based on average foundation confidence across jobs
  let baseConf = 50;
  const jobIds = context.jobsForCompany.map(j => j.id);
  if (jobIds.length > 0) {
    // Average foundation confidence for company jobs (or competition confidence)
    // We didn't pass foundationConfidence directly in context, we can derive or default it
    baseConf = 75; // Arbitrary base for now, can be refined based on context.companyAnalysis
  }

  const { result, outlook } = calculateOpportunity(signals, baseConf);
  const summary = generateSummary(signals, result, outlook);

  return {
    companyId: context.company.id,
    runId: context.runId,
    signals,
    result,
    outlook,
    summary
  };
}
