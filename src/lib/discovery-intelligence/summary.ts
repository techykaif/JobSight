import type { DiscoveryIntelligenceSignal, DiscoveryIntelligenceResult, DiscoveryIntelligenceSummary } from './interfaces';
import type { SourceQualityLevel, DiscoveryVisibilityLevel, DiscoveryUniquenessLevel, DiscoveryAuthenticityLevel } from './types';

export function generateDiscoverySummary(
  signals: DiscoveryIntelligenceSignal[],
  result: DiscoveryIntelligenceResult
): DiscoveryIntelligenceSummary {
  let quality: SourceQualityLevel = 'Standard';
  let source = 'Unknown';
  let visibility: DiscoveryVisibilityLevel = 'Medium';
  let uniqueness: DiscoveryUniquenessLevel = 'Medium';
  let authenticity: DiscoveryAuthenticityLevel = 'Unverified';
  let competition = 'Medium';

  for (const sig of signals) {
    if (sig.type === 'OFFICIAL_ATS') {
      source = 'Official ATS';
      quality = 'Premium';
    }
    if (sig.type === 'DIRECT_CAREERS_PAGE') {
      source = 'Direct Careers Page';
      quality = 'Premium';
    }
    if (sig.type === 'AGGREGATOR_SOURCE') {
      source = 'Aggregator Source';
      quality = 'Low';
    }
    
    if (sig.type === 'SOURCE_AUTHENTICITY' && sig.value === 'Verified') {
      authenticity = 'Verified';
    }

    if (sig.type === 'DUPLICATE_DETECTION') {
      if (sig.value === 0) uniqueness = 'High';
      else if (sig.value > 2) uniqueness = 'Low';
    }
  }

  // Derive visibility mostly from quality and uniqueness for now
  if (quality === 'Premium' && uniqueness === 'High') {
    visibility = 'Low'; // Harder for mass aggregators to index easily if it's unique to careers page
  } else if (quality === 'Low') {
    visibility = 'High'; // Aggregators mean high visibility to other job seekers
  }

  return {
    quality,
    source,
    visibility,
    uniqueness,
    competition,
    authenticity,
    evidenceCount: signals.length,
    confidence: result.confidence
  };
}
