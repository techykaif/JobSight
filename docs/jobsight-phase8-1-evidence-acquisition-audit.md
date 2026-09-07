# Phase 8.1: Evidence Acquisition Architecture Audit

## 1. Current Evidence Architecture
JobSight currently discovers jobs via `SourceManager` strategies, parsing them via unstructured LLM extraction (Stage A/B), and classifying them via `Market Intelligence` analyzers. The pipeline relies heavily on the `url` and implicit signals (e.g. `remoteType`) derived from the job payload. There is currently no secondary data acquisition pipeline; what is extracted from the job posting artifact is the only data available to the `Market Intelligence` analyzers.

## 2. Evidence Inventory
- **Job Authenticity:** Derived from URL domain matching and metadata completeness.
- **Job Freshness:** Derived from keyword matching in `rawContent` (e.g., "days ago").
- **Visibility:** Derived from `sourceProviderType` and `sourceUrl` domain checking.
- **Competition:** Derived from `remoteType` (Global vs Local) and `sourceUrl` attributes (e.g., "easy-apply").
- **Applicant Volume:** Zero acquisition. The `applicant_volume` field exists in the DB but is unused.
- **Hiring Friction:** Derived from boolean flags (`coverLetterRequired`, `accountRequired`) mapped in Canonical Opportunity Quality.
- **Compensation:** Extracted directly from text (if available).
- **Remote/Location Reality:** Extracted directly from text into `remoteType` and `location`.

## 3. Evidence Source Matrix
| Signal | Source Provider | DB Field | Source Type |
|--------|-----------------|----------|-------------|
| Authenticity | URL String & Content | `authenticity_level` | Inference |
| Freshness | `rawContent` text | `freshness_level` | Regex/Heuristic |
| Visibility | URL & Provider Metadata | `visibility_level` | Inference |
| Competition | `remoteType`, URL string | `competition_level` | Inference |
| Applicant Volume | N/A (Missing) | `applicant_volume` | **Missing** |
| Friction | Job text -> boolean | `friction_level` | Direct (LLM extraction) |

## 4. Direct Evidence vs Inference Classification
- **Direct Evidence:** Compensation, geographic location, required accounts/cover letters (friction).
- **Inference / Heuristics:** Authenticity, Freshness, Competition, Visibility.
- **Fabrication/Unsupported Claims:** Currently, JobSight prevents fabrication by collapsing unprovable heuristics into `UNKNOWN`. Since competition lacks applicant data, it correctly defaults to `UNKNOWN` when remoteType or application method is unknown, preventing fake "Hidden Gem" classifications.

## 5. Provenance & Freshness Assessment
- **Provenance:** Provenance is maintained for the `sourceUrl` and `sourceProviderType` (e.g., `SEARCH_ENGINE` vs `GREENHOUSE`).
- **Freshness:** Freshness is entirely textual heuristic. There is no timestamp tracking for when the job was actually posted, only when JobSight crawled it (`createdAt`).

## 6. Competition Evidence Assessment
**Current state:** The pipeline has **zero** legitimate applicant volume data. The `CompetitionAnalyzer` relies entirely on assumptions: `if remote worldwide -> HIGH competition`. It completely ignores the `applicant_volume` DB column.
**Result:** 100% of jobs in the previous audit yielded `UNKNOWN` competition. Without real applicant counts or proxy signals (e.g., time-on-market), JobSight cannot fulfill its mission to find "low competition" jobs.

## 7. Visibility Evidence Assessment
**Current state:** `LOW/MEDIUM/HIGH` is based entirely on whether the `sourceUrl` contains `linkedin.com` or `indeed.com`.
**Semantic mismatch:** The system equates "Not explicitly from LinkedIn/Indeed/Search Engine" to "LOW visibility". Direct ATS discovery does **not** prove a job is hidden from the internet; it only proves JobSight bypassed an aggregator.
**Verdict:** The system makes a claim ("Hidden Job") when the evidence only supports ("Not observed on checked aggregators").

## 8. Discovery Limitations
- **Provider Limitations:** Exact ATS URLs work flawlessly; generic/vague paths fail.
- **Query Limitations:** Aggregator queries often yield extremely noisy, DOM-heavy payloads.
- **Extraction Limitations:** `AGY_PROCESS_FAILED` timeouts occur frequently when structuring massive search-engine HTML markdown.
- **Evidence Limitations:** Zero secondary API calls exist to cross-reference jobs for applicant volume.

## 9. Current Unsupported Assumptions
- Assumption: Direct Greenhouse/Lever/Ashby URLs mean the job has low visibility.
- Assumption: A job that is "Remote Worldwide" automatically has high competition.
- Assumption: If `rawContent` doesn't mention "days ago", freshness is unknown.

## 10. Feasible Evidence Sources
- **Applicant proxies:** GitHub commit activity (for tech startups), company size vs funding rounds (to infer applicant pool).
- **Visibility proxies:** Explicitly querying LinkedIn/Indeed APIs (or scraping) to check if the specific ATS URL is cross-posted.
- **Freshness:** Extracting `application/ld+json` metadata from ATS pages for absolute timestamps.

## 11. Unreliable / Unavailable Sources
- **Direct Applicant Counts:** Without paid LinkedIn API access or an authenticated user session, scraping exact applicant volume is highly brittle and often legally/technically blocked.
- **Search Engine DOM parsing:** Too noisy and unstructured for reliable single-shot LLM extraction.

## 12. Recommended Evidence Architecture
JobSight must implement an **Evidence Acquisition Phase** (Stage C) that fires *after* structured extraction. This phase will take the verified ATS URL and query a secondary verifiable source (e.g., a dedicated cross-reference aggregator API or specialized scraper) to confirm:
1. Is this URL indexed on major boards? (Visibility)
2. Is there a proxy metric for applicant volume (e.g., time-to-fill estimates based on company growth rate)?

## 13. UNKNOWN/Failure Semantics
The current system correctly preserves `UNKNOWN` when data is missing. This must remain strict. If the secondary evidence acquisition pipeline fails, the job remains `UNKNOWN` competition, scores a 50 in Canonical Opportunity Quality, and is safely rejected by the Stretch Policy.

## 14. Minimal Implementation Boundary for Phase 8.3
To fix the bottleneck without overengineering:
- Implement a `CrossReferenceProvider` that takes an extracted ATS job and performs an explicit check against aggregator APIs/indexes to prove visibility.
- Wire `applicant_volume` (or a proxy like `market_saturation_index`) into `CompetitionAnalyzer` using verifiable data rather than remote-work inferences.

## 15. Risks and Unresolved Questions
- **Risk:** Attempting to scrape LinkedIn for applicant volume will likely fail due to rate-limiting and anti-bot measures. We need a proxy signal.
- **Unresolved:** How can we accurately gauge competition for a small startup's Careers page if they don't publish their applicant counts anywhere? We may need to rely on the *Company Intelligence Model* (funding + size) to infer baseline volume.

