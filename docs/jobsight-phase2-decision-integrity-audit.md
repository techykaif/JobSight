# JobSight Phase 2 Decision Integrity & Evidence Precedence Audit

## 1. Executive Summary
This read-only audit investigated the decision integrity and evidence precedence model of JobSight's pipeline. The investigation confirmed that the system currently operates on an unsafe **Signal Aggregation** model rather than strict **Decision Arbitration**. Because missing data (UNKNOWN/NULL) is treated optimistically across multiple stages (Candidate Fit, Qualification), an empty or incomplete job artifact (e.g., an ATS shell page) can easily bypass penalties, accrue a perfect score by default, and result in a final `APPLY` decision. Furthermore, a severe architectural flaw in the Orchestrator causes legitimate `SKIP` decisions from Qualification to be completely lost and accidentally downgraded to `REVIEW`.

## 2. Current Decision Architecture
The pipeline executes sequentially in `src/lib/pipeline/orchestrator.ts`:
1. **Evidence Gate:** Checks if an artifact exists or HTTP 200 was received.
2. **HTML Enrichment:** Extracts structured data (leaves fields `null` if missing).
3. **Candidate Fit:** Evaluates profile against Job metadata.
4. **Qualification:** LLM-based AGY analysis + Hard Filters, produces `APPLY`/`CONSIDER`/`SKIP`.
5. **Geographic (B6):** Evaluates location eligibility.
6. **Market/Opportunity Intel:** Assesses competition, friction, visibility.
7. **Ranking (B7 / App Intel):** Runs `DecisionEngine` strategies (`APPLY_NOW`, `IGNORE`, etc.), but **only for jobs that scored `APPLY`/`CONSIDER` in Qualification.**
8. **Candidate Decision:** The final arbiter (`evaluateCandidateDecision`) evaluates B6, Fit, B7, and Qualification.

## 3. Candidate Decision Rule Precedence
Inside `src/lib/candidate-decision/engine.ts`, rules are executed strictly in this order:
1. **Geographic Veto (Rule A):** `NOT_ELIGIBLE` → `INELIGIBLE` (Overrides all).
2. **Profile Fallback (Rule B):** Missing profile → `INSUFFICIENT_EVIDENCE`.
3. **Phase 1 Exp Veto (Rule B2):** `SKIP` + `EXTREME_EXPERIENCE_GAP` → `INELIGIBLE`.
4. **Market Veto (Rule C):** `b7 == IGNORE` → `SKIP`.
5. **Fit Veto (Rule D):** `Fit == weak` → `SKIP`.
6. **Geographic Uncertainty (Rule E):** `NEEDS_VERIFICATION` → `REVIEW`.
7. **Fit Uncertainty (Rule F):** `Fit == insufficient_evidence` → `REVIEW`.
8. **Partial Fit (Rule G):** `Fit == partial` → `REVIEW`.
9. **Market Caution (Rule H):** `b7 == MONITOR/WAIT/RESEARCH_MORE` → `REVIEW`.
10. **Apply Alignment (Rule I):** `Geo == ELIGIBLE` && `Fit == strong|good` && `b7 == APPLY_NOW|APPLY_THIS_WEEK` → `APPLY`.
11. **Fallback:** `undefined` / unhandled → `REVIEW`.

## 4. Exact APPLY Requirements
To achieve `APPLY`, the current system requires:
- **Candidate Fit:** Must be `strong` or `good`. (Can be `strong` even if critical evidence is missing, relying only on Title match).
- **B6 Geographic:** Must be `ELIGIBLE`. (Often defaults to `ELIGIBLE` if no explicit restrictions are found).
- **B7 App Intel:** Must be `APPLY_NOW` or `APPLY_THIS_WEEK`. (Will output this if Qualification score >= 60).
- **Qualification:** Must be `APPLY` or `CONSIDER`. (Defaults to 100 score if requirements are missing).
- **Evidence Gate:** Just requires HTTP 200 or `rawContent.length > 0`.
- **Can critical data be UNKNOWN?** **YES**. If Experience, Skills, and Salary are entirely missing, no stage penalizes the job. The job achieves default high scores and proceeds to `APPLY`.

## 5. Evidence Gate Findings
The Evidence Gate (`orchestrator.ts` ~L231) checks `hasArtifact || hasSuccessfulFetch`.
- It relies entirely on `rawContent.trim().length > 0` or HTTP 2xx.
- Empty HTML body, blocked ATS shell pages, CAPTCHA pages, or generic boilerplate **will successfully pass this gate.**
- The gate checks "artifact exists", not "artifact contains usable evidence."

