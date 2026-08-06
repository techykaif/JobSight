import { BaseAnalyzer } from './BaseAnalyzer.js';
import type { AnalyzerContext, AnalyzerResult, FreshnessLevel } from '../interfaces.js';

export class FreshnessAnalyzer extends BaseAnalyzer {
  id = 'analyzer_freshness';
  name = 'Freshness Analyzer';
  version = '1.0.0';

  async analyze(context: AnalyzerContext): Promise<AnalyzerResult> {
    const signals: string[] = [];
    const unknowns: string[] = [];
    
    // In a real implementation, we would extract postedDate from metadata or the unstructured text.
    // Since we don't have a strict postedDate in DiscoveredJob right now, we will look for text clues or default to UNKNOWN.
    // For the sake of deterministic testing and foundation, if we have raw text we could scan it.
    
    let level: FreshnessLevel = 'UNKNOWN';
    let confidence = 0;

    if (context.job.rawContent) {
      const text = context.job.rawContent.toLowerCase();
      if (text.includes('posted today') || text.includes('just posted') || text.includes('hiring now') || text.includes('hours ago')) {
        signals.push('Text indicates posted today/hours ago');
        level = 'TODAY';
        confidence = 80;
      } else if (text.includes('days ago') || text.includes('this week')) {
        signals.push('Text indicates posted within the last week');
        level = 'THIS_WEEK';
        confidence = 70;
      } else if (text.includes('weeks ago') || text.includes('month ago')) {
        signals.push('Text indicates older posting');
        level = 'OLDER';
        confidence = 70;
      } else {
        unknowns.push('postedDate');
      }
    } else {
      unknowns.push('rawContent');
    }

    if (level === 'UNKNOWN') {
       signals.push('No freshness indicators found, falling back to UNKNOWN');
    }

    return {
      output: { freshness: level },
      confidence,
      signals,
      unknowns
    };
  }
}
