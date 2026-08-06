# V1.1-C2.1 UI Stabilization

## Objective
This document outlines the stabilization pass made to Phase C's frontend implementation. The goal was to fix regressions, stabilize rendering on dynamically typed JSON fields, and ensure strict CSS module and React Server Component compliance without introducing new features.

## Fixes Implemented

### 1. CSS Module Strictness
- **Issue**: Next.js (Webpack) build failed due to the usage of `:root` and `:global(:root)` in CSS Modules (`ui.module.css`), violating pure selector rules.
- **Fix**: Removed root-level variables from `ui.module.css`. Moved global variables and premium design tokens into `src/app/globals.css` where `:root` declarations are fully supported and standard for application-wide theming.

### 2. React Server Component Hydration
- **Issue**: Standard DOM event handlers (`onMouseOver`, `onClick`, `onMouseLeave`) were embedded into UI components (`Breadcrumbs`, `ActionButton`, `FilterChip`, `JobCard`) which were imported by Next.js Server Components. Next.js cannot serialize event handlers across the client-server boundary.
- **Fix**: Pre-pended `"use client";` to all interactive design system components (e.g., `Breadcrumbs.tsx`, `ActionButton.tsx`, `FilterChip.tsx`) to properly define them as Client Components. Refactored server-side usage of `onClick` (such as in `src/app/companies/page.tsx`) to avoid inline event handlers altogether on the server.

### 3. Safely Normalizing Database JSON Fields
- **Issue**: Job detail fields (`decisionResult.reasons`, `decisionResult.unknowns`, `decisionResult.requiredActions`) and legacy `decision` fields could arrive as raw `string[]`, JSON strings, or `null`/`undefined`, causing `.map()` to throw runtime errors on the Server.
- **Fix**: Introduced a `parseJsonArray` helper in `src/app/jobs/[id]/page.tsx` to safely normalize all array values before rendering.
  - Returns empty arrays for `null` or `undefined`.
  - Attempts `JSON.parse` if the value is a string, catching exceptions to handle raw strings gracefully.
  - Ensures robust `.length` checking before map operations.
- **Audit**: All other pages (`radar`, `board`, `companies`, `hunts`) natively traverse strictly typed Drizzle arrays safely, requiring no further JSON normalization on UI render iterations.

## Verification
- `npm run typecheck` - Passes
- `npm run test` - Passes (106 tests, 25 suites)
- `npm run build` - Builds optimized pages successfully
- App functions cleanly at runtime without crashing on null arrays.
