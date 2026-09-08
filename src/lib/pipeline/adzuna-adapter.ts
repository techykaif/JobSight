import https from 'https';
import type { DiscoveredJob } from '../discovery/interfaces.js';
import type { CrossReferenceResult, MatchStrength } from './secondary-evidence.js';

let adzunaRequestCount = 0;
const ADZUNA_DAILY_BUDGET = 200;

export async function checkAdzunaEvidence(job: DiscoveredJob): Promise<CrossReferenceResult> {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;

  if (!appId || !appKey) {
    return { status: 'UNKNOWN', targetSource: 'ADZUNA', checkQuery: 'MISSING_CREDENTIALS' };
  }

  if (adzunaRequestCount >= ADZUNA_DAILY_BUDGET) {
    return { status: 'UNKNOWN', targetSource: 'ADZUNA', checkQuery: 'LOCAL_RATE_LIMIT_EXCEEDED' };
  }

  if (!job.companyName || !job.title) {
    return { status: 'UNKNOWN', targetSource: 'ADZUNA' };
  }

  adzunaRequestCount++;

  const query = `"${job.companyName}" "${job.title}"`;
  const encodedQuery = encodeURIComponent(query);
  const url = `https://api.adzuna.com/v1/api/jobs/us/search/1?app_id=${appId}&app_key=${appKey}&results_per_page=10&what=${encodedQuery}`;

  return new Promise((resolve) => {
    const req = https.get(url, { timeout: 5000 }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 401 || res.statusCode === 403 || res.statusCode === 429) {
          resolve({ status: 'UNKNOWN', targetSource: 'ADZUNA', checkQuery: query });
          return;
        }
        if (!res.statusCode || res.statusCode >= 400) {
          resolve({ status: 'UNKNOWN', targetSource: 'ADZUNA', checkQuery: query });
          return;
        }

        try {
          const json = JSON.parse(data);
          if (!json || !Array.isArray(json.results)) {
            resolve({ status: 'UNKNOWN', targetSource: 'ADZUNA', checkQuery: query });
            return;
          }

          if (json.results.length === 0) {
            resolve({ status: 'NOT_OBSERVED_ON_CHECKED_SOURCES', targetSource: 'ADZUNA', checkQuery: query, matchStrength: 'NONE' });
            return;
          }

          let bestMatch: any = null;
          let bestStrength: any = 'NONE';
          let matchCount = 0;
          
          const targetTitle = job.title.toLowerCase();
          const targetCompany = job.companyName.toLowerCase();
          const targetLocation = (job.location || '').toLowerCase();

          for (const result of json.results) {
            const resTitle = (result.title || '').toLowerCase();
            const resCompany = (result.company?.display_name || '').toLowerCase();
            const resLocation = (result.location?.display_name || '').toLowerCase();
            const resUrl = (result.redirect_url || '').toLowerCase();

            let strength: MatchStrength = 'NONE';

            // EXACT: canonical URL or provider ID
            if (job.sourceUrl && resUrl === job.sourceUrl.toLowerCase()) {
              strength = 'EXACT';
            } 
            // STRONG: exact title + exact company + no location conflict
            else if (resTitle === targetTitle && resCompany === targetCompany) {
              if (targetLocation && resLocation && !resLocation.includes(targetLocation) && !targetLocation.includes(resLocation) && resLocation !== 'remote' && targetLocation !== 'remote') {
                 // Location conflict -> WEAK or AMBIGUOUS, let's say WEAK
                 strength = 'WEAK';
              } else {
                 strength = 'STRONG';
              }
            } 
            // PARTIAL: meaningful partial structured match (e.g. title includes target, company exactly matches)
            else if (resTitle.includes(targetTitle) && resCompany === targetCompany) {
              strength = 'PARTIAL';
            }
            // WEAK: fuzzy match
            else if (resTitle.includes(targetTitle) || resCompany.includes(targetCompany)) {
              strength = 'WEAK';
            }

            if (strength === 'EXACT') {
              bestMatch = result;
              bestStrength = 'EXACT';
              matchCount = 1;
              break; // Hard exact match stops search
            } else if (strength === 'STRONG' && bestStrength !== 'EXACT') {
              if (bestStrength === 'STRONG') {
                 // Multiple STRONG matches -> AMBIGUOUS
                 bestStrength = 'AMBIGUOUS';
              } else {
                 bestMatch = result;
                 bestStrength = 'STRONG';
              }
            } else if (strength === 'PARTIAL' && bestStrength !== 'EXACT' && bestStrength !== 'STRONG' && bestStrength !== 'AMBIGUOUS') {
              bestMatch = result;
              bestStrength = 'PARTIAL';
            } else if (strength === 'WEAK' && bestStrength === 'NONE') {
              bestMatch = result;
              bestStrength = 'WEAK';
            }
          }

          if (bestStrength === 'EXACT' || bestStrength === 'STRONG') {
            resolve({
              status: 'OBSERVED_ON_SOURCE',
              targetSource: 'ADZUNA',
              checkQuery: query,
              matchStrength: bestStrength,
              observedUrl: bestMatch?.redirect_url
            });
          } else if (bestStrength === 'PARTIAL' || bestStrength === 'WEAK' || bestStrength === 'AMBIGUOUS') {
            resolve({
              status: 'UNKNOWN',
              targetSource: 'ADZUNA',
              checkQuery: query,
              matchStrength: bestStrength
            });
          } else {
            resolve({
              status: 'NOT_OBSERVED_ON_CHECKED_SOURCES',
              targetSource: 'ADZUNA',
              checkQuery: query,
              matchStrength: 'NONE'
            });
          }

        } catch (e) {
          resolve({ status: 'UNKNOWN', targetSource: 'ADZUNA', checkQuery: query });
        }
      });
    });

    req.on('error', (e) => {
      resolve({ status: 'UNKNOWN', targetSource: 'ADZUNA', checkQuery: query });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ status: 'UNKNOWN', targetSource: 'ADZUNA', checkQuery: query });
    });
  });
}
