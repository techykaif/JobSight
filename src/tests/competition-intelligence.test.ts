import { describe, it, expect } from 'vitest';
import { runCompetitionIntelligence } from '../lib/competition/engine';

describe('Competition Intelligence Engine', () => {
  it('should explicitly return UNKNOWN per Phase 8.5 audit rules', async () => {
    const result = await runCompetitionIntelligence({} as any);
    expect(result.result.level).toBe('UNKNOWN');
    expect(result.summary.reasons[0]).toContain('UNKNOWN');
  });
});
