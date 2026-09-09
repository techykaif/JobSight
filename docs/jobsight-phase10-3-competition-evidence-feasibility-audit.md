# Phase 10.3: Competition / Applicant-Volume Evidence Feasibility Audit

## 1. Objective
Determine whether JobSight can obtain legitimate, reproducible evidence about job competition and/or applicant volume without resorting to scraping, browser automation, or invalid proxies.

## 2. Current Evidence Gap
JobSight currently bounds visibility (e.g., `NOT_OBSERVED_ON_CHECKED_SOURCES`), but the Canonical Opportunity Quality engine strictly prohibits inferring "Low Competition" from limited visibility alone. We currently lack any verified quantitative applicant or competition metric, resulting in `UNKNOWN` competition across all evaluations.

## 3. Evidence Contract
Legitimate competition evidence must provide:
- Identifiable job and source
- Actual metric or value (e.g., applicant count, explicit competition index)
- Observation timestamp and provenance
- Deterministic job match (via Canonical URL, Provider ID, or strict semantic lock)
- Successful, authorized, and structured retrieval

## 4. Candidate Source Matrix & Official Access Findings

### A. LinkedIn
- **Applicant Volume**: Exposed on consumer web UI ("X applicants").
- **Official Access**: The LinkedIn Talent Solutions APIs allow employers to query their *own* applicants. There is NO official public search API that exposes applicant volume to third parties.
- **Terms**: Strictly prohibits scraping, automated access, or reverse-engineering of their consumer site.
- **Classification**: `HUMAN_VISIBLE_AUTOMATION_INACCESSIBLE`

### B. Indeed
- **Applicant Volume**: Sometimes exposed on consumer UI ("X people applied").
- **Official Access**: Indeed's public API program has been heavily restricted/deprecated. Available publisher APIs provide job metadata but do NOT expose applicant volumes.
- **Classification**: `HUMAN_VISIBLE_AUTOMATION_INACCESSIBLE`

### C. Glassdoor
- **Applicant Volume**: Not dynamically exposed per job in a granular way.
- **Classification**: `NOT_VIABLE`

### D. Employer ATS Platforms (Greenhouse, Lever, Ashby, Workday)
- **Applicant Volume**: Strictly internal.
- **Official Access**: Public Job Board APIs (e.g., `boards-api.greenhouse.io`) return job descriptions, custom fields, and application schemas. Applicant metrics are locked behind private administrative APIs (e.g., Harvest API) requiring company-specific secret keys.
- **Classification**: `NOT_VIABLE` (Privacy-locked)

### E. Adzuna / Other Job Board APIs (Jooble, ZipRecruiter)
- **Applicant Volume**: They aggregate jobs but do not possess or expose applicant counts for external ATS jobs.
- **Classification**: `NOT_VIABLE`

### F. Specialized Labor Market APIs (Lightcast / Emsi Burning Glass)
- **Applicant Volume**: They provide macroeconomic supply/demand metrics for a *role/location* (e.g., "Demand for Software Engineers in Seattle is High"), but NOT real-time applicant volume for a *specific job requisition*.
- **Classification**: `NOT_VIABLE` (Does not meet requisition-specific volume contract)

## 5. Applicant-Volume & Competition-Metric Findings
Actual Applicant Volume is a highly proprietary, privacy-sensitive metric heavily guarded by employers and primary job boards. No major platform legitimately exposes this data to unauthorized third-party automated pipelines. 

## 6. Matching Feasibility
`NOT APPLICABLE`. Since the metric cannot be legitimately acquired, matching it to a JobSight run is impossible.

## 7. Freshness & Provider Independence
`NOT APPLICABLE`.

## 8. Terms/Access Constraints, Cost/Scale, Security Considerations
Any attempt to acquire this data today requires commercial scraping aggregators (e.g., BrightData, Coresignal) or direct Puppeteer automation against LinkedIn/Indeed, violating the explicit `NO SCRAPING` rule of this audit and breaking JobSight's legitimate API architecture.

## 9. Feasibility Classification
**Applicant Volume Evidence is INACCESSIBLE via legitimate public APIs.**

## 10. Explicit Non-Viable Approaches
- Scraping LinkedIn/Indeed via headless browsers.
- Using third-party scraping proxy APIs.
- Guessing applicant volume via job age, title popularity, or SearchEngine hit counts.
- Claiming a job has "Low Competition" simply because it is missing from Adzuna.

## 11. Recommended Next Step
**PIVOT COMPETITION DEFINITION OR ACCEPT THE GAP.**
Because legitimate applicant volume is fundamentally inaccessible, JobSight cannot fulfill the `LOW_COMPETITION` evidence pipeline through direct volume observation. The Canonical Opportunity Quality engine currently vetoes `FAVORABLE` status if competition is `UNKNOWN` without other overriding positive signals (like `EXCEPTIONAL` compensation). 

Recommendation: Stop searching for a non-existent public applicant API. Rely solely on strictly verified `LOW_VISIBILITY` (which requires discovering a new methodology to establish an authoritative baseline) or `EXCEPTIONAL` compensation to validate the mission.

## 12. Remaining Mission Gaps
The inability to measure competition leaves JobSight blind to whether a "hidden" job is truly a low-competition opportunity or just a highly competitive job posted privately to a 10,000-person slack community.
