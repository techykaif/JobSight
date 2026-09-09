# Phase 10.6: Positive Opportunity Evidence Feasibility Audit

## 1. Executive Summary
JobSight currently lacks any legitimate, mathematically reachable path to establish a positive `FAVORABLE` opportunity state. Without fabricating proxies or relying on unsupported/blocked APIs, all core dimensions required to prove a job is an unusually attractive "hidden gem" (Competition, Compensation, Visibility) evaluate to `UNKNOWN` or bounded absence. The system effectively functions as an ATS indexer and fit-filter, but cannot fulfill its discovery mission of proving market scarcity.

## 2. Current Evidence Inventory
- **Compensation**: UNKNOWN
- **Freshness**: AVAILABLE
- **Authenticity**: AVAILABLE
- **Hiring Friction**: LIMITED (Heuristic)
- **Remote/Geo**: AVAILABLE (via Fit pipeline)

## 3. Compensation Evidence
- **Status**: UNKNOWN
- **Finding**: JobSight currently lacks any external market baseline dataset (e.g., Lightcast, official salary bands). 
- **Implementation**: `src/lib/opportunity-quality/engine.ts` hardcodes compensation to `UNKNOWN` in production, correctly avoiding the fallacy of using candidate salary expectations or employer claims as market-wide baselines.

## 4. Freshness Evidence
- **Status**: AVAILABLE
- **Finding**: Extracted deterministically from structured ATS `postingDate` metadata. 
- **Semantics**: Establishes `NEW`, `AGING`, and `STALE`. `STALE` acts as a hard negative. `NEW` is correctly treated as an urgency signal, NOT intrinsic proof of low competition or favorable opportunity.

## 5. Authenticity Evidence
- **Status**: AVAILABLE
- **Finding**: Deterministically evaluated via source URL provenance (e.g., direct ATS domains like `greenhouse.io` = `HIGH`, mainstream aggregators = `MEDIUM`, others = `LOW`).
- **Semantics**: Acts correctly as a safety guardrail (downgrades `FAVORABLE` to `NEUTRAL` if authenticity is `LOW`). It does not singlehandedly promote a job to `FAVORABLE`.

## 6. Hiring-Friction Evidence
- **Status**: LIMITED
- **Finding**: Extracted heuristically by scanning `rawContent` for strings like "upload resume", "cover letter", or "create account".
- **Semantics**: Can establish `LOW`, `MEDIUM`, or `HIGH` friction. While low friction makes an application easier, it does not mathematically establish low competition (in fact, it often increases competition). It does not contribute to `FAVORABLE` status.

## 7. Remote/Geographic Evidence
- **Status**: AVAILABLE
- **Finding**: Parsed and structured via discovery and B6 pipelines.
- **Semantics**: Acts strictly as a Candidate Fit gate. It is correctly excluded from Canonical Opportunity Quality because remote flexibility does not equal market scarcity.

## 8. Discovery Provider Inventory
- **ATS Providers**: Greenhouse, Lever, Ashby, Workday. (Provide direct authentic job feeds).
- **Secondary Evidence**: Adzuna (bounded commercial syndication check), SearchEngineProvider (organic web crawling via unstructured LLM search).
- **Status**: All provide authentic source material, but none currently provide market competition metrics or structural visibility absence checks.

## 9. Canonical OQ Reachability
To achieve `FAVORABLE`, the opportunity must possess a strong intrinsic positive signal without any hard negative vetoes. 
The valid positive triggers in `engine.ts` are:
1. `competition === 'LOW'`
2. `compensation === 'EXCEPTIONAL'`
3. `visibility === 'LOW'`

## 10. FAVORABLE Truth Table
| Requirement | Production Reachable? | Blocked By |
|---|---|---|
| `competition === 'LOW'` | NO | Hardcoded `UNKNOWN`. Applicant volume APIs are inaccessible. |
| `compensation === 'EXCEPTIONAL'` | NO | Hardcoded `UNKNOWN`. No external market baseline provider exists. |
| `visibility === 'LOW'` | NO | Phase 10.5 structural quorum was blocked due to SearchEngine LLM hallucination risk. |

**Conclusion**: `FAVORABLE` is currently structurally impossible to reach in production. 

## 11. Evidence Gaps
JobSight has perfected the "negative" and "neutral" guardrails: it correctly isolates bounded absence, enforces candidate fit, evaluates friction, and prevents speculative hallucinations from declaring a job "hidden". However, it has completely zeroed out the "positive" discovery pipeline.

## 12. Exact Bottleneck
The system lacks a single legitimate data provider capable of supplying an objective, external market baseline for either **Visibility**, **Competition**, or **Compensation**.

## 13. Mission Verdict
**POSITIVE_EVIDENCE_NOT_CURRENTLY_AVAILABLE**

## 14. Recommended Next Step
JobSight must either:
1. Integrate a dedicated Compensation Market Baseline provider (e.g., Lightcast, official BLS APIs) to establish `EXCEPTIONAL` compensation.
2. Integrate a structural Search Engine API (e.g., SerpAPI, Google Custom Search API) to unlock the `LOW` visibility quorum designed in Phase 10.4.
Without one of these two external data integrations, the mission is permanently halted.

## 15. Production Changes
NONE. (Read-only audit).

## 16. Residual Risks
Without a positive signal path, JobSight functions entirely as a high-fidelity ATS parser and Candidate Fit filter, losing its primary differentiating value proposition ("Discovering hidden opportunities").
