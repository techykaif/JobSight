import { BaseProvider } from './BaseProvider.js';
import type { ProviderCapabilities, DiscoveryContext, DiscoveryResult } from '../interfaces.js';

export class CustomProvider extends BaseProvider {
  id = 'provider_custom';
  name = 'Custom Source';
  providerType = 'CUSTOM' as const;
  version = '1.0.0';
  priority = 1; // Highest priority for manually explicitly added custom sources

  capabilities(): ProviderCapabilities {
    return {
      supportsSearch: false,
      supportsPagination: false,
      supportsRemoteFiltering: false,
      supportsSalaryExtraction: false,
      supportsAuthentication: true, // Custom could have auth
      supportsIncrementalSync: false,
      supportsHistoricalLookup: false,
      supportsCompanyMetadata: false,
      supportsJobMetadata: false
    };
  }

  supports(sourceUrl: string): boolean {
    // A Custom provider handles a source that is explicitly configured as CUSTOM in the database.
    // In practice, this provider is explicitly selected by the orchestrator if the source is marked CUSTOM.
    return false; // Fallback, only matches if explicitly forced
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
