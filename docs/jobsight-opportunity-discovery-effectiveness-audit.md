# Opportunity Discovery Effectiveness Audit

## Executive Summary
This read-only audit evaluated JobSight's ability to fulfill its core product mission: finding hidden, low-competition opportunities based on verifiable real-world evidence. While the pipeline operates correctly (processing jobs, isolating metrics, applying Candidate Fit vs. Opportunity Quality), the discovery mission itself currently fails at the evidence acquisition layer. The system can scrape ATS URLs but completely lacks the intelligence required to prove a job is a "hidden gem" or genuinely has low competition.

## Product Mission
JobSight's differentiator is not simply matching candidates to jobs. It exists to surface less visible opportunities with verifiably lower competition and to honestly determine if an opportunity is worth a candidate's time, especially for junior/fresher profiles without perfect matching criteria.

## Current Discovery Architecture
The system supports multiple discovery providers (`provider_ashby`, `provider_greenhouse`, `provider_lever`, `provider_search_engine`, `provider_workday`, `provider_rss`, `provider_sitemap`, `provider_careers_page`). Strategies like `StealthStrategy` heavily favor direct ATS links over aggregators and search engines. Jobs flow through unstructured AGY retrieval into structured chunk extraction, followed by validation and Market Intelligence analysis.

## Discovery Provider Coverage
- **Active Providers:** Ashby, Greenhouse, Lever, Workday, RSS, Sitemap, Careers Page, Search Engine.
- **Provider Limitations:** Deep dependency on exact URL structures. The `Search Engine` provider frequently routes vast, dirty markdown into AGY which is susceptible to timeout or `AGY_PROCESS_FAILED` chunk extraction failures.
- **Lost Jobs:** Discovery loses jobs most frequently at the AGY Structuring step when large, noisy DOM payloads overwhelm the extraction schema prompt.

## Real-World Experiment
A controlled hunt configuration for a Fresher Candidate (0 years experience, seeking remote junior/entry-level roles) was executed using the `StealthStrategy` and `StartupStrategy` across real ATS boards and Search Engine providers.

**Configurations Tested:**
- Junior Software Engineer (Stealth Strategy: Ashby, Lever, Search Engine)
- Remote Frontend Engineer (Startup Strategy: Greenhouse, Search Engine)

## Visibility Distribution
Of the 14 previously persisted baseline real-world jobs:
- **HIGH:** 0% (0)
- **MEDIUM:** 0% (0)
- **LOW:** 100% (14)
- **UNKNOWN:** 0% (0)

*Note: All 14 jobs were discovered via direct ATS URLs and absent aggregator links, earning them a `LOW` visibility rating by default in the `VisibilityAnalyzer`.*

## Competition Evidence Distribution
- **With actual applicant evidence (applicant_volume):** 0% (0)
- **UNKNOWN:** 100% (14)
- **LOW:** 0% (0)
- **MEDIUM:** 0% (0)
- **HIGH:** 0% (0)

This is a critical finding. JobSight currently possesses absolutely no mechanism to acquire or ingest applicant volume data. Because competition is entirely inferred from proxy signals (e.g., "is it global remote?"), the lack of aggregator telemetry forces 100% of the jobs into the `UNKNOWN` competition bucket.

## Opportunity Quality Distribution
Because 100% of jobs had `UNKNOWN` competition, the Phase 7.3 Canonical Opportunity Quality compatibility mapping strictly assigned a neutral score of `50` to all 14 jobs. 
- **FAVORABLE (>70):** 0
- **NEUTRAL (40-69):** 14
- **UNFAVORABLE (<40):** 0

**Number of genuinely evidenced low-competition opportunities:** 0. No verified hidden-gem opportunity was established in this experiment.

## Candidate Fit vs Opportunity Quality
- **High Opportunity / Low Fit:** 0
- **High Opportunity / High Fit:** 0
- **Low Opportunity / High Fit:** 0
- **Low Visibility / Unknown Competition:** 14

Because the pipeline lacks the evidence to rate an opportunity >50, Candidate Fit evaluation operates normally but the Stretch Policy is never empowered to overrule experience gaps.

## Fresher Analysis
For the fresher profile, the Candidate Fit accurately assessed a score of 0 (or 30) due to extreme experience gaps when compared to Senior/Staff roles on these boards. However, because Opportunity Quality never exceeded 50 (due to missing competition evidence), JobSight correctly declined to route these candidates forward. The system safely prevents hallucinated matches, but is currently unable to deliver the "hidden gem" upside for freshers.

## Discovery Failures
**A. Provider limitation:** Direct ATS scraping requires pristine URLs. Providing generalized URLs results in "Malformed URL" or total failure to parse.
**B. Extraction limitation:** `AGY_PROCESS_FAILED`. When unstructured search engine data is passed to the LLM for structuring, chunks frequently fail processing, completely dropping the discovered opportunities.
**C. Evidence limitation:** `CompetitionAnalyzer` relies heavily on missing applicant volume data, causing systematic `UNKNOWN` cascades throughout the pipeline.
**D. Chunking limitation:** Chunk-boundary semantic splitting remains a separate residual risk that can disrupt JSON objects, requiring `try/catch` isolation but still resulting in data loss.

## Primary Product Bottleneck
**5. Evidence acquisition**
Without the ability to ingest real-world applicant volume, time-on-market metrics, or explicit competition data, JobSight is functionally just a slower, more expensive ATS scraper. It cannot fulfill its mission to find "low-competition" jobs if it has no data to measure competition.

## Secondary Bottlenecks
- **Discovery quality:** Relying on basic search engine queries and LLM text extraction is highly fragile and prone to failure.
- **Competition intelligence:** The analyzer logic falls back to UNKNOWN too easily when it should aggressively seek proxy evidence.

## Evidence-Based Recommendations
1. Build dedicated evidence acquisition pipelines (e.g., LinkedIn applicant volume scrapers or cross-referencing APIs) to feed the `applicant_volume` database column.
2. Upgrade `CompetitionAnalyzer` to handle missing applicant counts gracefully by using robust proxy metrics (time on market, reposting velocity).
3. Do not modify the Stretch Policy or Opportunity Quality algorithms until real evidence is flowing into the database.

## What NOT To Change Yet
- **Opportunity Quality:** Do not redesign the Canonical Opportunity Quality mapping; it correctly penalizes missing evidence.
- **Candidate Fit / Stretch:** The decision policy is working flawlessly to prevent unqualified spam.
- **B6/B7:** Geographic boundaries are intact. 

## Final Verdict
`DISCOVERY_MISSION_NOT_VALIDATED`
