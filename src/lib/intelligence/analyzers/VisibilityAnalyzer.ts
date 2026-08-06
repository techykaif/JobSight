import { BaseAnalyzer } from './BaseAnalyzer.js';
import type { AnalyzerContext, AnalyzerResult, VisibilityLevel } from '../interfaces.js';

export class VisibilityAnalyzer extends BaseAnalyzer {
  id = 'analyzer_visibility';
  name = 'Visibility Analyzer';
  version = '1.0.0';

  async analyze(context: AnalyzerContext): Promise<AnalyzerResult> {
    const signals: string[] = [];
    const unknowns: string[] = [];
    let score = 0;
    
    if (context.sourceProviderType) {
      if (context.sourceProviderType === 'SEARCH_ENGINE') {
        signals.push('Discovered via public search engine');
        score += 3;
      } else if (context.sourceProviderType === 'RSS') {
        signals.push('Discovered via RSS feed');
        score += 1;
      } else {
        signals.push(`Discovered via explicit provider (${context.sourceProviderType})`);
        score -= 1;
      }
    } else {
      unknowns.push('sourceProviderType');
    }

    if (context.sourceUrl) {
      if (context.sourceUrl.includes('linkedin.com') || context.sourceUrl.includes('indeed.com') || context.sourceUrl.includes('glassdoor.com')) {
        signals.push('Aggregator presence detected');
        score += 3;
      } else if (!context.sourceUrl.includes('google.com') && !context.sourceUrl.includes('bing.com')) {
         signals.push('Direct URL access (No aggregator observed)');
         score -= 1;
      }
    } else {
      unknowns.push('sourceUrl');
    }

    let level: VisibilityLevel = 'UNKNOWN';
    if (unknowns.length >= 2) level = 'UNKNOWN';
    else if (score >= 4) level = 'HIGH';
    else if (score >= 2) level = 'MEDIUM';
    else if (score >= 0) level = 'LOW';
    else level = 'VERY_LOW';

    return {
      output: { visibility: level },
      confidence: unknowns.length === 0 ? 80 : 40,
      signals,
      unknowns
    };
  }
}
