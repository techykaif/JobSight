import { BaseProvider } from './BaseProvider.js';
import type { ProviderCapabilities, DiscoveryContext, DiscoveryResult } from '../interfaces.js';

export class AshbyProvider extends BaseProvider {
  id = 'provider_ashby';
  name = 'Ashby ATS';
  providerType = 'ASHBY' as const;
  version = '1.0.0';
  priority = 12;

  capabilities(): ProviderCapabilities {
    return {
      supportsSearch: false,
      supportsPagination: true,
      supportsRemoteFiltering: true,
      supportsSalaryExtraction: true,
      supportsAuthentication: false,
      supportsIncrementalSync: true,
      supportsHistoricalLookup: true,
      supportsCompanyMetadata: true,
      supportsJobMetadata: true
    };
  }

  supports(sourceUrl: string): boolean {
    return sourceUrl.includes('jobs.ashbyhq.com');
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
