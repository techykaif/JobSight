import { BaseProvider } from './BaseProvider.js';
import type { ProviderCapabilities, DiscoveryContext, DiscoveryResult } from '../interfaces.js';

export class SitemapProvider extends BaseProvider {
  id = 'provider_sitemap';
  name = 'Sitemap Crawler';
  providerType = 'SITEMAP' as const;
  version = '1.0.0';
  priority = 21;

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
    return sourceUrl.endsWith('sitemap.xml');
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
