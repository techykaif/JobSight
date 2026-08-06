import { BaseProvider } from './BaseProvider.js';
import type { ProviderCapabilities, DiscoveryContext, DiscoveryResult } from '../interfaces.js';

export class CareersPageProvider extends BaseProvider {
  id = 'provider_careers_page';
  name = 'Generic Careers Page';
  providerType = 'CAREERS_PAGE' as const;
  version = '1.0.0';
  priority = 50; // Medium priority, below specific ATS but above Search Engines

  capabilities(): ProviderCapabilities {
    return {
      supportsSearch: false,
      supportsPagination: false,
      supportsRemoteFiltering: false,
      supportsSalaryExtraction: false,
      supportsAuthentication: false,
      supportsIncrementalSync: false,
      supportsHistoricalLookup: false,
      supportsCompanyMetadata: false,
      supportsJobMetadata: false
    };
  }

  supports(sourceUrl: string): boolean {
    // If it's a direct URL but doesn't match an ATS, it falls back to this (if registered before SearchEngine)
    // The registry matches first capable provider by priority. 
    // This will support any generic http/https URL.
    return sourceUrl.startsWith('http://') || sourceUrl.startsWith('https://');
  }

  async discover(context: DiscoveryContext): Promise<DiscoveryResult> {
    const start = Date.now();
    try {
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
