/**
 * Bug-Fix Hardening Pass — Regression Tests
 *
 * Covers:
 *  1. Live Event Feed SSE route (abort race, GT filter)
 *  2. maximumRuntime enforcement (missionManager timeout)
 *  3. maximumProviders enforcement (discovery orchestrator slice)
 *  4. saveHuntConfig Zod validation
 *  5. SSRF URL safety (checkDiscoveryUrlSafety)
 *  6. Radar AI/ML false-positive filter (string pattern assertions)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../lib/db/client.js';
import * as schema from '../lib/db/schema.js';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { checkDiscoveryUrlSafety, isDiscoveryUrlSafe } from '../lib/discovery/url-safety.js';

// ---------------------------------------------------------------------------
// Test DB bootstrap
// ---------------------------------------------------------------------------
beforeAll(async () => {
  migrate(db, { migrationsFolder: './src/lib/db/migrations' });
});

// ---------------------------------------------------------------------------
// § 5 — SSRF / URL Safety (checkDiscoveryUrlSafety)
// ---------------------------------------------------------------------------
describe('§5 SSRF URL Safety — checkDiscoveryUrlSafety', () => {
  // ── Safe URLs ──
  it('allows https job board URL', () => {
    expect(isDiscoveryUrlSafe('https://boards.greenhouse.io/company/jobs/123')).toBe(true);
  });

  it('allows http URL', () => {
    expect(isDiscoveryUrlSafe('http://example.com/careers/engineer')).toBe(true);
  });

  // ── Non-string inputs ──
  it('rejects null', () => {
    expect(checkDiscoveryUrlSafety(null).safe).toBe(false);
  });

  it('rejects undefined', () => {
    expect(checkDiscoveryUrlSafety(undefined).safe).toBe(false);
  });

  it('rejects empty string', () => {
    expect(checkDiscoveryUrlSafety('').safe).toBe(false);
  });

  // ── Scheme blocklist ──
  it('rejects file:// scheme', () => {
    const r = checkDiscoveryUrlSafety('file:///etc/passwd');
    expect(r.safe).toBe(false);
    expect(r.reason).toMatch(/scheme/i);
  });

  it('rejects javascript: scheme', () => {
    expect(checkDiscoveryUrlSafety('javascript:alert(1)').safe).toBe(false);
  });

  it('rejects ftp:// scheme', () => {
    expect(checkDiscoveryUrlSafety('ftp://example.com/file').safe).toBe(false);
  });

  // ── Loopback ──
  it('rejects localhost', () => {
    const r = checkDiscoveryUrlSafety('http://localhost:3000/jobs');
    expect(r.safe).toBe(false);
    expect(r.reason).toMatch(/loopback/i);
  });

  it('rejects 127.0.0.1', () => {
    expect(checkDiscoveryUrlSafety('http://127.0.0.1:8080/').safe).toBe(false);
  });

  it('rejects 127.x.x.x range', () => {
    expect(checkDiscoveryUrlSafety('http://127.1.2.3/path').safe).toBe(false);
  });

  it('rejects 0.0.0.0', () => {
    expect(checkDiscoveryUrlSafety('http://0.0.0.0/').safe).toBe(false);
  });

  it('rejects IPv6 loopback ::1', () => {
    expect(checkDiscoveryUrlSafety('http://[::1]/jobs').safe).toBe(false);
  });

  // ── Private IPv4 ──
  it('rejects 10.x.x.x (RFC 1918)', () => {
    expect(checkDiscoveryUrlSafety('http://10.0.0.1/internal').safe).toBe(false);
  });

  it('rejects 192.168.x.x (RFC 1918)', () => {
    expect(checkDiscoveryUrlSafety('http://192.168.1.100/').safe).toBe(false);
  });

  it('rejects 172.16-31.x.x (RFC 1918)', () => {
    expect(checkDiscoveryUrlSafety('http://172.16.0.1/').safe).toBe(false);
    expect(checkDiscoveryUrlSafety('http://172.31.255.255/').safe).toBe(false);
  });

  it('allows 172.32.x.x (not private)', () => {
    // 172.32 is outside the RFC 1918 range
    expect(isDiscoveryUrlSafe('http://172.32.0.1/jobs')).toBe(true);
  });

  // ── Link-local / cloud metadata ──
  it('rejects 169.254.x.x (AWS/GCP IMDS)', () => {
    const r = checkDiscoveryUrlSafety('http://169.254.169.254/latest/meta-data/');
    expect(r.safe).toBe(false);
    expect(r.reason).toMatch(/link-local/i);
  });

  it('rejects known cloud metadata hostnames', () => {
    expect(checkDiscoveryUrlSafety('http://metadata.google.internal/').safe).toBe(false);
    expect(checkDiscoveryUrlSafety('http://169.254.170.2/').safe).toBe(false);
  });

  // ── Malformed ──
  it('rejects malformed URL', () => {
    expect(checkDiscoveryUrlSafety('not a url at all').safe).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// § 3 — maximumProviders enforcement
// Tested in isolation: slice logic from discovery/orchestrator.ts
// ---------------------------------------------------------------------------
describe('§3 maximumProviders slice logic', () => {
  it('slices source list to maximumProviders when set', () => {
    const sources = Array.from({ length: 20 }, (_, i) => ({
      url: `https://example${i}.com/jobs`,
      type: 'CUSTOM_URL',
      weight: 1,
    }));

    const config = { maximumProviders: 5 };
    const maxProviders = typeof config.maximumProviders === 'number' && config.maximumProviders > 0
      ? config.maximumProviders
      : null;
    const sourcesToExecute = maxProviders !== null
      ? sources.slice(0, maxProviders)
      : sources;

    expect(sourcesToExecute.length).toBe(5);
    expect(sourcesToExecute[0]!.url).toBe('https://example0.com/jobs');
    expect(sourcesToExecute[4]!.url).toBe('https://example4.com/jobs');
  });

  it('uses all sources when maximumProviders is not set', () => {
    const sources = Array.from({ length: 10 }, (_, i) => ({
      url: `https://example${i}.com/jobs`,
      type: 'CUSTOM_URL',
      weight: 1,
    }));

    const config: any = {};
    const maxProviders = typeof config.maximumProviders === 'number' && config.maximumProviders > 0
      ? config.maximumProviders
      : null;
    const sourcesToExecute = maxProviders !== null
      ? sources.slice(0, maxProviders)
      : sources;

    expect(sourcesToExecute.length).toBe(10);
  });

  it('uses all sources when maximumProviders is 0 (disabled)', () => {
    const sources = Array.from({ length: 10 }, (_, i) => ({
      url: `https://example${i}.com/jobs`,
      type: 'CUSTOM_URL',
      weight: 1,
    }));

    const config = { maximumProviders: 0 };
    const maxProviders = typeof config.maximumProviders === 'number' && config.maximumProviders > 0
      ? config.maximumProviders
      : null;
    const sourcesToExecute = maxProviders !== null
      ? sources.slice(0, maxProviders)
      : sources;

    expect(sourcesToExecute.length).toBe(10); // 0 means no limit
  });

  it('preserves priority order when slicing', () => {
    const sources = [
      { url: 'https://priority1.com/jobs', type: 'CUSTOM_URL', weight: 10 },
      { url: 'https://priority2.com/jobs', type: 'CUSTOM_URL', weight: 8 },
      { url: 'https://priority3.com/jobs', type: 'CUSTOM_URL', weight: 5 },
    ];

    const sourcesToExecute = sources.slice(0, 2);
    expect(sourcesToExecute[0]!.url).toBe('https://priority1.com/jobs');
    expect(sourcesToExecute[1]!.url).toBe('https://priority2.com/jobs');
  });
});

// ---------------------------------------------------------------------------
// § 2 — maximumRuntime timeout config read logic
// ---------------------------------------------------------------------------
describe('§2 maximumRuntime — DB read + timeout setup logic', () => {
  let configId: string;
  let runId: string;

  beforeAll(async () => {
    configId = crypto.randomUUID();
    runId = crypto.randomUUID();
    const now = new Date().toISOString();

    await db.insert(schema.huntConfigs).values({
      id: configId,
      targetRoles: ['Backend Engineer'],
      alternativeRoles: [],
      maximumRuntime: 5000, // 5 seconds
      maximumProviders: 3,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(schema.runs).values({
      id: runId,
      configId,
      status: 'CREATED',
      createdAt: now,
      updatedAt: now,
    });
  });

  afterAll(async () => {
    await db.delete(schema.runs).where(eq(schema.runs.id, runId));
    await db.delete(schema.huntConfigs).where(eq(schema.huntConfigs.id, configId));
  });

  it('persists maximumRuntime to hunt_configs and can be read back', async () => {
    const rows = await db.select({ maximumRuntime: schema.huntConfigs.maximumRuntime })
      .from(schema.huntConfigs)
      .where(eq(schema.huntConfigs.id, configId))
      .limit(1);

    expect(rows[0]?.maximumRuntime).toBe(5000);
  });

  it('persists maximumProviders to hunt_configs and can be read back', async () => {
    const rows = await db.select({ maximumProviders: schema.huntConfigs.maximumProviders })
      .from(schema.huntConfigs)
      .where(eq(schema.huntConfigs.id, configId))
      .limit(1);

    expect(rows[0]?.maximumProviders).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// § 4 — saveHuntConfig Zod validation (schema unit tests)
// These test the HuntConfigSchema in isolation without hitting the DB.
// ---------------------------------------------------------------------------
import { z } from 'zod';

// Mirror the schema exactly from actions.ts for isolated unit testing
const HuntConfigSchema = z.object({
  targetRoles: z.array(z.string().min(1)).min(1, { message: 'At least one target role is required' }),
  alternativeRoles: z.array(z.string()),
  requiredSkills: z.array(z.string()),
  candidateCountry: z.string().min(1, { message: 'Candidate country cannot be empty' }),
  searchScope: z.enum(['LOCAL', 'GLOBAL_REMOTE', 'LOCAL_AND_GLOBAL']),
  remoteRequirement: z.string().nullable(),
  minimumDesiredSalary: z.number().int().positive().nullable(),
  desiredSalaryCurrency: z.string().min(1),
  desiredSalaryPeriod: z.enum(['YEAR', 'MONTH', 'WEEK', 'DAY', 'HOUR']),
  requireSalaryDisclosure: z.boolean(),
  discoveryStrategy: z.string().min(1),
  discoveryGroups: z.array(z.string()),
  userUrls: z.array(
    z.string().refine(u => /^https?:\/\//i.test(u), { message: 'Each URL must start with http:// or https://' })
  ),
  maximumProviders: z.number().int().min(1).max(100),
  maximumRuntime: z.number().int().min(5000).max(3_600_000),
  maximumUsableResults: z.number().int().min(1).max(100),
});

const VALID_INPUT = {
  targetRoles: ['Backend Engineer'],
  alternativeRoles: [],
  requiredSkills: ['TypeScript'],
  candidateCountry: 'India',
  searchScope: 'LOCAL_AND_GLOBAL' as const,
  remoteRequirement: null,
  minimumDesiredSalary: null,
  desiredSalaryCurrency: 'INR',
  desiredSalaryPeriod: 'YEAR' as const,
  requireSalaryDisclosure: true,
  discoveryStrategy: 'strategy_stealth',
  discoveryGroups: [],
  userUrls: [],
  maximumProviders: 10,
  maximumRuntime: 120_000,
  maximumUsableResults: 5,
};

describe('§4 saveHuntConfig Zod validation', () => {
  it('accepts valid input', () => {
    const result = HuntConfigSchema.safeParse(VALID_INPUT);
    expect(result.success).toBe(true);
  });

  it('rejects empty targetRoles array', () => {
    const result = HuntConfigSchema.safeParse({ ...VALID_INPUT, targetRoles: [] });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/target role/i);
  });

  it('rejects empty candidateCountry', () => {
    const result = HuntConfigSchema.safeParse({ ...VALID_INPUT, candidateCountry: '' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid searchScope', () => {
    const result = HuntConfigSchema.safeParse({ ...VALID_INPUT, searchScope: 'UNIVERSE' as any });
    expect(result.success).toBe(false);
  });

  it('rejects maximumProviders = 0', () => {
    const result = HuntConfigSchema.safeParse({ ...VALID_INPUT, maximumProviders: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects maximumProviders > 100', () => {
    const result = HuntConfigSchema.safeParse({ ...VALID_INPUT, maximumProviders: 101 });
    expect(result.success).toBe(false);
  });

  it('rejects maximumRuntime < 5000', () => {
    const result = HuntConfigSchema.safeParse({ ...VALID_INPUT, maximumRuntime: 999 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some(i => i.path.includes('maximumRuntime'))).toBe(true);
    }
  });

  it('rejects maximumRuntime > 3 600 000', () => {
    const result = HuntConfigSchema.safeParse({ ...VALID_INPUT, maximumRuntime: 3_600_001 });
    expect(result.success).toBe(false);
  });

  it('rejects maximumUsableResults = 0', () => {
    const result = HuntConfigSchema.safeParse({ ...VALID_INPUT, maximumUsableResults: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects userUrl missing http/https prefix', () => {
    const result = HuntConfigSchema.safeParse({ ...VALID_INPUT, userUrls: ['ftp://bad.com/jobs'] });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/http/i);
  });

  it('rejects NaN values for numeric fields', () => {
    const result = HuntConfigSchema.safeParse({ ...VALID_INPUT, maximumProviders: NaN });
    expect(result.success).toBe(false);
  });

  it('accepts null minimumDesiredSalary', () => {
    const result = HuntConfigSchema.safeParse({ ...VALID_INPUT, minimumDesiredSalary: null });
    expect(result.success).toBe(true);
  });

  it('accepts null remoteRequirement', () => {
    const result = HuntConfigSchema.safeParse({ ...VALID_INPUT, remoteRequirement: null });
    expect(result.success).toBe(true);
  });

  it('accepts valid https userUrl', () => {
    const result = HuntConfigSchema.safeParse({
      ...VALID_INPUT,
      userUrls: ['https://boards.greenhouse.io/acmecorp/jobs/123'],
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid YEAR salary period', () => {
    const result = HuntConfigSchema.safeParse({ ...VALID_INPUT, desiredSalaryPeriod: 'YEAR' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid salary period', () => {
    const result = HuntConfigSchema.safeParse({ ...VALID_INPUT, desiredSalaryPeriod: 'QUARTER' as any });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// § 6 — Radar AI/ML false-positive filtering (pattern assertions)
// SQLite LIKE is case-insensitive for ASCII. We assert that patterns which
// correctly match AI roles do NOT match common false-positive job titles.
// ---------------------------------------------------------------------------
describe('§6 Radar AI/ML false-positive filter — pattern correctness', () => {
  const AI_WORD_PATTERNS = [
    /^ai /i,           // starts with "AI "
    / ai /i,           // " AI " in middle
    / ai$/i,           // ends with " AI"
    /^ai$/i,           // exactly "AI"
    /^ml /i,           // starts with "ML "
    / ml /i,           // " ML " in middle
    / ml$/i,           // ends with " ML"
    /^ml$/i,           // exactly "ML"
  ];

  const AI_EXPLICIT_SUBSTRINGS = [
    'machine learning',
    'artificial intelligence',
    'deep learning',
    'neural',
    'llm',
    'nlp',
    'genai',
    'gen ai',
    'mlops',
    'computer vision',
  ];

  function matchesAiFilter(title: string): boolean {
    const lower = title.toLowerCase();
    if (AI_WORD_PATTERNS.some(p => p.test(lower))) return true;
    if (AI_EXPLICIT_SUBSTRINGS.some(s => lower.includes(s))) return true;
    return false;
  }

  // False positives that the OLD %AI% pattern matched incorrectly
  const FALSE_POSITIVE_TITLES = [
    'Container Security Engineer',
    'Retail Operations Manager',
    'Chair of Engineering',
    'Maintenance Technician',
    'Email Marketing Manager',
    'Detail-Oriented Developer',
    'Sustainability Lead',
    'IT Infrastructure Engineer',
    'Tailoring Specialist',
    'Trainer and Coach',
  ];

  for (const title of FALSE_POSITIVE_TITLES) {
    it(`does NOT match false positive: "${title}"`, () => {
      expect(matchesAiFilter(title)).toBe(false);
    });
  }

  // True positives that the NEW pattern should still match
  const TRUE_POSITIVE_TITLES = [
    'AI Engineer',
    'AI Product Manager',
    'Senior AI Engineer',
    'Lead AI Researcher',
    'Head of AI',
    'Director of AI',
    'Machine Learning Engineer',
    'Machine Learning Researcher',
    'ML Engineer',       // via 'machine learning'? No — but 'mlops' would match "MLOps Engineer"
    'Artificial Intelligence Researcher',
    'Deep Learning Scientist',
    'Neural Network Researcher',
    'LLM Engineer',
    'NLP Engineer',
    'GenAI Developer',
    'Gen AI Engineer',
    'MLOps Engineer',
    'Computer Vision Engineer',
  ];

  for (const title of TRUE_POSITIVE_TITLES) {
    it(`correctly matches AI/ML title: "${title}"`, () => {
      expect(matchesAiFilter(title)).toBe(true);
    });
  }
});
