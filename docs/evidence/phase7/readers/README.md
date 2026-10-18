# Phase 7 starter: bounded source readers

This `research-01` slice establishes a browser primitive, not a complete research ability.
[The contract](../../../PHASE7.md) lists the remaining Phase 7 work. No model was called,
no personal history was read, and no public-site quality result is claimed. Hosted testing stays
waived. Research and history/web find commands remain unavailable pending integration.

## Results

- `pnpm check`: 71 tests in 18 files; build, strict types and lint pass. [Log](check.log).
- `pnpm eval:readers`: ten independent real-Chrome groups pass in both
  [source](source.json) and [compiled](compiled.json) modes. [Execution log](readers.log).
- Inherited safety matrix: 35 groups pass in [source](safety-source.json) and
  [compiled](safety-compiled.json) modes.
- Inherited page-work matrix: 22 groups pass in [compiled mode](work-safety-compiled.json).

The reader fixture observes five simultaneous source requests and six total pages (including the
unchanged foreground page). The sixth reader produces no server request. An unowned page cannot
borrow admission. Known fixture text is captured without an input's private value. Inline script,
query-bearing image and iframe destinations receive no requests. Duplicate fragment URLs,
unpermitted origins, query URLs, automatic redirects and missing sources are refused. Cancellation
closes only the source tab. The twenty-source allowance does not reset between batches; revocation,
expiry and missing read/navigation authority refuse further admissions.

Server-observed requests are retained in the source/compiled reports. The fixture deliberately
withholds five document responses until all five requests arrive, so successful concurrency is
not inferred from starting five promises. Results come from exact known text, page identities,
counts and request logs, without a model grading its own output.

## Reproduce and limits

Run the commands above with the installed Chrome or Playwright Chromium and disposable profiles.
The scripts clean their fixture server and temporary browser profile. CI runs both reader modes
and uploads their reports, including on failure; CI results are separate from these local runs.
[Manifest](manifest.json) pins the base commit and exact tested source, fixture and evidence hashes.

The initial restricted-shell attempt could not bind its loopback listener; existing HTTP tests
also timed out under that restriction. A subsequent check found missing Node/global imports in
the new fixture; these were corrected. Final recorded runs used permitted loopback/browser access.
These were harness/environment failures, not actual-model research attempts.

Capture is static, bounded and viewport-only. Script-dependent content, arbitrary browser-network
isolation, byte quotas, DNS rebinding, signed-in sites, research prompt attacks, synthesis support,
actual local/BYOK model performance, terminal research UX and held-out quality remain unverified.
The foreground runtime never opts into readers in this slice. No new dependencies are introduced.