## 6. HTML Enrichment Findings
- Missing fields result in `null` or empty arrays.
- There is no track of extraction confidence or completeness.
- An extraction that returns completely empty data is merged cleanly into the job model, effectively stripping the job of any strict requirements.

## 7. Qualification Findings
- **Default Optimism:** Scoring starts at 100. Penalties are only applied when explicit mismatches exist.
- **Unknown = No Penalty:** If experience is unknown (`jobMinYears` is null), `diff` is 0, so no penalty is applied. If skills are unknown, 0 penalty.
- Result: A completely blank job description will result in a perfect 100 Opportunity Score (`APPLY` decision) as long as Hard Filters don't catch it.
- **Unknown means "not a problem"**, not "needs verification."

## 8. Candidate Fit Findings
- Calculates average across 3 dimensions: Experience, Skills, Role.
- If Experience and Skills are missing, they are excluded from the denominator (`activeDimensions`).
- **Critical Flaw:** If a job has no description but the title matches the candidate's target role, `Role=100`, `activeDimensions=1`, average `Score=100`. 
- **`STRONG` effectively means "strong based on available information,"** not "strongly compatible with verified complete evidence."

## 9. Market Intelligence Findings
- `OpportunityIntelligenceEvaluator` correctly flags unknown competition as `INSUFFICIENT_EVIDENCE`.
- **However**, B7 Strategies (`src/lib/decision/strategies.ts`) ignore this flag and map `Qualification`'s high Opportunity Score directly to `APPLY_THIS_WEEK`.
- Therefore, Market Intelligence's `INSUFFICIENT_EVIDENCE` warning is entirely swallowed by the B7 logic and does not prevent `APPLY`.

## 10. UNKNOWN / NULL / MISSING State Matrix
| Signal | NULL / Missing / Empty State Behavior | Safety Impact |
| :--- | :--- | :--- |
| **B6 (Geo)** | Unrestricted/Unknown defaults to `ELIGIBLE` | High Risk |
| **Candidate Fit** | Missing dimensions omitted from average → `STRONG` | Critical Risk |
| **Qualification** | No mismatched skills/exp → Score 100 → `APPLY` | Critical Risk |
| **B7 (Decision Engine)** | Triggers on Qual Score 100 → `APPLY_NOW` | Critical Risk |
| **Evidence Gate** | Empty content with HTTP 200 → PASS | Critical Risk |
| **Market Intel** | Outputs `INSUFFICIENT_EVIDENCE` (ignored by B7) | High Risk |

## 11. Contradictory Signal Analysis
- **Mismatch 1 (SKIP Downgrade):** If `Qualification` issues a `SKIP` (e.g., due to low score), the Orchestrator filters the job out of the B7 Ranking queue (`eligibleDecisions.filter(...)`). B7 never runs. The Final Arbiter sees `b7Decision === undefined` and triggers the fallback: `REVIEW`. **A hard `SKIP` silently becomes `REVIEW`.**
- **Mismatch 2 (Strong Fit with no Evidence):** Candidate Fit issues `STRONG` because the title matches, even if `Qualification` correctly flagged `INSUFFICIENT_EVIDENCE`.
- **Mismatch 3 (Opportunity vs B7):** Market Intelligence outputs `INSUFFICIENT_EVIDENCE`, but B7 strategies output `APPLY_NOW` due to Qualification's default 100 score.

## 12. Actual APPLY Decision Tree
The *actual* path a completely empty job takes to reach `APPLY` today:
1. **Evidence Gate:** HTTP 200 (even if empty body) -> PASS.
2. **HTML Enrichment:** Finds nothing, leaves exp/skills null -> PASS.
3. **Candidate Fit:** Title matches, skips other dimensions -> `STRONG`.
4. **Qualification:** No explicit penalties triggered -> Score 100 -> `APPLY`.
5. **Ranking (B7):** Sees Score 100 -> `APPLY_NOW` / `APPLY_THIS_WEEK`.
6. **Candidate Decision:** `Geo=ELIGIBLE` + `Fit=STRONG` + `B7=APPLY_NOW` -> **FINAL DECISION: APPLY**.

