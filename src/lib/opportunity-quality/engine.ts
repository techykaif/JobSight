import type { CanonicalOpportunityQuality, OpportunityQualitySignals, SignalLevel, FreshnessSignalLevel, CompensationSignalLevel, OpportunityLevel, ConfidenceLevel } from './interfaces.js';

export interface OpportunityQualityContext {
  job: any;
  runId: string;
  sourceUrl?: string;
  sourceProviderType?: string;
  rawContent?: string;
  similarJobsInRun?: any[];
  secondaryEvidence?: import('../pipeline/secondary-evidence.js').CrossReferenceResult;
  injectedCompetition?: import('./interfaces.js').SignalLevel; // Test injection only
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
  
  if (context.secondaryEvidence) {
    if (context.secondaryEvidence.status === 'OBSERVED_ON_SOURCE') {
      if (context.secondaryEvidence.matchStrength === 'EXACT' || context.secondaryEvidence.matchStrength === 'PARTIAL') {
        visibility = 'HIGH';
        evidence.push(`High visibility: Independently observed on aggregator/search (${context.secondaryEvidence.targetSource}) with strong match.`);
      } else {
        visibility = 'UNKNOWN';
        evidence.push(`Visibility unknown: Weak/ambiguous mention observed on (${context.secondaryEvidence.targetSource}), insufficient to prove definitive cross-posting.`);
      }
    } else if (context.secondaryEvidence.status === 'NOT_OBSERVED_ON_CHECKED_SOURCE') {
      visibility = 'UNKNOWN';
      evidence.push(`Visibility unknown: Not observed on checked aggregator/search (${context.secondaryEvidence.targetSource}), but true visibility cannot be proven.`);
    } else {
      evidence.push('Visibility unknown: Secondary verification failed or returned unknown.');
    }
  } else {
    evidence.push('Visibility unknown: No secondary evidence provided.');
  }

  // 2. Competition & Applicant Volume
  // Phase 8.5 Audit: No available ATS provider (Greenhouse, Lever, Ashby, Workday) natively 
  // exposes explicit applicant counts or valid competition metadata. 
  // We do not scrape LinkedIn due to lack of supported path.
  // We do not infer competition from remote status, job age, or visibility.
  let competition: SignalLevel = 'UNKNOWN';
  let applicantVolume: number | 'UNKNOWN' = 'UNKNOWN';
  
  if (context.injectedCompetition) {
    competition = context.injectedCompetition;
    evidence.push(`Competition ${competition}: Test injection override.`);
  } else {
    evidence.push('Competition unknown: No legitimate source of applicant volume available.');
  }

  // 3. Compensation
  // We do not have market-baseline data.
  let compensation: CompensationSignalLevel = 'UNKNOWN';
  evidence.push('Market compensation quality is UNKNOWN (candidate target fit separated).');

  // 4. Freshness
  let freshness: FreshnessSignalLevel = 'UNKNOWN';
  // Use explicitly extracted postingDate. Do NOT infer posting date merely from crawl time (firstSeenAt).
  const postedAt = (context.job as any).postingDate;
  if (postedAt) {
    const ageMs = Date.now() - new Date(postedAt).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    if (ageDays <= 3) {
      freshness = 'NEW';
      evidence.push(`Freshness: NEW (structured posting date is ${postedAt}, <= 3 days old).`);
    } else if (ageDays <= 14) {
      freshness = 'AGING';
      evidence.push(`Freshness: AGING (structured posting date is ${postedAt}, <= 14 days old).`);
    } else {
      freshness = 'STALE';
      evidence.push(`Freshness: STALE (structured posting date is ${postedAt}, > 14 days old).`);
    }
  } else {
    evidence.push('Freshness: UNKNOWN (missing reliable structured posting timestamp).');
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
