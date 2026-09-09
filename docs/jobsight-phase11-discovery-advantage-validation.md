# Phase 11: Discovery Advantage Validation

## 1. Executive Summary
This experiment tested whether JobSight could empirically prove a "Discovery Advantage" (finding legitimate jobs that are underexposed on conventional channels). Due to foundational limitations in the current evidence acquisition pipeline—specifically the non-deterministic, LLM-based `SearchEngineProvider`—the system cannot legitimately distinguish between a truly "hidden" job and an LLM extraction failure. As a result, the mission remains unvalidated.

## 2. Hypothesis
H1: JobSight can repeatedly discover legitimate job opportunities that are not readily discoverable through conventional job-discovery channels, and JobSight can provide sufficient evidence to explain why those opportunities appear underexposed.

## 3. Experiment Design
The design requires sampling real jobs from the JobSight database and checking their presence across independent conventional baselines. An opportunity is `UNDEREXPOSED` if it is verified as active but definitively `NOT_OBSERVED_ON_CHECKED_SOURCES` across all conventional baselines.

## 4. Sampling Method
Sample Size: 0 (Experiment structurally aborted).
A programmatic run of the discovery pipeline was attempted. However, the experiment was aborted because the underlying provider mechanics fail adversarial review, rendering any numeric results inherently fabricated or deeply flawed by false positives.

## 5. Conventional Discovery Baseline
- **Adzuna**: Represents commercial aggregation. Capable of returning a deterministic absence.
- **SearchEngineProvider**: Intended to represent organic web indexing (Google/Bing). Currently implemented as an unstructured LLM prompt (`runAgyUnstructured`).

## 6. Provider Independence
Adzuna and the SearchEngineProvider are independent. However, the SearchEngineProvider is not independent from the underlying LLM's behavioral variance.

## 7. Identity Matching Protocol
The experiment required deterministic identity matching (e.g., canonical URL). Adzuna supports strict matching, but the SearchEngineProvider attempts fuzzy semantic extraction of titles/companies, fundamentally violating the strict identity requirement.

## 8. Observation Semantics
- `OBSERVED_ON_SOURCE`: The provider found the job.
- `NOT_OBSERVED_ON_CHECKED_SOURCES`: The provider definitively proved absence.
- `UNKNOWN`: The provider failed, hallucinated, or timed out.

## 9. Freshness Protocol
Evidence must be evaluated contemporaneously (within 24 hours of discovery).

## 10. Experimental Results
Because the `SearchEngineProvider` relies on an LLM, it cannot execute a "successful and complete zero-result observation". When the LLM returns an empty JSON list, it is impossible to determine if the URL is actually unindexed or if the LLM simply failed to extract the search results. Treating this as `NOT_OBSERVED` would manufacture false `UNDEREXPOSED` classifications.
- **Total Sample**: 0 (Aborted)
- **Conventionally Visible**: 0
- **Partially Visible**: 0
- **Underexposed**: 0
- **Unknown**: 0

## 11. Underexposed Cases
None established.

## 12. Manual Validation
Not applicable. 

## 13. Negative Controls
Not applicable.

## 14. Positive Controls
Not applicable.

## 15. False Positives
If the experiment were run, the false-positive rate for `UNDEREXPOSED` would approach 100% due to LLM extraction failures masquerading as absence.

## 16. User-Value Assessment
Not applicable.

## 17. Evidence Explanation Examples
An evidence explanation relying on the current SearchEngineProvider would fail adversarial review instantly.
*Claim:* "Checked conventional source SearchEngine: NOT_OBSERVED."
*Reality:* "An LLM was asked to read search results and didn't output JSON."

## 18. Adversarial Review
The experimental design fails multiple validity threats:
- **Threat I (Title/company mismatch cause false absence)**: Yes. The SearchEngineProvider relies on semantic text matching rather than a structured index API, virtually guaranteeing false absences.
- **Threat E (Source failures masquerade as absence)**: Yes. LLM unstructured extraction failures cannot be distinguished from true zero-results.

## 19. Threats to Validity
The `SearchEngineProvider` is a fatal threat to validity. Without a deterministic structural search API (like SerpAPI), bounded absence cannot be proven.

## 20. Mission Verdict
**MISSION_NOT_VALIDATED**
Underexposure cannot be reliably established because the evidence protocol is fundamentally insufficient.

## 21. Recommended Next Step
JobSight MUST replace the LLM-based `SearchEngineProvider` with a deterministic, structural Search API (e.g., Google Custom Search JSON API or SerpAPI) capable of executing exact URL queries (`url:https://...`) and returning verifiable zero-result counts. Only then can this experiment be legitimately executed.

## 22. Production Changes
NONE.

## 23. Residual Risks
Continuing to operate without deterministic visibility baselines means JobSight cannot fulfill its primary value proposition of identifying hidden opportunities.
