import type {
  MarketIntelligenceContext,
  VisibilityAssessment,
  CompetitionAssessment,
  HiringFrictionAssessment,
  OpportunityLevel,
  AssessmentLevel,
  ConfidenceLevel,
  ApplicantVolumeEvidence
} from './interfaces.js';

export class VisibilityAnalyzer {
  public analyze(context: MarketIntelligenceContext): VisibilityAssessment {
    const url = (context.sourceUrl || '').toLowerCase();
    const provider = context.sourceProviderType || 'UNKNOWN';

    // 1. Direct Source detection
    const directProviders = ['CAREERS_PAGE', 'GREENHOUSE', 'LEVER', 'ASHBY', 'WORKDAY'];
    let directSource = directProviders.includes(provider);

    if (url.includes('jobs.lever.co') || url.includes('boards.greenhouse.io') || url.includes('jobs.ashbyhq.com') || url.includes('myworkdayjobs.com')) {
      directSource = true;
    }

    // 2. Mainstream Aggregator detection
    const mainstreamAggregators = ['linkedin.com', 'indeed.com', 'glassdoor.com', 'ziprecruiter.com'];
    const mainstreamAggregatorPresence = mainstreamAggregators.some(agg => url.includes(agg));

    // 3. Duplicates / Discovery channels
    // Since we don't have explicit duplicate tracking in Context right now beyond similarJobsInRun
    // We proxy it by looking at jobs in run with identical titles/companies if available.
    let duplicateCount = 0;
    if (context.similarJobsInRun && context.job.title) {
      const sameTitle = context.similarJobsInRun.filter(j =>
        j.title === context.job.title &&
        j.companyName === context.job.companyName &&
        j.sourceUrl !== context.job.sourceUrl
      );
      duplicateCount = sameTitle.length;
    }

    const discoverySourceCount = 1 + duplicateCount;

    // Assume freshness is unknown without a structured timestamp.
    let freshness = 'UNKNOWN';

    // Calculate level
    let level: AssessmentLevel = 'UNKNOWN';
    let conf: ConfidenceLevel = 'LOW';

    if (mainstreamAggregatorPresence) {
      level = 'HIGH';
      conf = 'HIGH';
    } else if (directSource && duplicateCount === 0) {
      level = 'LOW';
      conf = 'MEDIUM';
    } else if (directSource && duplicateCount > 0) {
      level = 'MEDIUM';
      conf = 'MEDIUM';
    } else if (provider === 'SEARCH_ENGINE') {
      level = 'MEDIUM';
      conf = 'LOW';
    }

    return {
      level,
      evidence: {
        directSource,
        mainstreamAggregatorPresence,
        discoverySourceCount,
        duplicateCount,
        freshness
      },
      confidence: conf
    };
  }
}

export class CompetitionAnalyzer {
  public analyze(context: MarketIntelligenceContext): CompetitionAssessment {
    const rawContent = (context.rawContent || '').toLowerCase();

    let applicantVolume: ApplicantVolumeEvidence | undefined = undefined;
    const indicators: string[] = [];

    // Attempt to parse actual applicant counts from raw content
    // Look for phrases like "47 applicants", "Over 100 applicants", "250+ applicants", "Be among the first 25 applicants"
    const amongFirstMatch = rawContent.match(/be among the first\s+(\d{1,5})\s+(?:applicants?|candidates?)/i);
    const overMatch = rawContent.match(/(?:^|\s)over\s+(\d{1,5})\s+(?:applicants?|candidates?)/i);
    const plusMatch = rawContent.match(/(?:^|\s)(\d{1,5})\+\s+(?:applicants?|candidates?)/i);
    const exactMatch = rawContent.match(/(?:^|\s)(\d{1,5})\s+(?:applicants?|candidates?)/i);

    let val = 0;
    let isLowerBound = false;

    if (amongFirstMatch && amongFirstMatch[1]) {
      val = parseInt(amongFirstMatch[1], 10);
      isLowerBound = true;
    } else if (overMatch && overMatch[1]) {
      val = parseInt(overMatch[1], 10);
      isLowerBound = true;
    } else if (plusMatch && plusMatch[1]) {
      val = parseInt(plusMatch[1], 10);
      isLowerBound = true;
    } else if (exactMatch && exactMatch[1]) {
      val = parseInt(exactMatch[1], 10);
    }

    if (val > 0) {
      applicantVolume = {
        value: val,
        isLowerBound,
        source: 'RAW_CONTENT',
        observedAt: new Date().toISOString()
      };
    }

    let directEvidence = !!applicantVolume;
    let level: AssessmentLevel = 'UNKNOWN';
    let conf: ConfidenceLevel = 'UNKNOWN';

    if (applicantVolume) {
      conf = 'HIGH';
      if (applicantVolume.value > 100) {
        level = 'HIGH';
        indicators.push(`High applicant volume observed: ${applicantVolume.value}${isLowerBound ? '+' : ''}`);
      } else if (applicantVolume.value > 30) {
        level = 'MEDIUM';
        indicators.push(`Medium applicant volume observed: ${applicantVolume.value}${isLowerBound ? '+' : ''}`);
      } else {
        level = 'LOW';
        indicators.push(`Low applicant volume observed: ${applicantVolume.value}${isLowerBound ? '+' : ''}`);
      }
    } else {
      // Fallback heuristics just to populate indicators if missing volume, but keep level UNKNOWN
      conf = 'UNKNOWN';
      indicators.push('No direct applicant volume found.');
    }

    return {
      level,
      ...(applicantVolume ? { applicantVolume } : {}),
      evidence: {
        directEvidence,
        indicators
      },
      confidence: conf
    };
  }
}

