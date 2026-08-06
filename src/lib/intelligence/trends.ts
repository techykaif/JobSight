export type HiringTrend = 'GROWING' | 'STABLE' | 'DECLINING' | 'UNKNOWN';

export function detectHiringTrend(historicalJobCounts: number[]): HiringTrend {
  if (!historicalJobCounts || historicalJobCounts.length < 2) {
    return 'UNKNOWN';
  }

  // A very basic deterministic comparison of the most recent vs oldest available in the window
  const oldest = historicalJobCounts[0];
  const newest = historicalJobCounts[historicalJobCounts.length - 1];

  if (oldest === undefined || newest === undefined) return 'UNKNOWN';

  if (oldest === 0 && newest > 0) return 'GROWING';
  if (oldest === 0 && newest === 0) return 'UNKNOWN';

  const growthRatio = (newest - oldest) / oldest;

  if (growthRatio > 0.2) return 'GROWING';
  if (growthRatio < -0.2) return 'DECLINING';
  
  return 'STABLE';
}
