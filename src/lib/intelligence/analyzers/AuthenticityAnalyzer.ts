import { BaseAnalyzer } from './BaseAnalyzer.js';
import type { AnalyzerContext, AnalyzerResult, AuthenticityLevel } from '../interfaces.js';

export class AuthenticityAnalyzer extends BaseAnalyzer {
  id = 'analyzer_authenticity';
  name = 'Authenticity Analyzer';
  version = '1.0.0';

  async analyze(context: AnalyzerContext): Promise<AnalyzerResult> {
    const signals: string[] = [];
    const unknowns: string[] = [];
    let score = 0;
    
    if (context.sourceUrl) {
      if (context.sourceUrl.startsWith('https://')) {
        signals.push('Secure HTTPS origin');
        score += 1;
      }
      
      const isAts = ['greenhouse.io', 'lever.co', 'ashbyhq.com', 'myworkdayjobs.com']
        .some(ats => context.sourceUrl?.includes(ats));
        
      if (isAts) {
        signals.push('Official ATS domain');
        score += 3;
      }

      if (context.job.companyName && context.sourceUrl.toLowerCase().includes(context.job.companyName.toLowerCase().replace(/\s+/g, ''))) {
        signals.push('Domain matches company name');
        score += 2;
      }
    } else {
      unknowns.push('sourceUrl');
    }

    if (context.job.title && context.job.companyName) {
      signals.push('Core metadata present');
      score += 1;
    } else {
      unknowns.push('metadata_completeness');
    }

    let level: AuthenticityLevel = 'UNKNOWN';
    if (unknowns.length >= 2) level = 'UNKNOWN';
    else if (score >= 6) level = 'VERY_HIGH';
    else if (score >= 4) level = 'HIGH';
    else if (score >= 2) level = 'MEDIUM';
    else level = 'LOW';

    return {
      output: { authenticity: level },
      confidence: unknowns.length === 0 ? 95 : 60,
      signals,
      unknowns
    };
  }
}
