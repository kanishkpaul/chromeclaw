# Phase 2, credential-protection slice

PRs #2 and #3 were merged, in order, into `main`. Their merge commits are `18aa34e` and `144e9e2`.
This slice, p2-01, starts Phase 2 from the merged implementation. It does not close Phase 2:
numbered fresh targets, immutable task permissions, origin/commit gates and the full attack set
remain open. Hand-back continuation belongs to Phase 3.

## What ran

- `pnpm check`: build, typecheck, lint and 25 tests passed. See `check.log`.
- `node packages/browser/tests/credentials.browser.mjs .chromeclaw/p2-final`: 13 grouped browser
  checks passed in Chrome 155.0.8059.80. See `credentials-report.json` and `credentials.log`.
  `pnpm eval:credentials` builds packages and invokes the same regression suite.
- `node apps/cli/dist/index.js eval`: all three original controlled outcomes passed, including
  saving the city through the updated native-setter driver. See `baseline-report.json`.
- Guard mutation: temporarily removed the atomic credential check from the compiled browser
  artifact. The focus-change fixture failed with exit 1. The artifact was restored byte for byte;
  source was not modified. See `guard-mutation.log`. This intentional failure is a negative
  control, not a passing unsafe action in the normal suite.

Reports identify the run IDs; their matching JSONL files are beside them. Synthetic stored
credential markers and the attempted typed value are absent from runtime JSONL. Typed action
text is `[withheld]`, including in callbacks. Refusal is blocked before the callback, not done.
The runtime case uses a neutral title and generic selector so it reaches the driver rather than
passing only because the old policy matched a keyword.

The browser oracle checks the real fields after each refused write. Cases cover password,
current/new-password and OTP with autocomplete token lists, an ARIA-labelled code field, textarea,
open shadow root, focused frame, focus-time type change and node replacement. Characters, paste
shortcuts and keyboard submission are refused; implicit submit is refused before changing a field.
Hidden, covered, transparent, disabled and read-only writes are refused. A normal field still
receives the value and one input/change event pair.

Known credential/framed pages do not produce screenshots. `masked-input.png` shows the ordinary
form-control mask, visually inspected. Its report records the original local artifact path;
the portable copy is next to this document. The safe DOM target summary avoids raw AX field
values. It is not a complete native accessibility-tree implementation.

## Reuse and limits

Adapted Blindfold's credential metadata/read suppression and type/label refusal ideas from
`browser/src/content/extract.ts` and `core/src/credentials/index.ts` at `2f04984`. Autocomplete
matching handles token lists rather than matching the whole attribute. The real-browser checks
verify ChromeClaw's integrated port; the complete Blindfold suite was not run.

No paid model, real local inference server or signed-in site was used. The tests do not establish
React/live-site compatibility, generic PII redaction, visual/canvas secret detection, protection
for deliberately mislabelled custom credential widgets, stale click safety, or safe arbitrary
navigation. Existing selector and task-permission defects remain. This is a reviewed-sized
credential fix, not a declaration that the whole agent is safe for unattended use. Hosted CI
status belongs to the PR and is not inferred from these local artifacts.


## Source entry point regression

The first hosted run failed in `pnpm eval`: tsx preserved a nested function name by inserting
`__name`, which was unavailable when Playwright serialized the function into the page. The
built CLI did not reproduce it. Replaced that nested recursive function with a self-contained
DOM walk, preserving field/label suppression. The page function needs no loader helpers or
application closures. Failed run: GitHub Actions `39024179011`, implementation commit `86a1338`.

After the repair, `pnpm check` passed 25 tests (`source-check.log`), the actual source-run
`pnpm eval` passed three fixtures (`source-eval.log`), the credential suite passed all 13 groups
(`source-credentials.log`, `source-credentials-report.json` and its matching JSONL), and the
built CLI passed three fixtures (`built-eval.log`). Both source and compiled entry points are
required evidence; one does not stand in for the other. The same atomic-guard mutation was
repeated on the repaired artifact and still failed as expected (`source-guard-mutation.log`).
