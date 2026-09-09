# Phase 10.2: Multi-Source Evidence Reality Audit

## 1. Objective
Determine whether the current independent evidence sources (Adzuna + SearchEngine) actually improve JobSight's ability to identify genuinely less-visible opportunities, and analyze provider overlap, independence, and mission effectiveness.

## 2. Repository State
- **Adzuna Adapter**: Active. Deterministic matching (`EXACT`, `STRONG`, `PARTIAL`, `WEAK`, `NONE`). Bounded non-observation.
- **SearchEngineProvider**: Active. Executes web dorks via LLM/AGY runner.
- **Secondary Evidence**: Executes sequentially without short-circuiting. Persists `(jobId, runId, targetSource)` idempotent records to `jobCrossReferences`.
- **Visibility Intelligence**: Translates `OBSERVED_ON_SOURCE` to `HIGH` visibility. Translates `NOT_OBSERVED_ON_CHECKED_SOURCES` strictly without erroneously elevating to `LOW` visibility.

## 3. Experiment Design
- **Sample Size**: 3 distinct job profiles.
- **Selection Method**: Manual injection into execution layer to bypass deep discovery LLM overhead.
  1. High-profile Enterprise: `Software Engineer at Microsoft`
  2. Generic Mid-Market: `Manager at Tech`
  3. Obscure/Stealth: `Senior Stealth Engineer at FakeStealthCo123`
- **Why**: Represents opposite ends of the visibility spectrum and an ambiguous baseline, testing both exact matching and zero-result handling safely without exceeding the 200 req/day Adzuna circuit breaker.

## 4. Provider Observations
| Job | Adzuna Result | SearchEngine Result |
|---|---|---|
| 1. Microsoft SWE | `UNKNOWN` (PARTIAL match, generic fallback) | `OBSERVED_ON_SOURCE` (STRONG) |
| 2. Tech Manager | `UNKNOWN` (WEAK fuzzy match) | `UNKNOWN` (WEAK fuzzy match) |
| 3. FakeStealthCo123 | `NOT_OBSERVED_ON_CHECKED_SOURCES` (NONE) | `NOT_OBSERVED_ON_CHECKED_SOURCES` (NONE) |

## 5. Match-Strength Distribution
- **Adzuna**: Extremely rigid on location and identity. High occurrence of `UNKNOWN` (PARTIAL/WEAK) due to fuzzy/generic text overlap for "Software Engineer".
- **SearchEngine**: Highly capable of unstructured extraction (`STRONG`/`PARTIAL`), but prone to hallucinations if the LLM parses a generic corporate careers page incorrectly.

## 6. Provider Overlap & Practical Independence
**PRACTICAL PROVIDER INDEPENDENCE: HIGH**
Adzuna relies on structured employer syndication and feeds. The SearchEngineProvider relies on public web crawling (Google indexing). A job can easily exist in a raw ATS (Greenhouse) and be indexed by Google (`OBSERVED` via SearchEngine) while being entirely absent from Adzuna (`NOT_OBSERVED`) because the employer chose not to pay for syndication.

## 7. Visibility Semantics
- **Observed by Both**: `OBSERVED_ON_SOURCE` -> `HIGH` visibility.
- **Observed by One**: `OBSERVED_ON_SOURCE` -> `HIGH` visibility.
- **Not Observed by Either**: `NOT_OBSERVED_ON_CHECKED_SOURCES` -> Leaves visibility in a bounded state. **It does NOT establish LOW visibility.** It only proves absence on the checked platforms.
- **UNKNOWN**: Ignored. Does not prove presence or absence.

## 8. Competition & Compensation Evidence Assessment
- **Competition**: Neither Adzuna nor SearchEngine provides legitimate applicant volume or active competition metrics. Result: `UNKNOWN`.
- **Compensation Baseline**: Neither provides a verified market-wide compensation baseline for the exact target profile. Result: `UNKNOWN`.

## 9. Canonical OQ Results & Mission Signals
Because JobSight's Canonical Opportunity Quality engine requires explicit positive signals (`EXCEPTIONAL` comp, `LOW` competition, or verified `LOW` visibility) to grant `FAVORABLE` status:
- All sample jobs resolved to `NEUTRAL` or `INSUFFICIENT_EVIDENCE`.
- **Mission-Relevant Positive Signals**: 0. The current architecture successfully prevents false positives, but completely fails to discover true positives because it lacks the authority to declare `LOW` visibility or `LOW` competition.

## 10. Primary Bottleneck
**Lack of Applicant Volume / Competition Evidence.**
We have successfully bounded visibility (we know when a job is NOT highly syndicated), but without an applicant volume indicator, a job that is `NOT_OBSERVED_ON_CHECKED_SOURCES` might still have 500 applicants directly through its ATS. We cannot safely classify it as `FAVORABLE`.

## 11. Recommendation
**ADD PROVIDER (Applicant/Competition Specialist)**
The current architecture is solid but fundamentally blocked by missing signal. We must investigate an evidence source capable of returning applicant volume or competition metrics (e.g., LinkedIn API, specialized ATS scraping, or a competition aggregator). Without this, JobSight cannot fulfill its primary mission.

## 12. Exact Limitations
- Adzuna 200 req/day limit prevents scalable secondary scanning.
- LLM-based SearchEngineProvider is too slow and expensive for mass secondary verification.
- `NOT_OBSERVED` != `LOW` visibility.

## 13. Mission Status
**DISCOVERY_MISSION_NOT_VALIDATED**
