# Phase 8: live testing

Status: Stages 1–4 recorded; Stages 5–7 pending. Kanishk clarified on 2026-10-18 that Days 1–7 mean
seven stages of live testing, not seven calendar days. Stages can run back-to-back. Live testing
means operating ChromeClaw ourselves on real tasks and reviewing the resulting evidence.
Phase 9 remains unstarted. D-028 supersedes the old calendar-day gate, including historical
Day 1 report language; archived evidence and frozen task bytes remain unchanged.

## Authorized scope

Before testing, inventory running apps and workloads, close unnecessary user apps and stop
unneeded model/development jobs. Preserve macOS services and the Codex session doing the testing.
Use graceful termination; do not discard unsaved work. Record the observed cleanup and memory
state without claiming the machine has no operating-system background work.

Kanishk explicitly requested dummy data and an emulated provider for BYOK testing. No real hosted
inference, real key, payment or provider-account operation is authorized. Report wire-protocol and
accounting mechanics separately from actual model quality. The local profile uses already cached
weights and an explicit loopback server; there is no model download or hosted fallback.

Day 1 uses anonymous public pages in disposable Chrome profiles. The only edit is synthetic text
in httpbin's demonstration form, left unsubmitted. Control activation, posting, purchasing, login,
credential entry and personal-profile access are excluded. Discovery has trusted fixed queries and
fixed source origins; rejected results do not authorize more origins or a different search engine.
History trials use a deliberately constructed two-entry JSON snapshot, not personal history.

## Repeatable commands

```sh
pnpm eval:live                    # public sites, dummy BYOK wire emulator
CHROMECLAW_TEST_LOCAL_URL=http://127.0.0.1:18184/v1 \
CHROMECLAW_TEST_LOCAL_MODEL=chromeclaw-qwen3vl pnpm eval:live-local
pnpm eval:live-regressions        # controlled failure reproduction, source and compiled
# With the same explicit local endpoint/model variables:
pnpm eval:live-terminal           # actual local inference through a recorded PTY
```

The live commands intentionally fail when any frozen case misses. Do not change labels to make
an attempt pass. `packages/agent/tests/fixtures/live-day1.json` is the original frozen manifest;
reports retain its SHA-256. `--cases=id,id` on the underlying script selects a documented subset.
Each run saves raw JSONL and `report.json` beneath `.chromeclaw/phase8-live`. Profiles are removed
after testing; evidence stays. Live-site commands are manual, not nondeterministic CI gates.
CI runs the controlled regression and archives its evidence. [Day 1 evidence](evidence/phase8/day1/README.md)
retains original misses and separately labelled development follow-ups.

Stage 2 uses `node packages/agent/tests/live.browser.mjs --day2` for dummy BYOK, appending
`--actual-local` with the explicit local endpoint/model variables for real inference.
`python3 apps/cli/tests/live.pty.py --day2` records the actual-local terminal task. The legacy
`day2` filenames/flags identify the second stage, not elapsed days. Its frozen manifest retains
pre-clarification calendar metadata for provenance; D-028 supersedes those fields.
See [Stage 2 evidence](evidence/phase8/stage2/README.md).

Stage 3 uses `pnpm eval:live-research` for dummy BYOK with a controlled candidate index and
real public sources. Append `--actual-local` with the explicit endpoint/model variables for
actual inference. The separate `--actual-local --public-probe` lane issues one fixed public
search query; a challenge ends it without a retry or engine switch. Assisted retrieval is
predeclared separately and cannot count as a successful public search. The actual-local TUI
workflow is `python3 apps/cli/tests/live.pty.py --stage3` with those same model variables.
See [Stage 3 evidence](evidence/phase8/stage3/README.md) for original misses, a duplicate-ranked-URL
reproduction/fix and a separately labelled real-source regression check.

The emulator injects the existing OpenAI-compatible adapter at its test seam, with a loopback
HTTP server, dummy bearer key, synthetic usage and declared reservation ceilings. Production
configuration still refuses loopback URLs for hosted providers. This tests the shared wire and
accounting path; it does not establish TLS, vendor authentication, billing, rate limits or hosted
model quality. Mock replies deliberately use frozen labels and carry no model-quality score.

Stage 4 uses `pnpm eval:live-recovery` for dummy-provider recovery on actual public pages.
Run `node packages/agent/tests/live-recovery.browser.mjs --actual-local` with the explicit local
endpoint/model variables for actual inference. An endpoint without the flag refuses rather than
silently counting an emulator run. `python3 apps/cli/tests/live.pty.py --stage4` records terminal
pause, cancel, reopen, resume and cancellation during a second local request. Reopen reloads a
permitted page and pauses; it does not promise to preserve unsaved form edits or replay them.
See [Stage 4 evidence](evidence/phase8/stage4/README.md), including original harness failures.

## Scoring and review

Read trials require a runtime-verified citation and the frozen expected text. Find trials compare
ranked target destinations with frozen URL labels; absence stays uncertain. The unsent edit has
an independent DOM value and original-URL check. Research requires the normal complete-passage
claim verifier; web/history results compare exact labelled URLs. Literal URL labels can become
outdated, and citation resolution does not prove semantic support. Review traces alongside scores.

Record per-task status, latency, steps, reported token usage, reservations, interventions, source
failures and actual hosted spend (zero here). A fresh Chrome profile per task is not a paired
cold/warm inference benchmark. Distinguish first-request startup from subsequent requests and
measure true paired cold/warm performance before claiming it. Synthetic history has no inference
and must not inflate the actual-model denominator. No live request-audit or universal safety claim
follows from the recorded absence of control activations.

Every observed product defect gets a controlled reproduction before its fix. Retain the failed
live attempt, failing regression, fix, affected regression results and a separate live retest.
Classify site drift, scope refusals, capture/driver defects, model misses and harness mistakes
separately. A task used to develop a fix or revised label is no longer held out.

## Remaining gate

| Stage | Real task or validation | Acceptance evidence |
|---|---|---|
| 1 | Baseline live tasks and safety boundaries | Original public-site outcomes, traces, defect reproduction/fix and preserved misses; recorded |
| 2 | Bounded reading, finding, ordinary editing and selected-history lookup | New frozen public tasks, actual local inference, dummy BYOK separately, unsent edit checked against DOM, recorded TUI use |
| 3 | Research and web retrieval | Fixed trusted queries, actual source citations, cross-source review, unavailable sources/access-barrier hand-back; never bypass a barrier to obtain a passing score |
| 4 | Interruptions and recovery | Pause/cancel/reopen during real browser tasks, original permissions and budgets retained, no replayed side effects |
| 5 | BYOK protocol and failure handling | Dummy credentials/provider with real browser tasks; malformed replies, retries, usage, cancellation and no hosted fallback; no model-quality claim |
| 6 | Terminal workflows | End-to-end tasks through the TUI, sources/trace inspection, long output, resize and explicit control; recordings and independent outcomes |
| 7 | Final regression and retest | Each observed product defect reproduced before its fix, affected gates rerun, live retests, model-specific results/limits and process cleanup |

Complete and review the seven stages with task, scope, model, outcome, interventions, failure
classification and regression links. Synthetic history and mock BYOK remain explicit owner
choices. A model miss or live-site barrier stays a measured limitation, never a passing capability
claim. Fix confirmed product defects and rerun affected gates. Calendar time is not a completion
criterion. Phase 9 starts only after this seven-stage evidence gate is satisfied.
