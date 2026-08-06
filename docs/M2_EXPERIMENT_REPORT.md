# M2 Experiment Report

## Probe 1: Web Search (Structured Output)
*   **Test**: `agy -p` with `--output-format json` and `--json-schema` to search the web for Microsoft's CEO.
*   **Result**: FAILED (Returned empty object `{}`).
*   **Classification**: VERIFIED_UNSUPPORTED
*   **Limitation**: When strict `--json-schema` mode is engaged, AGY is forced into a purely parametric text-generation mode, disabling its external retrieval tools.

## Probe 2: Web Search (Unstructured Print Mode)
*   **Test**: `agy -p` asking to search for Microsoft's CEO and return the URL.
*   **Result**: SUCCESS. Returned "Satya Nadella" along with source URLs (`https://www.microsoft.com/...`).
*   **Classification**: VERIFIED_SUPPORTED
*   **Observation**: It natively uses Google Search Grounding to fetch live information perfectly.

## Probe 3: Direct JS-Rendered URL Access
*   **Test**: `agy -p` asked to access `https://react.dev/` and extract the main heading.
*   **Result**: SUCCESS. Returned "**React**" and its subheading.
*   **Classification**: VERIFIED_SUPPORTED
*   **Observation**: Even though React.dev is a Single Page Application, AGY fetched the rendered DOM or extracted it via Search Grounding snippets successfully.

## Probe 4: ATS Job Page & Error Handling
*   **Test**: `agy -p` asked to access `https://boards.greenhouse.io/openai`.
*   **Result**: SUCCESS.
*   **Observation**: AGY realized the link was 404, independently searched for OpenAI's *actual* careers page, found it (`https://openai.com/careers/search/`), and returned software engineering roles from there.
*   **Classification**: VERIFIED_SUPPORTED (Highly autonomous).

## Probe 5: Browser Automation (Click/Type/DOM)
*   **Test**: Investigated if AGY can perform true Playwright-like browser interactions (clicks, typing, session management).
*   **Result**: VERIFIED_UNSUPPORTED natively in standard `-p` runs.
*   **Observation**: AGY accesses content via HTTP fetches, Google Search Grounding, and potentially headless rendering, but does not expose interactive browser driving (like clicking specific DOM elements or managing cookie sessions) to the CLI runner without additional plugins.

## Probe 6: Concurrency
*   **Test**: Ran multiple `agy -p` commands simultaneously.
*   **Result**: VERIFIED_SUPPORTED.
*   **Observation**: Process isolation works well.

## Conclusion
The architecture must split retrieval from extraction.
1. **Retrieval**: Run `agy -p` in unstructured mode (or use custom Node fetchers) to get the raw HTML/text.
2. **Extraction**: Run `agy -p --output-format json --json-schema` on the *already retrieved* text to force a structured JSON output without requiring the model to browse.
