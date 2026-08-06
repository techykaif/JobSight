import { BaseProvider } from './BaseProvider.js';
import type { ProviderCapabilities, DiscoveryContext, DiscoveryResult } from '../interfaces.js';
import { runAgyUnstructured } from '../../agy/runner.js';

export class SearchEngineProvider extends BaseProvider {
  id = 'provider_search_engine';
  name = 'Search Engine Discovery';
  providerType = 'SEARCH_ENGINE' as const;
  version = '1.0.0';
  priority = 100; // Low priority, runs after ATS/specific pages

  capabilities(): ProviderCapabilities {
    return {
      supportsSearch: true,
      supportsPagination: true,
      supportsRemoteFiltering: true,
      supportsSalaryExtraction: false,
      supportsAuthentication: false,
      supportsIncrementalSync: false,
      supportsHistoricalLookup: false,
      supportsCompanyMetadata: false,
      supportsJobMetadata: false
    };
  }

  supports(sourceUrl: string): boolean {
    return sourceUrl.includes('google.com') || sourceUrl.includes('bing.com') || sourceUrl === 'SEARCH_ENGINE';
  }

  async discover(context: DiscoveryContext): Promise<DiscoveryResult> {
    const start = Date.now();
    const query = this.buildSearchQuery(context);
    
    // Simulating search using AGY unstructured fetch
    // Real implementation would probably use a SerpAPI or similar.
    // For now we lean on AGY's internal web search capabilities by asking it to find jobs.
    const prompt = `Find recent job postings for ${context.targetRoles.join(' or ')} in ${context.location || 'Anywhere'}. 
    Return the raw contents of the search results or job boards you find.`;

    try {
      const unstructuredText = await runAgyUnstructured({ prompt });
      return {
        jobs: [], // Search engines don't structure jobs directly; they rely on Stage B
        unstructuredText,
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

  private buildSearchQuery(context: DiscoveryContext): string {
    const roles = context.targetRoles.join(' OR ');
    const location = context.location ? `"${context.location}"` : '';
    const remote = context.remoteOnly ? '"remote"' : '';
    return `${roles} ${location} ${remote} job postings`;
  }
}
