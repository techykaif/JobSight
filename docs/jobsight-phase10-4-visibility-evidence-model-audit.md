# Phase 10.4: Visibility Evidence Model Audit

## 1. Objective
Determine whether JobSight can legitimately establish a positive `LOW` visibility signal using observable, reproducible evidence without relying on inaccessible competition metrics or erroneously conflating a single bounded absence with systemic low visibility.

## 2. Current Visibility Contract
- `OBSERVED_ON_SOURCE` -> `HIGH` visibility.
- `NOT_OBSERVED_ON_CHECKED_SOURCES` -> Bounds absence to checked sources, but mathematically evaluates to `UNKNOWN` visibility for mission purposes.
- `LOW` visibility -> Currently unattainable due to lack of a defined, authoritative reference baseline.
- `LOW` visibility != `LOW` competition.
- `UNKNOWN` competition strongly vetoes `FAVORABLE` opportunity state unless visibility is verifiably `LOW` or comp is `EXCEPTIONAL`.

## 3. Definition of LOW Visibility
"Low visibility" must be defined against the standard discovery baseline of the modern internet. The baseline is **Indexed & Syndicated**. 
A defensible `LOW` visibility signal is: **"A verifiable, active job requisition that is neither syndicated to a major aggregation network nor indexed by the primary internet search engine."**

## 4. Existing Evidence Sources
1. **SearchEngineProvider**: Represents organic public web indexing.
2. **Adzuna**: Represents commercial/structured job board syndication.

## 5. SearchEngineProvider Analysis
- **Capability**: Can query the global search index for specific ATS URLs or strict Title/Company pairs.
- **Limitation**: LLM extraction is currently used, which is slow and slightly non-deterministic. A direct structural query (e.g., checking if the exact URL is indexed) would be much safer and faster.
- **Zero-Result Meaning**: A zero-result on an exact canonical URL or strict exact-match text query strongly suggests the page is unindexed (or newly published), meaning it receives zero organic inbound search traffic.

## 6. Adzuna Analysis
- **Capability**: Can deterministically prove presence on a major global aggregation network.
- **Zero-Result Meaning**: A zero-result proves the employer is not actively syndicating this job to Adzuna's network.

## 7. Multi-Source Analysis
- **CASE D (Neither observed, both requests successful)**: The job exists (JobSight found it via targeted ATS discovery), but it is NOT syndicated (Adzuna absence) and NOT organically indexed (SearchEngine absence). This combination mathematically establishes that the job's inbound discovery funnel is restricted entirely to direct navigation or private sharing. This is a defensible, positive proof of `LOW` visibility.

## 8. Reference-Baseline Feasibility
**AVAILABLE.** The baseline is the intersection of [Organic Indexing] + [Commercial Syndication]. 

## 9. Candidate Positive Visibility Signals
**PLAUSIBLE.** We can establish `LOW` visibility if we strictly require a quorum of authoritative absences:
1. `NOT_OBSERVED` on Adzuna.
2. `NOT_OBSERVED` on SearchEngine (via an exact URL indexing check or strict exact-match query).
If both are definitively absent while the job is known to be active, visibility is objectively `LOW` relative to the market baseline.

## 10. False-Positive Analysis
- **Risk**: Job is 1 hour old (unindexed). *Not a false positive; it genuinely has low visibility right now.*
- **Risk**: Search query was slightly malformed (e.g., company name variations), causing Google to return 0 results when the job is actually indexed. *High risk.*
- **Mitigation**: SearchEngine absence must be based on a structural URL exact-match query (e.g., `url:"https://boards.greenhouse.io/..."`) rather than fuzzy text queries, eliminating hallucinated absences.

## 11. Freshness
Extremely time-sensitive. A job might be unindexed on Day 1 (`LOW` visibility) but indexed by Day 3 (`HIGH` visibility). The evidence must be timestamped and re-evaluated per run.

## 12. Mission Alignment
Establishing `LOW` visibility via unindexed/unsyndicated quorum perfectly aligns with the mission: finding jobs people otherwise would not encounter. While it does not prove `LOW` competition (people could be linked directly from a 50k-person newsletter), it represents an intrinsic market inefficiency that qualifies as a positive mission signal.

## 13. Competition Boundary
Competition remains definitively `UNKNOWN`. Applicant volume remains `INACCESSIBLE`.

## 14. Decision
**LOW_VISIBILITY_IS_PLAUSIBLY_ESTABLISHABLE**
We can establish a defensible `LOW` visibility state by requiring a multi-provider quorum of absence against an exact-URL structural search constraint.

## 15. Recommended Next Implementation
Implement a specialized **Visibility Quorum Rule**:
- Refactor `SearchEngineProvider` to support a rigid `URL_INDEX_CHECK` strategy (bypassing fuzzy LLM parsing).
- If Adzuna returns `NOT_OBSERVED` AND SearchEngine `URL_INDEX_CHECK` returns `NOT_OBSERVED`, the Visibility Engine safely upgrades the bounded absence into a definitive `LOW` visibility intelligence signal.

## 16. Explicitly Rejected Approaches
- A generic 1-100 "Visibility Score".
- Inferring `LOW` visibility from a single source (e.g., just Adzuna).
- Inferring `LOW` competition from `LOW` visibility.

## 17. Remaining Limitations
We still lack applicant volume. A `LOW` visibility job might still have high competition via private networks. 

## 18. Mission Status
**DISCOVERY_MISSION_NOT_VALIDATED**
