import { BaseAnalyzer } from './BaseAnalyzer.js';
import type { AnalyzerContext, AnalyzerResult, SourceTrustLevel } from '../interfaces.js';

export class DiscoverySourceAnalyzer extends BaseAnalyzer {
  id = 'analyzer_discovery_source';
  name = 'Discovery Source Analyzer';
  version = '1.0.0';

  async analyze(context: AnalyzerContext): Promise<AnalyzerResult> {
    const signals: string[] = [];
    const unknowns: string[] = [];
    
    let level: SourceTrustLevel = 'UNKNOWN';
    let confidence = 0;

    if (context.sourceProviderType) {
      switch (context.sourceProviderType) {
        case 'CAREERS_PAGE':
          level = 'HIGHEST';
          confidence = 95;
          signals.push('Official Careers Page (Highest Trust)');
          break;
        case 'GREENHOUSE':
        case 'LEVER':
        case 'ASHBY':
        case 'WORKDAY':
          level = 'VERY_HIGH';
          confidence = 90;
          signals.push(`Official ATS Provider (${context.sourceProviderType}) (Very High Trust)`);
          break;
        case 'RSS':
          level = 'HIGH';
          confidence = 80;
          signals.push('RSS Feed (High Trust)');
          break;
        case 'SEARCH_ENGINE':
          level = 'MEDIUM';
          confidence = 60;
          signals.push('Search Engine (Medium Trust, prone to stale data)');
          break;
        case 'CUSTOM':
          level = 'HIGH'; // Assuming custom added are trusted
          confidence = 70;
          signals.push('Custom Provider (Assumed High Trust)');
          break;
        default:
          level = 'LOWER';
          confidence = 50;
          signals.push('Unknown or aggregate source provider type');
          break;
      }
    } else {
      unknowns.push('sourceProviderType');
      signals.push('Cannot evaluate trust without source provider type');
    }

    return {
      output: { sourceTrust: level },
      confidence,
      signals,
      unknowns
    };
  }
}