export class HiringFrictionAnalyzer {
  public analyze(context: MarketIntelligenceContext): HiringFrictionAssessment {
    const rawContent = (context.rawContent || '').toLowerCase();

    // We parse basic signals from the text on the application page if available
    let resumeRequired = rawContent.includes('upload resume') || rawContent.includes('attach resume') || rawContent.includes('resume *') || rawContent.includes('resume required');
    let coverLetterRequired = rawContent.includes('cover letter *') || rawContent.includes('cover letter required');
    let accountRequired = rawContent.includes('create account to apply') || rawContent.includes('sign in to apply') || rawContent.includes('log in to apply') || rawContent.includes('create an account') || rawContent.includes('account required');
    let assessmentRequired = rawContent.includes('take assessment') || rawContent.includes('complete assessment') || rawContent.includes('test required');
    let externalRedirect = !!(rawContent.includes('apply on company website') || (context.sourceUrl?.includes('linkedin.com') && rawContent.includes('apply externally')));
    let multiStep = rawContent.includes('step 1 of') || rawContent.includes('next step');

    let accessible = !!rawContent && rawContent.length > 50;

    let signals = {
      resumeRequired,
      coverLetterRequired,
      accountRequired,
      assessmentRequired,
      externalRedirect,
      multiStep,
      accessible
    };

    let level: AssessmentLevel = 'UNKNOWN';
    let conf: ConfidenceLevel = 'UNKNOWN';

    if (!accessible) {
      level = 'UNKNOWN';
      conf = 'LOW';
    } else {
      let frictionScore = 0;
      if (coverLetterRequired) frictionScore += 2;
      if (accountRequired) frictionScore += 3;
      if (assessmentRequired) frictionScore += 2;
      if (multiStep) frictionScore += 1;

      conf = 'MEDIUM';
      if (frictionScore >= 4) level = 'HIGH';
      else if (frictionScore >= 2) level = 'MEDIUM';
      else level = 'LOW';
    }

    return {
      level,
      signals,
      confidence: conf
    };
  }
}

export class OpportunityIntelligenceEvaluator {
  public evaluate(
    visibility: VisibilityAssessment,
    competition: CompetitionAssessment,
    friction: HiringFrictionAssessment
  ): OpportunityLevel {

    // Rule 1: HIGH competition must dominate and is always UNFAVORABLE.
    if (competition.level === 'HIGH') {
      return 'UNFAVORABLE';
    }

    // Rule 2: UNKNOWN competition must never be treated as LOW competition.
    if (competition.level === 'UNKNOWN') {
      return 'INSUFFICIENT_EVIDENCE';
    }

    // Rule 3: Explicit LOW competition is FAVORABLE.
    // Case H (LOW Visibility, LOW Competition, HIGH Friction):
    // This is classified as FAVORABLE. The reasoning is that the JobSight mission seeks
    // "legitimate opportunities that are less visible and, where evidence supports it, less crowded".
    // Explicitly low applicant volume means it is empirically less crowded.
    // High friction actually protects this state by establishing a barrier to entry,
    // which aligns perfectly with finding uniquely favorable opportunities for committed candidates.
    if (competition.level === 'LOW') {
      return 'FAVORABLE';
    }

    // Rule 4: If competition is MEDIUM, we fall back to NEUTRAL.
    // It's neither exceptionally good nor exceptionally bad.
    return 'NEUTRAL';
  }
}
