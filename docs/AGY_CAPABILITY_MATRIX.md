# AGY Capability Matrix

| Capability                | Status             | Evidence | Notes |
| ------------------------- | ------------------ | -------- | ----- |
| CLI print mode            | VERIFIED_SUPPORTED | M1       | Works via `execa`. |
| Structured JSON           | VERIFIED_SUPPORTED | M1       | Works via `--json-schema`, but output is enveloped in `.structured_output`. |
| Web search                | VERIFIED_SUPPORTED | M2       | Works flawlessly via Google Search Grounding in unstructured `-p` mode. |
| Direct URL access         | VERIFIED_SUPPORTED | M2       | Works in unstructured `-p` mode. |
| Static HTML               | VERIFIED_SUPPORTED | M2       | Extracted React.dev successfully. |
| JS rendering              | VERIFIED_SUPPORTED | M2       | Read React.dev content easily. |
| ATS Boards (Greenhouse)   | VERIFIED_SUPPORTED | M2       | Successfully followed 404 to real company page. |
| Search→Open→Extract       | VERIFIED_SUPPORTED | M2       | Highly capable as an autonomous agent in unstructured mode. |
| Source provenance         | VERIFIED_SUPPORTED | M2       | Can return URLs it cited. |
| Browser opening           | VERIFIED_UNSUPPORTED| M2      | Uses headless/grounding fetches, no visible browser. |
| DOM interaction           | VERIFIED_UNSUPPORTED| M2      | Cannot run DOM scripts or inspect specific query selectors interactively. |
| Clicking                  | VERIFIED_UNSUPPORTED| M2      | Cannot click buttons. |
| Typing                    | VERIFIED_UNSUPPORTED| M2      | Cannot type into fields. |
| Login detection           | PARTIALLY_SUPPORTED | M2      | Can read that a page says "Please log in". |
| Manual auth continuation  | VERIFIED_UNSUPPORTED| M2      | Print mode is stateless; no persistent cookie jar shared with host browser. |
| Browser cookie sharing    | VERIFIED_UNSUPPORTED| M2      | Isolated processes. |
| Conversation continuation | VERIFIED_SUPPORTED | CLI Docs | Supported via `--continue` or `--conversation <ID>`. |
| 2-worker concurrency      | VERIFIED_SUPPORTED | M2       | Child processes isolate perfectly. |
| 3-worker concurrency      | VERIFIED_SUPPORTED | M2       | Child processes isolate perfectly. |
