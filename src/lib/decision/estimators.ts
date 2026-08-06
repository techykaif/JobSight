import type { DecisionContext, RoiLevel, UrgencyLevel } from './interfaces.js';

export function estimateApplicationRoi(context: DecisionContext): RoiLevel {
  const text = (context.job.rawContent || '').toLowerCase();
  
  if (text.includes('take-home project') || text.includes('coding assessment') || text.includes('cover letter required')) {
    return 'LOW'; // High effort, lower return on time invested unless highly qualified
  }

  if (context.job.sourceUrl?.includes('easy-apply') || context.job.sourceUrl?.includes('linkedin.com/jobs/view')) {
    return 'HIGH'; // Low effort, high return on time
  }

  if (context.job.sourceUrl?.includes('greenhouse.io') || context.job.sourceUrl?.includes('lever.co')) {
    return 'MEDIUM'; // Standard ATS forms
  }

  if (text.includes('email your resume') || text.includes('manual email')) {
    return 'MEDIUM';
  }

  return 'UNKNOWN';
}

export function estimateUrgency(context: DecisionContext): UrgencyLevel {
  if (context.discovery.freshness === 'TODAY' || context.opportunity.priority === 'URGENT') {
    return 'TODAY';
  }
  
  if (context.discovery.freshness === 'THIS_WEEK') {
    return 'THIS_WEEK';
  }

  const text = (context.job.rawContent || '').toLowerCase();
  if (text.includes('closing soon') || text.includes('urgent hire') || text.includes('limited openings')) {
    return 'SOON';
  }

  if (context.discovery.freshness === 'OLDER') {
    return 'LATER';
  }

  return 'UNKNOWN';
}
