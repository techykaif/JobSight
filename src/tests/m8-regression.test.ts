import { describe, it, expect, vi } from 'vitest';
import { runMission } from '../lib/pipeline/orchestrator';
import { db } from '../lib/db/client';
import * as schema from '../lib/db/schema';
import crypto from 'crypto';
import { providerRegistry } from '../lib/discovery/registry';
import { SearchEngineProvider } from '../lib/discovery/providers/SearchEngineProvider';
import { missionManager } from '../lib/pipeline/missionManager';

vi.mock('../lib/db/client', () => {
  return {
    db: {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnValue([{}]),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockResolvedValue({})
    }
  };
});

describe('M8 Regression Tests', () => {
  it('SearchEngineProvider generates targeted ATS dorks for stealth strategy', () => {
    const provider = new SearchEngineProvider();
    const context = {
      runId: 'test',
      sourceUrl: 'SEARCH_ENGINE',
      targetRoles: ['Software Engineer'],
      alternativeRoles: [],
      location: 'India',
      remoteOnly: true,
      strategyName: 'stealth strategy',
      requiredSkills: ['React']
    };
    const query = (provider as any).buildSearchQuery(context);
    expect(query).toContain('site:jobs.lever.co');
    expect(query).toContain('"Software Engineer"');
    expect(query).toContain('"remote"');
    expect(query).not.toContain('"India"'); // remoteOnly prevents location
    expect(query).toContain('"React"');
  });

  it('SearchEngineProvider generates targeted dorks for enterprise strategy', () => {
    const provider = new SearchEngineProvider();
    const context = {
      runId: 'test',
      sourceUrl: 'SEARCH_ENGINE',
      targetRoles: ['Backend Engineer'],
      alternativeRoles: [],
      strategyName: 'enterprise',
      requiredSkills: []
    };
    const query = (provider as any).buildSearchQuery(context);
    expect(query).toContain('site:myworkdayjobs.com');
    expect(query).toContain('"Backend Engineer"');
  });

});
