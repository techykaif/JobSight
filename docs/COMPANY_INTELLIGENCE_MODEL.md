# Company Intelligence Model

## Overview
The Company Intelligence Model (Milestone 6) sits immediately after Job Qualification (Milestone 5). It strictly evaluates companies associated with jobs that survived the initial candidate fit screen (`APPLY`, `CONSIDER`, or `RESEARCH_REQUIRED`). It aims to answer: "Even if I qualify for this job, is this company currently an attractive and realistic place to spend application effort?"

## 1. Split Architecture
The system employs a strict Stage A / Stage B separation:
1.  **Stage A (Unstructured AGY Retrieval):** The AGY worker searches for and retrieves company data from official websites, careers pages, and recent news.
2.  **Stage B (Structured Persistence):** The output is extracted strictly into a predefined Zod schema without any capability for additional retrieval, ensuring deterministic normalization.
Raw output from Stage A is preserved as a `research_artifact` to prevent data loss in case of restructuring failure.

## 2. Fact vs. Signal vs. Inference
The model strictly differentiates between:
*   **FACT:** Verifiable data point (e.g., "14 engineering roles listed on Careers page").
*   **SIGNAL:** Observable pattern (e.g., "Multiple new roles posted in the last 30 days").
*   **INFERENCE:** Derived meaning (e.g., "Hiring Momentum is High").
The schema explicitly stores `type: 'FACT' | 'SIGNAL' | 'INFERENCE'` to prevent hallucination of speculative numbers (e.g., "Company hires 5% of applicants").

## 3. Evidence Hierarchy
1.  Official website / Careers page / Regulatory filings.
2.  ATS systems and official social profiles.
3.  High-quality reputable publications.
4.  Job boards.
5.  Community / review platforms.

## 4. Derived Scores (Deterministic)

### Hiring Momentum (`hiring_momentum_v1`)
A 0-100 score assessing current organizational growth and hiring velocity.
**Increases for:** High volume of current open roles, engineering-specific openings, recent posting activity, expansion signals.
**Decreases for:** Contraction signals, recent layoffs (major penalty).
*Missing data does not automatically mean poor momentum; it just lowers confidence.*

### Company Score (`company_v1`)
A 0-100 score assessing overall company attractiveness.
**Increases for:** Stability signals, clear employee count (size indicates maturity), funding data, remote compatibility.
**Decreases for:** Contraction, layoffs.
*This measures attractiveness for the candidate's specific job-search objective, not objective moral "goodness."*

### Confidence
A 0-1 score representing the reliability of the underlying evidence.
**Increases for:** Presence of official sources, exact employee counts, explicitly stated openings.

## 5. Opportunity V2
The final Opportunity Score (`opportunity_v2`) blends the M5 Job Fit with M6 Company Intelligence.
**Weighting (Conceptual):**
*   60% M5 Opportunity V1 (Candidate/Job Fit)
*   20% Company Score
*   20% Hiring Momentum

**CRITICAL SAFEGUARD:** An excellent Company Score cannot "rescue" a job that failed initial qualification. If `Opportunity V1` < 50, `Opportunity V2` is forcefully capped at 49.

## 6. Research Cache
Company research is cached for 7 days to prevent redundant processing. Failures in company research do NOT drop jobs from consideration; they merely proceed with `UNKNOWN` company scores and reduced confidence.
