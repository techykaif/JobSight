# JobSight V1.0.1-A Corrective Release Report

## 1. Schema Evolution
- **Hunt Configurations**: Added `searchScope` (LOCAL, GLOBAL_REMOTE, LOCAL_AND_GLOBAL), `candidateCountry` (e.g., "India"), `requireSalaryDisclosure` (boolean flag), `minimumDesiredSalary`, `desiredSalaryCurrency`, `desiredSalaryPeriod`, and `maximumUsableResults` (integer) to support targeted discovery bounds and salary attractiveness models.
- **Jobs**: Upgraded to capture `salaryMinOriginal`, `salaryMaxOriginal`, `salaryCurrencyOriginal`, `salaryPeriodOriginal`, and `salaryTextOriginal` alongside deterministic normalized fields. Added `candidateRemoteEligibility` (ELIGIBLE, NOT_ELIGIBLE, UNKNOWN) to distinguish geography filters from remote type filters.

## 2. Ingestion & Search Scope
- `ingestion.ts` now routes dynamic prompt execution based on `searchScope`. For `LOCAL`, the system explicitly requests local/regional remote roles available to candidates in `candidateCountry`. For `GLOBAL_REMOTE`, it strictly targets "Worldwide remote" or broad country eligibility. If `LOCAL_AND_GLOBAL` is selected, it executes both unstructured fetch routines in parallel and concatenates the resulting markdown for unified extraction.

## 3. Salary Intelligence
- Introduced a lightweight `CurrencyConverter` abstraction in `src/lib/currency/converter.ts` with a `FixedTestCurrencyProvider` yielding deterministic rate testing (e.g., USD -> INR = 83.5).
- Created `evaluateSalaryAttractiveness` in `src/lib/salary/index.ts` to cleanly normalize diverse periods (hourly, monthly, yearly) and rank opportunities strictly based on ratio against `minimumDesiredSalary` (EXCEPTIONAL, HIGH, GOOD, BELOW_TARGET), removing salary minimums as a raw discovery bottleneck.
- Added `requireSalaryDisclosure` as an early cheap filter executed prior to expensive AGY analysis, ensuring jobs without salary data are efficiently filtered when configured.

## 4. Bounded Over-Discovery
- Implemented `maximumUsableResults` constraints. `ingestion.ts` sets an AGY extraction bound proportional to `maxUsable * 3`.
- During the `QUALIFICATION` phase within `orchestrator.ts`, the pipeline tracks usable decisions (`APPLY`, `CONSIDER`, `RESEARCH_REQUIRED`) and explicitly halts and skips further qualification once `usableCount >= maxUsable`, emitting a `MAX_USABLE_RESULTS_REACHED` event. This achieves bounded over-discovery without infinite loops or overly-restrictive 1:1 extraction.

## 5. UI Updates
- **New Hunt (`src/app/hunts/new/page.tsx`)**: Replaced raw salary minimum inputs with rich `SearchScope`, `CandidateCountry`, `Require Salary Disclosure`, `Minimum Desired Salary` (with configurable currency/period limits), and `maximumUsableResults` form controls.
- **Jobs Explorer (`src/app/jobs/page.tsx`)**: Displays cleanly normalized UI salary outputs, safely reverting to `salaryTextOriginal` if deterministic minimum bounds could not be formally extracted.
- **Job Detail (`src/app/jobs/[id]/page.tsx`)**: Explicitly enumerates `candidateRemoteEligibility` and `Original Salary` alongside deterministic outputs.

## 6. Real Run Verification

**Run ID:** `c340de32-a56e-4599-9a13-6b84ea58245c`

**Config:** `LOCAL_AND_GLOBAL` scope, candidate country `India`, `requireSalaryDisclosure: true`, `minimumDesiredSalary: 50000 INR/MONTH`, `maximumUsableResults: 3`.

**Outcome:** Unstructured retrieval (Stage A) completed successfully. Structured extraction (Stage B) failed with `[AGY_TIMEOUT] AGY execution timed out after 90000ms`.

**Pipeline Behavior (Graceful Degradation):**
- ✅ Preflight completed normally
- ✅ Discovery started with correctly scoped LOCAL_AND_GLOBAL prompt including candidate country
- ❌ Structuring phase failed: `[AGY_TIMEOUT]` timeout after 90s
- ✅ Emitted `DISCOVERY_BATCH_COMPLETED` with `Found 1, valid 0` (aborted correctly on timeout)
- ✅ Qualification phase started and correctly had nothing to qualify
- ✅ Company research correctly skipped (`NO_ELIGIBLE_JOBS`)
- ✅ Run completed with `COMPLETED_WITH_FAILURES`
- ✅ No crashes, no false rejections

**Verdict:** Pipeline gracefully handles AGY timeouts during structuring, but the run could not yield usable jobs due to the timeout.

## 7. Test Verification

| Suite | Tests | Status |
|---|---|---|
| bounded-discovery | 3 | ✅ |
| hard-filters | 9 | ✅ |
| currency-converter | 9 | ✅ |
| salary-normalization | 14 | ✅ |
| experience-gating | 5 | ✅ |
| m8-orchestrator | 3 | ✅ |
| m9-bugfixes | 5 | ✅ |
| pipeline | 7 | ✅ |
| company-scoring | 4 | ✅ |
| company-hallucination | 1 | ✅ |
| db / db-history / db-nulls | 3 | ✅ |
| m7-ui | 4 | ✅ |
| pipeline-db | 1 | ✅ |
| runner-failure | 1 | ✅ |
| runner-permissions | 2 | ✅ |
| schema-drift | 1 | ✅ |
| validation | 2 | ✅ |
| **Total** | **74** | **All pass** |

## 8. Final Acceptance Verdict

**PARTIAL / FAIL**

**Passed Criteria:**
- ✅ Tests pass (74/74 tests)
- ✅ Typecheck passes
- ✅ Build passes
- ✅ All deterministic tests verify salary extraction, INR conversion, remote eligibility, bounds over-discovery, and regression fixes.

**Failed / Pending Criteria:**
- ❌ Real integrated hunt timed out during AGY Stage B structuring (`[AGY_TIMEOUT] AGY execution timed out after 90000ms`).
- ❌ Could not verify database output, LIVE salary normalization, LIVE remote eligibility, or manual source verification because 0 jobs were extracted due to the AGY timeout.

A successful real integrated hunt with fully extracted and validated candidate URLs is required to unblock V1.0.1-A.
