# V1.0.1-A1 Performance Optimization Report

## Overview
This report details the optimization of the Stage B (Structured Extraction) pipeline which was previously failing due to `[AGY_TIMEOUT]` (90000ms). The root cause was identified as excessive token generation triggered by unnecessary required fields in the extraction schema. 

## Bottleneck Identified
The `CandidateJobSchema` required the LLM to generate an array of `evidence` objects for every single field it extracted per job. For example, if the LLM extracted 10 jobs, it had to generate 5-10 nested `evidence` JSON objects for *each* job, explaining whether the field was a "FACT" or "INFERENCE" and extracting an excerpt. This resulted in an enormous amount of output tokens, causing the model to take upwards of 120+ seconds and blowing past the 90-second timeout.

## Optimizations Implemented
1. **Schema Simplification**: 
   - Made `evidence` and `unknownFields` optional arrays in the Zod schema.
   - Removed `evidence`, `unknownFields`, and `sources` from the strictly `required` list in `EXTERNAL_AGY_STRUCTURING_CONTRACT`.
   - This cut the JSON Schema size from 2187 chars down to 1779 chars and drastically reduced output token bloat.

2. **Prompt Reduction**:
   - Removed instructions forcing the LLM to "Separate direct facts from inference for evidence" as it is no longer required.

3. **Stage B Chunking Strategy**:
   - If Stage A uncovers a massive amount of unstructured text, trying to structure it all at once can still hit token limits. 
   - Implemented a naive line-based Markdown chunker (6000 chars per chunk). 
   - Sent chunks concurrently via `Promise.all` to AGY workers with a reduced 60000ms timeout per chunk.
   
4. **Retry & Backoff Policy**:
   - Removed deterministic `AGY_SCHEMA_VALIDATION_FAILED` from the immediate retry loop (deterministic errors should not be retried identically).
   - Added a linear exponential backoff (`1000ms * attempt`) for transient errors to prevent rapid-fire failures.

5. **Telemetry & Observability**:
   - Implemented `STAGE_B_TELEMETRY` publishing in `src/lib/pipeline/ingestion.ts` which tracks `latencyMs`, `chunks`, `markdownSizeChars`, and `candidatesOutput`.

## Acceptance Verification Results
We ran the real production hunt exactly as specified:
- **Roles**: Software Engineer, Full Stack, Backend, Automation
- **Location**: India
- **Scope**: LOCAL_AND_GLOBAL
- **Remote**: REMOTE_ONLY
- **Salary Disclosure**: TRUE
- **Max Usable**: 3

### Outcomes
- **Stage B Latency**: `41,669ms` (Down from >90,000ms timeout).
- **Chunks Processed**: 3
- **Candidates Discovered**: 9
- **Regression Status**: 74 / 74 tests passing.
- **Pipeline Result**: `COMPLETED` (The hunt finished successfully without a Stage B timeout. 8 jobs were skipped correctly due to `SALARY_NOT_DISCLOSED` and 1 job was flagged for company research).

> Note: The Company Research component (`getCompanyIntelligence`) hit a 90s timeout for the surviving job, but as per the requirements, company intelligence architecture was strictly untouched. Stage B structuring latency has been successfully resolved.
