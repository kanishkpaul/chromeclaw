# Stage 4: interruption and recovery

2026-10-18. Parent: Stage 3, PR #16, commit `4da27c5`. This slice changes test harnesses and
evidence, with no production behavior change. Stages 5–7 and Phase 9 remain unstarted.

The [frozen manifest](../../../../packages/agent/tests/fixtures/live-stage4.json) declares four
recovery cases. Public tasks read httpbin's complete robots.txt passage or type synthetic text
into its demonstration form without submitting. Disposable profiles contain no personal history
or login. Only Finder and Codex were foreground before testing; no unrelated workload needed
termination. System memory reported 77% available. macOS services and Codex remained running.

| Lane | Result | What it establishes |
|---|---|---|
| [Dummy BYOK](emulated/report.json) | 4/4 | Pause/cancel after proposals; reopen without dispatch; retained permissions, steps, expiry and spend; no unsent-edit replay |
| [Actual local](actual-local/report.json) | 2/2 | The interrupted public read resumes to an exact runtime-verified citation after both pause and cancellation |
| [Actual-local terminal](terminal/report.json) | 3/3 | Recovery/read, cancellation after request admission, inspection/resize/clean exit |
| [Source lifecycle](lifecycle-source/report.json), [compiled lifecycle](lifecycle-built/report.json) | 30/30 each | Controlled cancellation, stale approval, corrupt-tail/process recovery, cleanup failures and bounded human judgment |

The local model is cached Qwen3-VL-8B-Instruct Q4_K_M, SHA-256
`67d1659bfe71b89d50b45a4ad1a9e5b997e5bb16ce5da66a6a6167abd569e9e2`.
llama-server runs offline on loopback with a 16,384-token context, one slot, reasoning off and
temperature 0. Requests allow 1,200 output tokens and 90 seconds, within a five-minute runtime
task budget. The terminal uses a three-minute task budget and four steps. No weights were
downloaded. Real hosted requests, keys, spending, activation, posting and credential entry were
excluded. Dummy-provider reservations are synthetic; actual hosted spend is zero.

## Trace review

Each direct read first obtains a model proposal, then pauses or cancels before accepting it.
Reopen uses a fresh browser capture and pending ID. Passing different origins, write permission,
step count, timeout and spend allowance into reopen does not replace the saved permission
envelope. Reopen alone makes no model request or act. Interactive continuation rejects an old
pending ID, accepts the current ID once and refuses a duplicate. Only a fresh, cited finish
completes the resumed read. Local runs made four inference attempts total, two per case.

The exhausted dummy budget retains its first 0.001 reservation after reopening. A resumed send
is refused, the run fails explicitly, and the server sees exactly one request. This is dispatch
accounting under declared prices, not vendor billing validation.

The unsent-edit case independently checks the synthetic input value and original URL in a
trusted browser callback, then pauses. Reopening emits no additional type action. Its masked
screenshot and JSONL are retained. Reopen reloads the last permitted URL; it does not guarantee
unsaved DOM state survives. No activation or external side effect was authorized. Controlled
lifecycle cases separately check exact approvals and uncertain in-flight effects; no rollback
guarantee follows from cancellation.

## Original engineering failures retained

- [Initial emulator attempt](initial-harness-label-failure/report.json): three checks passed;
  the edit setup failed because the mock expected `Customer name` while the page offered
  `Customer name:`. The provider returned HTTP 500 before typing. The corrected harness accepts
  the observed label prefix and independently checks the DOM value. This was a harness defect.
- [Extra emulator run](extra-emulator-omitted-flag/report.json): local environment variables
  were supplied without `--actual-local`. It remained `actualLocal:false`, used dummy replies,
  and is excluded from local scores. The harness now refuses that ambiguous invocation.
- [First terminal recording](terminal-initial-harness-order-failure/report.json): recovery
  completed and the second request stopped, but positional slicing across filesystem-ordered
  JSONL files missed the new run's final record. The harness now selects new run IDs instead.
  The full initial recording and subsequent retest remain separate.
- [Second terminal attempt](terminal-initial-navigation-assertion-failure/report.json): recovery
  and cancellation worked, but the assertion counted the permitted initial page navigation as
  a post-cancellation act. Raw event ordering shows navigation before the model crossing and no
  proposal or act after it. The final harness asserts from that crossing onward; all three
  checks pass in the [final recording](terminal/terminal.cast). Neither correction changes the
  model answer criterion or the cancellation boundary.
- [Sandboxed check](check.log): fixture listeners failed with `listen EPERM`. The required
  check was rerun with listener permission and passed all 79 tests. No timeout or assertion was
  relaxed to turn this environmental failure into a pass.

No production defect was established in this stage. These are narrow, repeated extraction and
recovery tasks on a previously used site; they are development follow-ups, not new held-out
research-quality evidence. The local score says nothing about broader reasoning, signed-in
applications, arbitrary crash timing or private browser sessions. Earlier stage model misses
and public-search limitations remain unchanged. `manifest.json` pins source and evidence bytes.
Final inspection confirmed the owned model server stopped and no disposable Chrome/model process
remained. See [environment](environment.json) and [trace review](review.json).

## Reproduce

```sh
pnpm eval:live-recovery
# With CHROMECLAW_TEST_LOCAL_URL and CHROMECLAW_TEST_LOCAL_MODEL set explicitly:
node packages/agent/tests/live-recovery.browser.mjs --actual-local
python3 apps/cli/tests/live.pty.py --stage4
```

The actual-local command never chooses a hosted fallback. Public-site runs stay outside CI;
the existing lifecycle suite supplies controlled regression coverage.
