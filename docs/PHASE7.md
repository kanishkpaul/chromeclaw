# Phase 7: research and remaining find modes

Phase 7 has started. This first `research-01` slice supplies the background source-reader boundary.
It does not enable research, web finding or personal-history access in the terminal yet.
Hosted inference remains waived and unverified. Phase 8 live testing and Phase 9 presentation
remain separate gates.

## Delivery order and acceptance

1. Build bounded source readers without weakening the existing active-page action boundary.
   Record five simultaneous readers, source failure, cancellation, ownership and budget stops.
2. Add engine-tab search through trusted intent-derived queries. Compare API backend candidates
   before selecting one; application API requests must use egress. CAPTCHA hands back.
3. Compose research planning, URL deduplication, readers and claim/passage references through the
   existing runtime and terminal. Show hosts, progress, budgets and inspectable sources. Reference
   validity and semantic support remain separate results. Run twenty controlled questions per
   tested model and poisoned-source regressions; retain failures and raw evidence.
4. Reuse the injected search/reader contracts for web finding. Verify canonical target pages;
   snippets alone do not establish a match. Measure top-one/top-three and negative errors.
5. Measure bounded history/bookmark access before choosing an integration. No live personal
   profile database reads. If a bridge is required, document the measured gap, permission and
   transport before implementation. Search only explicit time/title/URL scope, filter locally,
   require candidate-metadata approval for hosted use, and support revocation and forgetting.
   Seeded retrieval and twenty personal recollections precede any index decision.

The remaining acceptance criteria in [J123_BUILD_PLAN.md](J123_BUILD_PLAN.md) are still open.
This slice does not claim model quality, supported synthesis, a search backend or an ability
registry. No new user command is advertised until its end-to-end path exists.

## Source-reader contract

The browser adapter creates at most five simultaneous source tabs, separately from the task's
foreground tab. Admission compares the exact Page returned by `newPage`; a racing popup cannot
borrow it. The caller composes `createSourceReaders` with `guardNavigation` before reading.
Ordinary callers omit this optional admission and keep the existing active-page-only behavior.

The original frozen origin/read/navigation/expiry permissions remain mandatory. Each reader
admits one data-free HTTP(S) main-document URL and same-origin static assets. Query URLs,
redirects, subframes, script/network requests and automatic secondary navigation are refused.
Inline JavaScript is disabled through CDP before navigation. Each reader pool admits at most twenty unique
fragment-normalized URLs, including failed attempts. The sixth concurrent request is refused;
the orchestration layer will schedule subsequent work when capacity returns. After tab creation, each reader has a
fifteen-second navigation/capture deadline bounded by task expiry. Abort and pool closure close only reader-owned
tabs; they do not close or select the foreground tab.

The existing visible-passage capture excludes form values and returns snapshot-bound references,
with omitted/unreadable-region flags. It remains bounded and viewport-only, not a full-document
reader. A static page can still contain instructions as text; later synthesis must treat those
as untrusted data. Script-dependent pages may be incomplete. The task context's cookies remain
shared with readers; no new personal profile access is introduced. GET requests can have server
side effects, DNS rebinding and arbitrary browser/network isolation are not established, and
response bytes are subject to the existing navigation transport rather than a new byte quota.

## Verification

Run `pnpm eval:readers` for source and compiled real-Chrome fixtures, then `pnpm check`.
The fixture scores server-observed requests, known page text, tab counts and foreground identity.
It reports ten groups independently of any planner. Existing safety regressions must also
pass because the shared navigation guard changes. See [starter evidence](evidence/phase7/readers/README.md).
