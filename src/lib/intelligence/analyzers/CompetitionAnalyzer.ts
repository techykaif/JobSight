import { BaseAnalyzer } from './BaseAnalyzer.js';
import type { AnalyzerContext, AnalyzerResult, CompetitionLevel } from '../interfaces.js';

export class CompetitionAnalyzer extends BaseAnalyzer {
  id = 'analyzer_competition';
  name = 'Competition Analyzer';
  version = '1.0.0';

  async analyze(context: AnalyzerContext): Promise<AnalyzerResult> {
    const signals: string[] = [];
    const unknowns: string[] = [];
    let score = 0;
    
    // We only use observable signals, never fake applicant counts.
    
    if (context.sourceUrl) {
      if (context.sourceUrl.includes('linkedin.com/jobs/view') || context.sourceUrl.includes('easy-apply')) {
        signals.push('Easy Apply / Quick Apply feature suspected (High friction-reduction)');
        score += 3;
      }
    } else {
      unknowns.push('applicationMethod');
    }

    if (context.job.remoteType) {
      if (context.job.remoteType === 'REMOTE') {
        if (!context.job.location || context.job.location.toLowerCase().includes('worldwide') || context.job.location.toLowerCase().includes('anywhere')) {
          signals.push('Remote Worldwide (Global competition pool)');
          score += 3;
        } else {
          signals.push(`Remote Regional (${context.job.location}) (Restricted competition pool)`);
          score += 1;
        }
      } else {
        signals.push('On-site or Hybrid (Local competition pool only)');
        score -= 2;
      }
    } else {
      unknowns.push('remoteType');
    }

    if (context.sourceProviderType === 'SEARCH_ENGINE') {
      signals.push('Discovered via public search engine (High exposure)');
      score += 1;
    }

    let level: CompetitionLevel = 'UNKNOWN';
    if (unknowns.length >= 2) level = 'UNKNOWN';
    else if (score >= 4) level = 'HIGH';
    else if (score >= 1) level = 'MEDIUM';
    else level = 'LOW';

    return {
      output: { competition: level },
      confidence: unknowns.length === 0 ? 85 : 50,
      signals,
      unknowns
    };
  }
}
