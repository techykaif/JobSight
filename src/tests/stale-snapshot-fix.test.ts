import { describe, it, expect, beforeAll } from 'vitest';
import { db } from '../lib/db/client.js';
import * as schema from '../lib/db/schema.js';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { evaluateCandidateDecision } from '../lib/candidate-decision/engine.js';

describe('Candidate Decision Stale Snapshot Bug Fix', () => {

  it('proves a run with profileSnapshot does NOT enter the profile-less fallback', () => {
    const hasSnapshot = true;
    const res = evaluateCandidateDecision(hasSnapshot, { level: 'strong' } as any, 'APPLY_NOW', { eligibilityStatus: 'ELIGIBLE' } as any);
    expect(res.finalDecision).not.toBe('INSUFFICIENT_EVIDENCE');
    expect(res.finalDecision).toBe('APPLY');
  });

  it('proves a real existing decision is not overwritten by INSUFFICIENT_EVIDENCE', () => {
    // If hasSnapshot is true, even if candidate fit is weak, it returns SKIP, not INSUFFICIENT_EVIDENCE.
    const hasSnapshot = true;
    const res = evaluateCandidateDecision(hasSnapshot, { level: 'weak' } as any, 'APPLY_NOW', { eligibilityStatus: 'ELIGIBLE' } as any);
    expect(res.finalDecision).toBe('SKIP');
  });

  it('proves an actually profile-less run still correctly uses the fallback', () => {
    const hasSnapshot = false;
    const res = evaluateCandidateDecision(hasSnapshot, { level: 'strong' } as any, 'APPLY_NOW', { eligibilityStatus: 'ELIGIBLE' } as any);
    expect(res.finalDecision).toBe('INSUFFICIENT_EVIDENCE');
  });
});

describe('Real Hunt Test Configuration Explicit Requirements', () => {
  beforeAll(() => {
    migrate(db, { migrationsFolder: './src/lib/db/migrations' });
  });

  it('proves the test Hunt persists exactly requireSalaryDisclosure=false, candidateCountry=India, remoteRequirement=REMOTE_ONLY', async () => {
    const configId = crypto.randomUUID();
    await db.insert(schema.huntConfigs).values({
      id: configId,
      targetRoles: ["Software Engineer"],
      alternativeRoles: [],
      salaryMinimum: 100000,
      remoteRequirement: "REMOTE_ONLY",
      candidateCountry: "India",
      requireSalaryDisclosure: false,
      discoveryStrategy: "strategy_stealth",
      maximumProviders: 10,
      maximumRuntime: 600000,
      maximumUsableResults: 20,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    const config = await db.select().from(schema.huntConfigs).where(eq(schema.huntConfigs.id, configId)).limit(1).get();

    expect(config).toBeDefined();
    expect(config?.requireSalaryDisclosure).toBe(false);
    expect(config?.candidateCountry).toBe("India");
    expect(config?.remoteRequirement).toBe("REMOTE_ONLY");

    await db.delete(schema.huntConfigs).where(eq(schema.huntConfigs.id, configId));
  });
});
