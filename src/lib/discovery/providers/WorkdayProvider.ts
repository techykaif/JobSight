import { BaseProvider } from './BaseProvider.js';
import type { ProviderCapabilities, DiscoveryContext, DiscoveryResult } from '../interfaces.js';

export class WorkdayProvider extends BaseProvider {
  id = 'provider_workday';
  name = 'Workday ATS';
  providerType = 'WORKDAY' as const;
  version = '1.0.0';
  priority = 13;

  capabilities(): ProviderCapabilities {
    return {
      supportsSearch: false,
      supportsPagination: true,
      supportsRemoteFiltering: true,
      supportsSalaryExtraction: false, // Workday rarely has easily extractable salary upfront
      supportsAuthentication: false,
      supportsIncrementalSync: false,
      supportsHistoricalLookup: false,
      supportsCompanyMetadata: true,
      supportsJobMetadata: true
    };
  }

  supports(sourceUrl: string): boolean {
    return sourceUrl.includes('myworkdayjobs.com');
  }

  async discover(context: DiscoveryContext): Promise<DiscoveryResult> {
    const start = Date.now();
    try {
      const response = await fetch(context.sourceUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      return { jobs: [], unstructuredText: text, latencyMs: Date.now() - start };
    } catch (e) {
      return { jobs: [], latencyMs: Date.now() - start, metadata: { error: (e as Error).message } };
    }
  }
}
