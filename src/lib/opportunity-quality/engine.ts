import type { CanonicalOpportunityQuality, OpportunityQualitySignals, SignalLevel, FreshnessSignalLevel, CompensationSignalLevel, OpportunityLevel, ConfidenceLevel } from './interfaces.js';

export interface OpportunityQualityContext {
  job: any;
  runId: string;
  sourceUrl?: string;
  sourceProviderType?: string;
  rawContent?: string;
  similarJobsInRun?: any[];
}

export function evaluateCanonicalOpportunityQuality(context: OpportunityQualityContext): CanonicalOpportunityQuality {
  const url = (context.sourceUrl || '').toLowerCase();
  const provider = context.sourceProviderType || 'UNKNOWN';
  const rawContent = (context.rawContent || '').toLowerCase();
  
  const evidence: string[] = [];

  // 1. Visibility
  let visibility: SignalLevel = 'UNKNOWN';
  const directProviders = ['CAREERS_PAGE', 'GREENHOUSE', 'LEVER', 'ASHBY', 'WORKDAY'];
  let directSource = directProviders.includes(provider);
  if (url.includes('jobs.lever.co') || url.includes('boards.greenhouse.io') || url.includes('jobs.ashbyhq.com') || url.includes('myworkdayjobs.com')) {
    directSource = true;
  }
  const mainstreamAggregators = ['linkedin.com', 'indeed.com', 'glassdoor.com', 'ziprecruiter.com'];
  const mainstreamAggregatorPresence = mainstreamAggregators.some(agg => url.includes(agg));
  let duplicateCount = 0;
  if (context.similarJobsInRun && context.job.title) {
    duplicateCount = context.similarJobsInRun.filter(j =>
      j.title === context.job.title &&
      j.companyName === context.job.companyName &&
      j.sourceUrl !== context.job.sourceUrl
    ).length;
  }

  if (mainstreamAggregatorPresence) {
    visibility = 'HIGH';
    evidence.push('High visibility: found on mainstream aggregator.');
  } else if (directSource && duplicateCount === 0) {
    visibility = 'LOW';
    evidence.push('Low visibility: direct source with no duplicates.');
  } else if (directSource && duplicateCount > 0) {
    visibility = 'MEDIUM';
    evidence.push('Medium visibility: direct source but multiple similar jobs found.');
  } else if (provider === 'SEARCH_ENGINE') {
    visibility = 'MEDIUM';
    evidence.push('Medium visibility: found via search engine.');
  }

  // 2. Competition & Applicant Volume
  let competition: SignalLevel = 'UNKNOWN';
  let applicantVolume: number | 'UNKNOWN' = 'UNKNOWN';
  const amongFirstMatch = rawContent.match(/be among the first\s+(\d{1,5})\s+(?:applicants?|candidates?)/i);
  const overMatch = rawContent.match(/(?:^|\s)over\s+(\d{1,5})\s+(?:applicants?|candidates?)/i);
  const plusMatch = rawContent.match(/(?:^|\s)(\d{1,5})\+\s+(?:applicants?|candidates?)/i);
  const exactMatch = rawContent.match(/(?:^|\s)(\d{1,5})\s+(?:applicants?|candidates?)/i);

  let val = 0;
  if (amongFirstMatch && amongFirstMatch[1]) val = parseInt(amongFirstMatch[1], 10);
  else if (overMatch && overMatch[1]) val = parseInt(overMatch[1], 10);
  else if (plusMatch && plusMatch[1]) val = parseInt(plusMatch[1], 10);
  else if (exactMatch && exactMatch[1]) val = parseInt(exactMatch[1], 10);

  if (val > 0) {
    applicantVolume = val;
    if (val > 100) {
      competition = 'HIGH';
      evidence.push(`High competition: ${val} applicants observed.`);
    } else if (val > 30) {
      competition = 'MEDIUM';
      evidence.push(`Medium competition: ${val} applicants observed.`);
    } else {
      competition = 'LOW';
      evidence.push(`Low competition: ${val} applicants observed.`);
    }
  } else {
    evidence.push('Unknown competition: no direct applicant volume found.');
  }

  // 3. Compensation
  // We do not have market-baseline data.
  let compensation: CompensationSignalLevel = 'UNKNOWN';
  evidence.push('Market compensation quality is UNKNOWN (candidate target fit separated).');

  // 4. Freshness
  let freshness: FreshnessSignalLevel = 'UNKNOWN';
  const seenAt = context.job.firstSeenAt;
  if (seenAt) {
    const ageMs = Date.now() - new Date(seenAt).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    if (ageDays <= 3) {
      freshness = 'NEW';
      evidence.push('Freshness: NEW (discovered recently).');
    } else if (ageDays <= 14) {
      freshness = 'AGING';
      evidence.push('Freshness: AGING (discovered up to 2 weeks ago).');
    } else {
      freshness = 'STALE';
      evidence.push('Freshness: STALE (discovered more than 2 weeks ago).');
    }
  } else {
    evidence.push('Freshness: UNKNOWN (missing reliable timestamp).');
  }

  // 5. Hiring Friction
  let friction: SignalLevel = 'UNKNOWN';
  let resumeRequired = rawContent.includes('upload resume') || rawContent.includes('attach resume') || rawContent.includes('resume *') || rawContent.includes('resume required');
  let coverLetterRequired = rawContent.includes('cover letter *') || rawContent.includes('cover letter required');
  let accountRequired = rawContent.includes('create account to apply') || rawContent.includes('sign in to apply') || rawContent.includes('log in to apply') || rawContent.includes('create an account');
  let assessmentRequired = rawContent.includes('take assessment') || rawContent.includes('complete assessment') || rawContent.includes('test required');
  let multiStep = rawContent.includes('step 1 of') || rawContent.includes('next step');
  let accessible = !!rawContent && rawContent.length > 50;
  
  if (accessible) {
    let frictionScore = 0;
    if (coverLetterRequired) frictionScore += 2;
    if (accountRequired) frictionScore += 3;
    if (assessmentRequired) frictionScore += 2;
    if (multiStep) frictionScore += 1;
    if (frictionScore >= 4) { friction = 'HIGH'; evidence.push('High hiring friction.'); }
    else if (frictionScore >= 2) { friction = 'MEDIUM'; evidence.push('Medium hiring friction.'); }
    else { friction = 'LOW'; evidence.push('Low hiring friction.'); }
  }

  // 6. Authenticity/Provenance
  let authenticity: SignalLevel = 'UNKNOWN';
  if (directSource) {
    authenticity = 'HIGH';
    evidence.push('High authenticity: verified direct source or ATS.');
  } else if (mainstreamAggregatorPresence) {
    authenticity = 'MEDIUM';
    evidence.push('Medium authenticity: mainstream aggregator.');
  } else {
    authenticity = 'LOW';
    evidence.push('Low authenticity: unverified generic source.');
  }

  // Evaluate final OpportunityLevel
  let opportunityLevel: OpportunityLevel = 'NEUTRAL';
  if (competition === 'HIGH') {
    opportunityLevel = 'UNFAVORABLE';
  } else if (competition === 'UNKNOWN') {
    opportunityLevel = 'INSUFFICIENT_EVIDENCE';
  } else if (competition === 'LOW') {
    // LOW visibility + LOW competition => FAVORABLE
    // HIGH visibility + LOW competition => FAVORABLE
    // Basically explicitly low competition means FAVORABLE.
    opportunityLevel = 'FAVORABLE';
  }
  
  // If authenticity is LOW, limit it from being FAVORABLE.
  if (opportunityLevel === 'FAVORABLE' && authenticity === 'LOW') {
    opportunityLevel = 'NEUTRAL';
    evidence.push('Downgraded from FAVORABLE to NEUTRAL due to LOW authenticity.');
  }

  const confidence: ConfidenceLevel = (competition !== 'UNKNOWN') ? 'HIGH' : 'LOW';

  return {
    opportunityLevel,
    confidence,
    signals: {
      visibility,
      competition,
      applicantVolume,
      compensation,
      freshness,
      friction,
      authenticity
    },
    evidence
  };
}
