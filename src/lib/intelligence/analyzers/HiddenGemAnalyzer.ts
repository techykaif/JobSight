import { BaseAnalyzer } from './BaseAnalyzer.js';
import type { AnalyzerContext, AnalyzerResult, HiddenGemLevel } from '../interfaces.js';

export class HiddenGemAnalyzer extends BaseAnalyzer {
  id = 'analyzer_hidden_gem';
  name = 'Hidden Gem Analyzer';
  version = '1.0.0';

  async analyze(context: AnalyzerContext): Promise<AnalyzerResult> {
    const signals: string[] = [];
    const unknowns: string[] = [];
    let score = 0;
    
    // Evaluate provider type
    if (context.sourceProviderType) {
      if (['GREENHOUSE', 'LEVER', 'ASHBY', 'WORKDAY'].includes(context.sourceProviderType)) {
        signals.push('Official ATS Provider detected');
        score += 2;
      } else if (context.sourceProviderType === 'CAREERS_PAGE') {
        signals.push('Official Career Page detected');
        score += 3;
      } else if (context.sourceProviderType === 'SEARCH_ENGINE') {
        signals.push('Discovered via public search engine (High visibility)');
        score -= 2;
      }
    } else {
      unknowns.push('sourceProviderType');
    }

    // Evaluate URL structure
    if (context.sourceUrl) {
      if (context.sourceUrl.includes('linkedin.com') || context.sourceUrl.includes('indeed.com')) {
        signals.push('Aggregator URL detected (Saturated)');
        score -= 3;
      }
    } else {
      unknowns.push('sourceUrl');
    }

    let level: HiddenGemLevel = 'UNKNOWN';
    if (unknowns.length >= 2) level = 'UNKNOWN';
    else if (score >= 3) level = 'VERY_HIGH';
    else if (score >= 1) level = 'HIGH';
    else if (score >= -1) level = 'MEDIUM';
    else level = 'LOW';

    return {
      output: { hiddenGem: level },
      confidence: unknowns.length === 0 ? 90 : 50,
      signals,
      unknowns
    };
  }
}
