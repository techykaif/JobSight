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
    // We now use a structured, highly targeted DORK query rather than a generic prompt
    // to strictly enforce less-visible discovery.
    const prompt = `Execute the following search query to discover job postings:

QUERY: ${query}
    
Return the raw contents, links, and job details you discover from these targeted sources. DO NOT fallback to generic job boards like Indeed or LinkedIn unless the query explicitly requests them.

CRITICAL URL REQUIREMENTS:
- You must provide the EXACT, full absolute URL to the concrete job posting.
- Do NOT provide a generic ATS root domain (e.g. no "https://boards.greenhouse.io").
- Do NOT provide a company homepage or careers landing page.
- Do NOT rewrite, abbreviate, or summarize the URLs.
- If an exact job posting URL is unavailable for a candidate, do NOT invent one; omit the URL or omit the candidate.
- One exact URL per discovered posting.
- Prefer a compact structured format. Do NOT generate a conversational recruiter-style narrative. Focus purely on machine-usable structured discovery data.`;

    try {
      let unstructuredText = await runAgyUnstructured({ prompt });

      const urlRegex = /https:\/\/vertexaisearch\.cloud\.google\.com\/[^\s)\]'"]+/g;
      const urls = [...new Set(unstructuredText.match(urlRegex) || [])];

      if (urls.length > 0) {
        console.log(`[SearchEngineProvider] Resolving ${urls.length} Vertex AI redirects...`);
        const resolveUrl = async (url: string) => {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            // using GET but we don't consume the body.
            const res = await fetch(url, { redirect: 'follow', signal: controller.signal });
            clearTimeout(timeoutId);
            return { original: url, resolved: res.url };
          } catch (e) {
            console.warn(`[SearchEngineProvider] Failed to resolve redirect ${url}`, (e as Error).message);
            return { original: url, resolved: url };
          }
        };

        const batchSize = 5;
        for (let i = 0; i < urls.length; i += batchSize) {
          const batch = urls.slice(i, i + batchSize);
          const resolutions = await Promise.all(batch.map(u => resolveUrl(u)));
          for (const res of resolutions) {
            if (res.resolved && res.resolved !== res.original && !res.resolved.includes('vertexaisearch.cloud.google.com')) {
              unstructuredText = unstructuredText.split(res.original).join(res.resolved);
            }
          }
        }
      }

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
    const roles = `(${context.targetRoles.map(r => `"${r}"`).join(' OR ')})`;
    const location = context.location && !context.remoteOnly ? `"${context.location}"` : '';
    const remote = context.remoteOnly ? '"remote"' : '';
    const skills = context.requiredSkills && context.requiredSkills.length > 0 
      ? `(${context.requiredSkills.slice(0,3).map(s => `"${s}"`).join(' AND ')})` 
      : '';

    let siteDorks = '';
    const strat = context.strategyName?.toLowerCase() || '';

    // Targeted ATS / Stealth discovery
    if (strat.includes('stealth') || strat.includes('startup')) {
      siteDorks = '(site:jobs.lever.co OR site:boards.greenhouse.io OR site:jobs.ashbyhq.com OR site:boards.eu.greenhouse.io)';
    } else if (strat.includes('enterprise')) {
      siteDorks = '(site:myworkdayjobs.com OR site:careers.ibm.com OR site:careers.microsoft.com)';
    }

    return `${siteDorks} ${roles} ${skills} ${location} ${remote}`.trim().replace(/\s+/g, ' ');
  }
}
