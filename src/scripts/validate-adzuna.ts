import fs from 'fs';

const envLocal = fs.readFileSync('.env.local', 'utf8');
const idMatch = envLocal.match(/ADZUNA_APP_ID=(.+)/);
const keyMatch = envLocal.match(/ADZUNA_APP_KEY=(.+)/);
if (idMatch && keyMatch) {
  process.env.ADZUNA_APP_ID = idMatch[1]!.trim();
  process.env.ADZUNA_APP_KEY = keyMatch[1]!.trim();
}

import { checkAdzunaEvidence } from '../lib/pipeline/adzuna-adapter';

async function run() {
  console.log("== REAL WORLD VALIDATION ==");
  
  // 1. Likely present
  const job1 = { title: "Software Engineer", companyName: "Microsoft", location: "Redmond", id: "1", sourceUrl: "" };
  console.log(`Checking Job 1: ${job1.title} at ${job1.companyName}`);
  const res1 = await checkAdzunaEvidence(job1 as any);
  console.log(`Result 1: ${res1.status} [Match: ${res1.matchStrength}]`);
  
  // 2. Unlikely present
  const job2 = { title: "Senior Stealth Engineer", companyName: "FakeStealthCo123", location: "Remote", id: "2", sourceUrl: "" };
  console.log(`Checking Job 2: ${job2.title} at ${job2.companyName}`);
  const res2 = await checkAdzunaEvidence(job2 as any);
  console.log(`Result 2: ${res2.status} [Match: ${res2.matchStrength}]`);

  // 3. Ambiguous (Generic title, common company fragment)
  const job3 = { title: "Manager", companyName: "Tech", location: "US", id: "3", sourceUrl: "" };
  console.log(`Checking Job 3: ${job3.title} at ${job3.companyName}`);
  const res3 = await checkAdzunaEvidence(job3 as any);
  console.log(`Result 3: ${res3.status} [Match: ${res3.matchStrength}]`);
}

run().catch(console.error);
