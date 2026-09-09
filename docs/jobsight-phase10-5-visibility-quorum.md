# Phase 10.5: Structural Visibility Quorum Implementation

## 1. Objective
Implement the smallest production-safe visibility evidence quorum (Adzuna absence + SearchEngine exact-URL index absence = LOW visibility) proposed in Phase 10.4.

## 2. SearchEngineProvider Audit & Blocker
The Phase 10.4 proposal requires a **structural exact-URL index check** from the SearchEngineProvider to deterministically confirm a job is unindexed.

Upon inspecting `src/lib/discovery/providers/SearchEngineProvider.ts`:
- The provider explicitly simulates search via an LLM using `runAgyUnstructured()`.
- It does not connect to an actual deterministic search API (e.g., SerpAPI, Google Custom Search API).
- It relies entirely on fuzzy semantic extraction, relying on the LLM to parse and return JSON strings from its own internal/black-box search execution.

**Conclusion**: The current `SearchEngineProvider` cannot legitimately perform an exact URL index check. An LLM-based extraction pipeline cannot safely prove a "complete zero-result" for indexing status because LLMs are non-deterministic and prone to hallucinated absences or formatting failures. 

Attempting to build a strict visibility quorum on top of an LLM's unstructured search simulation violates the non-negotiable safety contract ("Do NOT use fuzzy semantic extraction for absence determination").

## 3. Implementation Status
Implementation is **BLOCKED**.

To proceed, JobSight requires a legitimate, structural search provider API (like SerpAPI or Bing Search API) capable of returning deterministic JSON index results. We cannot fabricate this capability using the current LLM-based provider.

## 4. Remaining Architecture Limits
- **Competition**: UNKNOWN
- **Applicant Volume**: INACCESSIBLE
- **Mission Status**: DISCOVERY_MISSION_NOT_VALIDATED
