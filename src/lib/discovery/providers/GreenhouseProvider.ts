import { BaseProvider } from './BaseProvider.js';
import type { ProviderCapabilities, DiscoveryContext, DiscoveryResult } from '../interfaces.js';

export class GreenhouseProvider extends BaseProvider {
  id = 'provider_greenhouse';
  name = 'Greenhouse ATS';
  providerType = 'GREENHOUSE' as const;
  version = '1.0.0';
  priority = 10; // High priority ATS

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
    return sourceUrl.includes('boards.greenhouse.io') || sourceUrl.includes('boards.eu.greenhouse.io');
  }

  async discover(context: DiscoveryContext): Promise<DiscoveryResult> {
    const start = Date.now();
    try {
      // Typically, Greenhouse has an open API: boards-api.greenhouse.io/v1/boards/{board_token}/jobs
      // For this implementation, if we don't have direct API access, we can fetch the HTML or rely on a generic fetch.
      // We return mock unstructured text for now to let Stage B do the heavy lifting, or we could parse JSON directly if we implemented the API call.
      
      const response = await fetch(context.sourceUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();

      return {
        jobs: [], 
        unstructuredText: text,
        latencyMs: Date.now() - start
      };
    } catch (e) {
      return {
        jobs: [],
        latencyMs: Date.now() - start,
        metadata: { error: (e as Error).message }
      };
    }
  }
}
