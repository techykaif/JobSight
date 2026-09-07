import { describe, it, expect } from 'vitest';
import { runCompetitionIntelligence } from '../lib/competition/engine';

describe('Cross-Run Competition Isolation', () => {
  it('should maintain UNKNOWN competition isolation', async () => {
    const result = await runCompetitionIntelligence({} as any);
    expect(result.result.level).toBe('UNKNOWN');
  });
});
