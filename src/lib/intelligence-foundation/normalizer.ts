import type { ObservableSignal, NormalizedEvidence } from './interfaces';
import crypto from 'crypto';

export function normalizeSignals(signals: ObservableSignal[]): NormalizedEvidence[] {
  const evidence: NormalizedEvidence[] = [];

  for (const signal of signals) {
    let weight = 1;
    let confidence = 100;
    let title = '';
    let description = '';

    switch (signal.type) {
      case 'SALARY_MIN':
        title = 'Minimum Salary Disclosed';
        description = `Salary minimum is ${signal.value}`;
        weight = 2;
        break;
      case 'SALARY_MAX':
        title = 'Maximum Salary Disclosed';
        description = `Salary maximum is ${signal.value}`;
        weight = 2;
        break;
      case 'REMOTE_POLICY':
        title = 'Remote Policy Available';
        description = `Remote policy is ${signal.value}`;
        weight = 3;
        break;
      case 'EXPERIENCE_MATCH':
        title = 'Experience Match Available';
        description = `Experience required: ${signal.value.min}${signal.value.max ? '-' + signal.value.max : '+'} years`;
        weight = 3;
        break;
      case 'EMPLOYMENT_TYPE':
        title = 'Employment Type Disclosed';
        description = `Employment type: ${signal.value}`;
        weight = 1;
        break;
      case 'LOCATION_MATCH':
        title = 'Location Available';
        description = `Location: ${signal.value}`;
        weight = 1;
        break;
      case 'POSTING_FRESHNESS':
        title = 'Posting Freshness';
        description = `Posted ${signal.value} days ago`;
        weight = 2;
        break;
      default:
        title = signal.type;
        description = `Value: ${JSON.stringify(signal.value)}`;
        weight = 1;
        break;
    }

    // Determine category based on the signal category matching 
    // We already have signal.category in the Provider, but the signal object doesn't have it directly. 
    // Wait, the ObservableSignal doesn't have category. Let's infer or map.
    let category = 'UNKNOWN' as any;
    if (signal.type.startsWith('SALARY')) category = 'SALARY';
    else if (signal.type === 'REMOTE_POLICY') category = 'REMOTE';
    else if (['EXPERIENCE_MATCH', 'EMPLOYMENT_TYPE', 'LOCATION_MATCH'].includes(signal.type)) category = 'REQUIREMENTS';
    else category = 'COMPANY';

    evidence.push({
      id: crypto.randomUUID(),
      category,
      title,
      description,
      observedValue: signal.value,
      normalizedValue: String(signal.value),
      weight,
      confidence,
      source: signal.metadata?.source || 'unknown',
      timestamp: signal.metadata?.timestamp || new Date().toISOString(),
      metadata: signal.metadata as Record<string, any> | undefined
    });
  }

  return evidence;
}