## 13. Real-Hunt Forensics
Using Read-Only access to Run `a6e1b788-0031-4813-9182-68f016364450`:
1. **APPLY with complete evidence:** Not observed in this Hunt (all failed geo/exp).
2. **APPLY with incomplete evidence:** Not observed in this Hunt.
3. **REVIEW despite strong fit:** **YES.** Job `bc783aa3` had Fit=`strong` but Qual=`SKIP`. It ended up as `REVIEW` due to the B7 bypass bug.
4. **SKIP outcomes:** Job `fda1e3ce` properly received `SKIP` only because Fit=`weak` triggered Rule D in the final arbiter before the fallback.
5. **INELIGIBLE despite strong fit:** **YES.** Job `7b0a039a` (Fit=`strong`, Qual=`SKIP`, Final=`INELIGIBLE` due to B6 Geo restriction overriding all).

## 14. Existing Test Coverage
- `pipeline-experience.test.ts` thoroughly tests the Phase 1 `EXTREME_EXPERIENCE_GAP` logic.
- `candidate-fit.test.ts` unit-tests basic dimension scoring.
- `m8-orchestrator.test.ts` tests state machine transitions.
- `candidate-decision.test.ts` (if exists) tests the precedence rules assuming clean inputs.

## 15. Missing Regression Coverage
- Precedence tests ensuring `Qualification == SKIP` results in a final `SKIP`.
- Tests for Candidate Fit handling of missing metadata (currently allows `STRONG`).
- Tests for Empty HTML / blocked ATS pages ensuring they result in `INSUFFICIENT_EVIDENCE` or `REVIEW`, not `APPLY`.
- End-to-end tests validating the interaction between `OpportunityIntelligence` and `B7 strategies`.

## 16. Architectural Gaps
JobSight currently relies on **Signal Aggregation** rather than strict **Decision Arbitration**.
- There is no central Evidence Sufficiency Gate.
- Incomplete intelligence is heavily penalized by Market Intelligence, but those penalties are lost because B7 Strategies rely solely on Qualification scores.
- The Orchestrator's `eligibleDecisions` filter intentionally drops `SKIP` jobs from the final pipeline state, blinding the final Candidate Decision engine to legitimate disqualifications.

## 17. Minimum Safe Fix
**A. Orchestrator Bypass Fix (Preserve SKIP):**
Modify `orchestrator.ts` to allow `SKIP` decisions to be passed to the Candidate Decision engine, OR add a dedicated rule in `evaluateCandidateDecision`:
```typescript
  // RULE C2: General Qualification Veto
  if (qualificationDecision?.decision === 'SKIP' && !qualificationDecision.reasons.some(r => r.includes('EXTREME_EXPERIENCE_GAP'))) {
    return { finalDecision: 'SKIP', primaryReason: 'Job did not pass Qualification checks.' };
  }
```
**B. Candidate Fit Evidence Gate:**
Modify `evaluateCandidateFit` to require sufficient active dimensions. If critical evidence (experience/skills) is entirely missing, return `level = 'insufficient_evidence'` (which safely maps to `REVIEW` via Rule F) instead of calculating an artificial average.

**C. B7 Strategy Safety:**
Update `decision/strategies.ts` to explicitly require `context.opportunity.opportunityScore >= 60` **AND** `context.discovery.result.confidence >= 50` or similar evidence-backing before allowing `APPLY_NOW` / `APPLY_THIS_WEEK`.

## 18. Risks
- **False Negatives:** Strengthening Candidate Fit to require evidence will likely increase the number of `REVIEW` decisions for jobs with poorly formatted descriptions.
- **Volume:** The `REVIEW` queue will grow as previously "optimistic" `APPLY` decisions are rightfully downgraded pending human/LLM verification.
- **Performance/Cost:** No new LLM calls or DB queries are required. The fix is strictly logic-based.
- **Data Lineage:** Phase 1 guarantees (`EXTREME_EXPERIENCE_GAP`) will remain perfectly intact.

## 19. Files That Would Need Modification
- `src/lib/candidate-decision/engine.ts` (Add Rule C2 for `SKIP` preservation).
- `src/lib/candidate-fit/engine.ts` (Cap score/level if activeDimensions < 2).
- `src/lib/decision/strategies.ts` (Add evidence requirements to Apply strategies).

## 20. Proposed Regression Tests
- `candidate-decision.test.ts`: Ensure `Qual=SKIP` + `Fit=STRONG` -> `SKIP`.
- `candidate-fit-evidence.test.ts`: Ensure Job with no skills/exp results in `insufficient_evidence`.
- `empty-job-flow.test.ts`: End-to-end test verifying a blank ATS page results in `REVIEW` or `SKIP`, never `APPLY`.

## 21. GO / NO-GO Recommendation
**GO.** The proposed minimum safe fix is localized, structurally isolated to three pure functions, and introduces no DB schema or infrastructure changes. It effectively closes the massive false-positive vulnerability where unknown/missing data optimizes to an `APPLY` decision.
