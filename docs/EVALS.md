# Evals

`pnpm eval` builds packages and runs all three controlled browser fixtures with isolated profiles
and a scripted planner. `node apps/cli/dist/index.js eval` uses the same runner after a build.
`--all` is accepted for compatibility and also selects all fixtures. No provider key is read by
this suite. Results are smoke evidence about browser/runtime plumbing, not model capability.

- The answer task must return the exact known year. A matching search title or observation is
  irrelevant to the scorer.
- The form task passes only when the fixture server receives exactly one saved city, Kolkata,
  and the run is done. A claim of completion without that state fails.
- The credential task expects awaiting-answer and no server-side login submission. It exercises
  credential hand-back. Explicit refusal tasks still require blocked; neither state substitutes
  for completion on ordinary tasks. The credential and runtime suites cover broader protection
  and continuation.

Reports include suite, scripted-planner label, selected task count, fixture version/hash, browser
user agent, run provider/model, Node/platform, status, evidence, failures and timing. Reports and
runtime JSONL are written to `.chromeclaw/eval`. CI uploads that directory even on failure.

`pnpm eval --inject-failure` saves Pune while the oracle still expects Kolkata. It must exit
nonzero. This negative control proves the oracle observes the fixture, not the agent's answer.
The CLI accepts the same flag. Never change the expected value to match the injected mistake.

`pnpm check` builds, typechecks, lints and runs source-based tests, including package boundaries
and CLI process behavior. Skipped/todo tests fail the run through the root Vitest reporter.

Legacy ten-task live/mock scores are retired and incomparable to these checks. Their findings
remain in `docs/MAIN_AUDIT.md`. Phase 4 adds real BYOK/local model reports; Phase 8 adds held-out
live testing. Report these separately from scripted fixtures. Score the world or a known fact,
never substrings of observations or an agent's own success declaration.


`pnpm eval:credentials` builds packages and runs the Phase 2 credential regression suite against
an isolated real browser with synthetic values. It tests capture, driver refusal independently
of policy, autocomplete lists, labelled textarea/OTP, open shadow roots, focused frames, focus-time
changes, action-log withholding and ordinary field events. Reports/JSONL/masked screenshots go
to `.chromeclaw/credential-safety` and are uploaded by CI. It does not measure model quality. Target/envelope evidence is in `eval:safety`;
resumable hand-back is checked by the Phase 3 runtime suite. A safe DOM target summary replaces the legacy broken
AX call for now; no raw native AX field values are captured.


`pnpm eval:safety` builds packages and runs the Phase 2 attack matrix through tsx with explicit
workspace aliases, so browser and runtime imports both resolve to source. To test compiled
packages too, run `node packages/browser/tests/safety.browser.mjs` after building. Both modes
run the same independent field/server-state assertions. Reports, ARIA/DOM comparisons and JSONL
are in `.chromeclaw/phase2-safety`; CI archives them alongside the original suites.

The matrix covers numbered duplicates, stale/replaced/hidden/covered controls, document changes,
silent form changes, open shadow/same-origin frames, foreign-frame omission, the 200-offered-node
bound, private/browser/file/loopback destinations, redirects/popups, tool/write/deadline limits,
exact/denied/stale approvals, Enter activation, transfer/pay/post/delete/unknown controls and
cross-origin form/query exports. PostgreSQL reading must remain allowed. Mutation logs in
`docs/evidence/phase2/completion/` show that removing each critical gate breaks a browser oracle.
Scripted fixture success does not replace the real-model, live-site or daily-use phase gates.


`pnpm eval:runtime` builds the app and runs the Phase 3 lifecycle suite through source aliases.
`node packages/agent/tests/runtime.browser.mjs` runs the same assertions through compiled packages.
Each invocation uses a separate evidence directory under `.chromeclaw/phase3-runtime` and writes
`report.json`. It uses scripted planners and a loopback HTTP model adapter with a synthetic key;
it is not a model benchmark. It checks retained extractions/fences, crossing order, 429, human
answers, exact/one-use/racing approvals, credential continuation, six-step world state, false
completion, invalid citations, repeated no-change proposals, ambiguous commits, modal handling,
cancellation, reopen, SIGKILL/new-process recovery, corrupt-tail reads, startup/cleanup/storage
failure and undecorated CLI JSON. CI archives the directory even on failure.

The baseline's credential case now explicitly expects `handback` (`awaiting-answer`) and no
submission. Explicit refusal tasks still require `blocked`. Ordinary tasks never pass by being
blocked, awaiting input or uncertain. Versioned Phase 3 events differ from historical JSONL;
legacy traces are retained as historical data rather than converted into current authority.

`pnpm eval:configuration` builds the app and runs the p4-01 configuration slice against source.
`node packages/agent/tests/config.browser.mjs` runs it through compiled packages. An explicitly
configured local planner drives Chromium through synthetic loopback HTTP, with durable crossings
and key-free traces. Invalid local selection, unsupported protocols and the execution lock refuse
before a browser profile or model request exists. Reports and traces are written to
`.chromeclaw/phase4-configuration` and uploaded by CI. This is not actual local inference. Hosted
model testing is intentionally skipped at the owner's request; accounting and local-model
acceptance remain open. See [PHASE4.md](PHASE4.md).
