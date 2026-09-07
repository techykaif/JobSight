import { db } from '../db/client.js';
import * as schema from '../db/schema.js';
import crypto from 'crypto';
import type { DiscoveredJob } from '../discovery/interfaces.js';
import { SearchEngineProvider } from '../discovery/providers/SearchEngineProvider.js';

export type ObservationStatus = 'OBSERVED_ON_SOURCE' | 'NOT_OBSERVED_ON_CHECKED_SOURCE' | 'UNKNOWN';
export type MatchStrength = 'EXACT' | 'PARTIAL' | 'LOW';

export interface CrossReferenceResult {
  status: ObservationStatus;
  targetSource: string;
  checkQuery?: string;
  observedUrl?: string;
  matchStrength?: MatchStrength;
}

export async function checkSecondaryEvidence(job: DiscoveredJob, originatingProvider?: string): Promise<CrossReferenceResult> {
  if (originatingProvider === 'SEARCH_ENGINE') {
    return { status: 'UNKNOWN', targetSource: 'SEARCH_ENGINE', checkQuery: 'SKIPPED_SAME_PROVIDER' };
  }

  if (!job.companyName || !job.title || !job.location) {
    return { status: 'UNKNOWN', targetSource: 'SEARCH_ENGINE' };
  }

  let query = `"${job.companyName}" "${job.title}" "${job.location}"`;
  try {
    if (job.sourceUrl) {
      query += ` -site:${new URL(job.sourceUrl).hostname}`;
    }
  } catch (e) {
    // Ignore invalid URL
  }
  
  try {
    const provider = new SearchEngineProvider();
    
    // We mock the discovery for the purpose of the audit architecture, but typically this would 
    // call the search engine provider and extract URLs from the raw result.
    const searchResult = await provider.discover({
      runId: 'secondary-verification',
      sourceUrl: `https://google.com/search?q=${encodeURIComponent(query)}`,
      targetRoles: [job.title],
      alternativeRoles: [],
    });
    
    if (!searchResult || !searchResult.unstructuredText) {
      return { status: 'UNKNOWN', targetSource: 'SEARCH_ENGINE', checkQuery: query };
    }

    let bestMatchUrl: string | null = null;
    let matchStrength: MatchStrength = 'LOW';
    let observed = false;

    const lines = searchResult.unstructuredText.split('\n');
    for (const line of lines) {
      if (!line.trim().startsWith('{')) continue;
      try {
        const item = JSON.parse(line.trim());
        if (item.company && item.title && item.url) {
          const compLower = item.company.toLowerCase();
          const titleLower = item.title.toLowerCase();
          const targetComp = job.companyName.toLowerCase();
          const targetTitle = job.title.toLowerCase();
          
          if (compLower.includes(targetComp) || targetComp.includes(compLower)) {
            if (titleLower.includes(targetTitle) || targetTitle.includes(titleLower)) {
              observed = true;
              bestMatchUrl = item.url;
              matchStrength = 'PARTIAL'; // Strong structured company + title match
              break;
            }
          }
        }
      } catch (e) {
        // Ignore parse errors per line
      }
    }
    
    if (!observed) {
      // Fallback to fuzzy text search as a weak signal
      const rawLower = searchResult.unstructuredText.toLowerCase();
      const companyFound = rawLower.includes(job.companyName.toLowerCase());
      const titleFound = rawLower.includes(job.title.toLowerCase());
      if (companyFound && titleFound) {
        observed = true;
        matchStrength = 'LOW'; // Weak ambiguous mention
      }
    }
    
    if (observed) {
      const result: CrossReferenceResult = {
        status: 'OBSERVED_ON_SOURCE',
        targetSource: 'SEARCH_ENGINE',
        checkQuery: query,
        matchStrength
      };
      if (bestMatchUrl) {
        result.observedUrl = bestMatchUrl;
      }
      return result;
    } else {
      return {
        status: 'NOT_OBSERVED_ON_CHECKED_SOURCE',
        targetSource: 'SEARCH_ENGINE',
        checkQuery: query
      };
    }

  } catch (err) {
    console.warn(`[Secondary Evidence] Failed to cross-reference job:`, err);
    return { status: 'UNKNOWN', targetSource: 'SEARCH_ENGINE', checkQuery: query };
  }
}

export async function persistSecondaryEvidence(jobId: string, runId: string, result: CrossReferenceResult) {
  try {
    await db.insert(schema.jobCrossReferences).values({
      id: crypto.randomUUID(),
      jobId,
      runId,
      targetSource: result.targetSource,
      observationStatus: result.status,
      checkQuery: result.checkQuery || null,
      observedUrl: result.observedUrl || null,
      matchStrength: result.matchStrength || null,
      observedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn(`[Secondary Evidence] Failed to persist cross-reference:`, err);
  }
}
