# Phase 8: live testing

Status: Day 1 pilot recorded. The seven-day `daily-01` gate is not complete. Phase 9 remains
unstarted. A session of automated public-site trials cannot substitute for seven reviewed days
of personal use.

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

The emulator injects the existing OpenAI-compatible adapter at its test seam, with a loopback
HTTP server, dummy bearer key, synthetic usage and declared reservation ceilings. Production
configuration still refuses loopback URLs for hosted providers. This tests the shared wire and
accounting path; it does not establish TLS, vendor authentication, billing, rate limits or hosted
model quality. Mock replies deliberately use frozen labels and carry no model-quality score.

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

Review seven distinct days of bounded TUI use across the three jobs, recording task, scope, model,
outcome, interventions, failure class and regression link. Preserve the user’s synthetic-history
and mock-BYOK choices. Exercise long output, resize, interruption and recovery in the terminal.
Fix observed product defects and rerun their affected checks. Publish model-specific results and
limits from the reports. Only then can Phase 8 be marked complete and Phase 9 begin.
