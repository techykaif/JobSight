import type { CompetitionSignal, CompetitionResult, CompetitionSummary } from './interfaces';

export function generateSummary(
  signals: CompetitionSignal[],
  result: CompetitionResult
): CompetitionSummary {
  const reasons: string[] = [];

  for (const sig of signals) {
    if (sig.type === 'OFFICIAL_ATS') {
      reasons.push(sig.weight > 0 ? '✓ Official ATS (High Visibility)' : '✓ Direct Application');
    } else if (sig.type === 'DIRECT_CAREERS_PAGE') {
      reasons.push('✓ Direct Careers Page');
    } else if (sig.type === 'REMOTE_AVAILABILITY') {
      reasons.push('✓ Remote Role (Higher Competition)');
    } else if (sig.type === 'POSTING_FRESHNESS') {
      const days = sig.value;
      if (days <= 3) reasons.push('✓ Fresh Posting (Surge of Applicants)');
      else if (days > 30) reasons.push('✓ Older Job (Fewer Active Applicants)');
    } else if (sig.type === 'PROVIDER_POPULARITY') {
      reasons.push('✓ Discovered on Major Job Board');
    } else {
      reasons.push(`✓ Evaluated ${sig.type}`);
    }
  }

  // Deduplicate
  const uniqueReasons = Array.from(new Set(reasons));

  return {
    reasons: uniqueReasons.slice(0, 5)
  };
}
