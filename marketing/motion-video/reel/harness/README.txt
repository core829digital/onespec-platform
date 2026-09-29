Capture harness for the reel (reference copies, not compiled).
Recreate under src/app/c/ (never commit there):
  src/app/c/mv-capture/{page.tsx, client.tsx}      <- ../film/harness/mv-capture-client.tsx.txt is superseded by mv-capture-client.tsx.txt here
  src/app/c/mv-app/[view]/{page,harness}.tsx       <- ../film/harness/*.txt
  src/app/c/mv-app/[view]/fixtures.ts              <- mv-app-fixtures.ts.txt (adds Showroom fixtures)
  src/app/c/mv-app/[view]/calc-bridge.ts           <- calc-bridge.ts.txt (verbatim pure helpers of convex/calculations.ts)
  src/app/c/mv-app/[view]/payload.json             <- node --experimental-strip-types build_payload.ts.txt > payload.json (then dedupe kind+key as seedExtras does)
Run the dev server with NEXT_PUBLIC_CONVEX_URL set to any placeholder, then: node capture_reel.mjs
