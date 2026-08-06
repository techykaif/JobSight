import { runAgyTask } from '../agy/runner.js';
import { CompanyResearchSchema, EXTERNAL_AGY_COMPANY_CONTRACT, type CompanyResearch } from './schema.js';
import { calculateCompanyScores, calculateOpportunityV2, calculateApplicationPriority } from './scoring.js';
import { db } from '../db/client.js';
import * as dbSchema from '../db/schema.js';
import crypto from 'crypto';
import { eq, and, gt } from 'drizzle-orm';

export interface CompanyIntelligenceResult {
  research: CompanyResearch | null;
  scores: {
    companyScore: number;
    hiringMomentum: number;
    confidence: number;
    opportunityV2: number;
    applicationPriority: number;
  };
  decision: string; // The updated or preserved decision
}

export async function getCompanyIntelligence(
  job: any,
  companyName: string,
  opportunityV1: number,
  m5Decision: string,
  forceRefresh: boolean = false,
  abortSignal?: AbortSignal
): Promise<CompanyIntelligenceResult> {
  let research: CompanyResearch | null = null;
  
  // 1. Check cache (if not forceRefresh)
  // Cache expiration: 7 days
  const CACHE_DAYS = 7;
  const cacheDate = new Date();
  cacheDate.setDate(cacheDate.getDate() - CACHE_DAYS);

  if (!forceRefresh) {
    try {
      const companyRec = await db.select().from(dbSchema.companies).where(eq(dbSchema.companies.displayName, companyName)).limit(1);
      const companyId = companyRec[0]?.id;
      if (companyId) {
        // Find recent research artifact
        const artifacts = await db.select()
          .from(dbSchema.researchArtifacts)
          .where(and(
            eq(dbSchema.researchArtifacts.entityType, 'COMPANY'),
            eq(dbSchema.researchArtifacts.entityId, companyId),
            eq(dbSchema.researchArtifacts.workerType, 'STRUCTURE_COMPANY_RESEARCH'),
            gt(dbSchema.researchArtifacts.createdAt, cacheDate.toISOString())
          ))
          .limit(1);
        
        const metadata = artifacts[0]?.metadata;
        if (metadata) {
          try {
            const parsed = typeof metadata === 'string' 
                ? JSON.parse(metadata) 
                : metadata;
            if (parsed && typeof parsed === 'object' && 'structuredData' in parsed) {
              research = (parsed as any).structuredData as CompanyResearch;
            }
          } catch(e) {}
        }
      }
    } catch (e) {
      console.warn('[COMPANY_CACHE_ERR] Could not fetch cached research', e);
    }
  }

  // 2. Perform AGY Research if no cache
  if (!research) {
    console.log(`[COMPANY_RESEARCH] Running AGY research for ${companyName}`);
    try {
      // We simulate a two-stage process conceptually here by providing a unified prompt, 
      // but under the hood we require AGY to fetch evidence and output ONLY the structure.
      // In a real multi-agent flow, we'd have a Researcher subagent then a Structurer subagent.
      const prompt = `
Research the company: "${companyName}".
Find their official website, careers page, funding (if any), current openings (especially engineering), and remote posture.
Look for recent layoffs or expansion signals in the last 12 months.
Output STRICTLY the structured JSON adhering to the provided schema.

Mandatory Constraints:
- Differentiate FACT (e.g. "Careers page lists 10 roles") vs SIGNAL (e.g. "Multiple roles posted in last 30 days") vs INFERENCE.
- Include source URLs for all claims.
- Do NOT hallucinate numeric hiring rates.
- If information is missing, leave it out or mark unknown. DO NOT invent funding or employee counts.
      `;

      research = await runAgyTask({
        prompt,
        schema: CompanyResearchSchema,
        jsonSchemaDef: EXTERNAL_AGY_COMPANY_CONTRACT,
        timeoutMs: 90000,
        maxAttempts: 2,
        ...(abortSignal ? { abortSignal } : {})
      });

      // Persist raw research conceptually alongside the structured output
      if (research) {
         try {
           const dbCompany = await db.select().from(dbSchema.companies).where(eq(dbSchema.companies.displayName, companyName)).limit(1);
           let companyId = dbCompany[0]?.id;
           
           if (!companyId) {
             companyId = crypto.randomUUID();
             await db.insert(dbSchema.companies).values({
               id: companyId,
               normalizedName: companyName.toLowerCase().replace(/[^a-z0-9]/g, ''),
               displayName: companyName,
               website: research.company.officialWebsite || null,
               careersUrl: research.company.careersUrl || null,
               createdAt: new Date().toISOString(),
               updatedAt: new Date().toISOString()
             }).onConflictDoNothing();
           }

           await db.insert(dbSchema.researchArtifacts).values({
             id: crypto.randomUUID(),
             runId: 'standalone-research',
             entityType: 'COMPANY',
             entityId: companyId,
             workerType: 'STRUCTURE_COMPANY_RESEARCH',
             rawContent: JSON.stringify(research), // Persisting the raw result JSON before extracting
             metadata: JSON.stringify({ structuredData: research }),
             createdAt: new Date().toISOString()
           });
         } catch(e) {
           console.error('[DB_ERR] Failed to save company research artifact', e);
         }
      }
    } catch (e) {
      console.error(`[COMPANY_RESEARCH_FAILED] Failed to research company: ${companyName}`, e);
    }
  }

  // 3. Compute Scores
  const companyScores = calculateCompanyScores(research);
  const oppV2 = calculateOpportunityV2(opportunityV1, companyScores.companyScore, companyScores.hiringMomentum);
  const appPriority = calculateApplicationPriority(oppV2, companyScores.hiringMomentum, companyScores.confidence);

  // 4. Update Decision
  let newDecision = m5Decision;
  
  if (m5Decision !== 'SKIP') {
    // We only upgrade/downgrade non-SKIP jobs based on V2
    if (oppV2 >= 80) newDecision = 'APPLY';
    else if (oppV2 >= 50) {
      if (companyScores.confidence < 0.6) newDecision = 'RESEARCH_REQUIRED';
      else newDecision = 'CONSIDER';
    } else {
      newDecision = 'SKIP';
    }
  }

  return {
    research,
    scores: {
      ...companyScores,
      opportunityV2: oppV2,
      applicationPriority: appPriority
    },
    decision: newDecision || m5Decision
  };
}
