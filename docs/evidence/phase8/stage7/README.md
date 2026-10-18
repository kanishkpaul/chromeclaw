# Stage 7: final regression and retest

2026-10-18. Parent: Stage 6, PR #19, commit `00b60b7`. The [frozen plan](../../../../packages/agent/tests/fixtures/live-stage7.json)
was committed at `899dee9` before any retest. It reuses every earlier manifest's labels and
criteria unchanged. Every retested task was already observed, so nothing here is held-out
evidence. Phase 9 has not started.

Only Finder and Claude were in the foreground; no Chrome, model or development job ran, and
81% of 16 GB memory was free. Nothing needed stopping. The cached Qwen3-VL-8B-Instruct Q4_K_M
(SHA-256 verified) ran on offline llama-server at 16,384 context, temperature 0. It was stopped
by exact PID, and no Chrome or model process remained. No hosted inference, key, download or
spend occurred. See [environment](environment.json).

## Product defects

| ID | Found | Defect | Status | Regression |
|---|---|---|---|---|
| D1 | Stage 1 | Blocked subresources failed readable pages | Fixed `b86c5f6` | live-regressions, source and compiled |
| D2 | Stage 3 | Duplicate ranked URLs accepted | Fixed `4da27c5` | live-research-regression |
| D3 | Stage 6 | Cut passage reported complete | Fixed `00b60b7` | live-regressions |
| D4 | Stage 6 | Inline link split a sentence into unquotable passages | Fixed `00b60b7`, amended here | live-regressions |
| D5 | Stage 6 | `<A NAME=14>` link named by its fragment | Fixed `00b60b7` | live-regressions |
| D6 | Stages 2, 3, 6 | False "Browser cleanup failed." on long tasks | **Root-caused and fixed here** | [live-cleanup](../../../../packages/agent/tests/live-cleanup.browser.mjs) |
| D7 | Stage 7 retest | D4's merge folded RFC `<pre>` titles into large passages | **Fixed here** | live-regressions |

**D6.** Branded Chrome starts GoogleUpdater helpers during a task. The driver disconnects in
about 50 ms, but Chrome's main process waits for the helpers, which outlasted the single
5-second deadline. A loopback reproduction with a 35-second scripted planner [failed 3/3](cleanup-before/source.log)
with the updater running. A first fix that returned at disconnect removed the warning. It then
broke three suites with `ENOTEMPTY`, because Chrome was still writing the profile. It is kept in
[rejected-disconnect-only-fix](rejected-disconnect-only-fix/). The final fix bounds disconnect
at 5 seconds and process exit at 45 seconds, and records the failing bound. It passes 3/3 [from source](cleanup-after-source.log),
[compiled](cleanup-after-built.log) and [again at the end](cleanup-final-built.log), with the
updater running in every trial. Retests then recorded zero cleanup failures in 167 runs. Cost: a long task can report completion 10–12 seconds later when the updater wakes.

**D7.** Round-1 retest dropped scripted assisted research from 6/6 to 5/6. Research claims must
equal a whole passage. The RFC 2606 title had become part of an 1,853-character `<pre>` block,
and a dropped newline had also joined "June 1999" to the next section. A controlled check
[failed before the change](regression-before-preformatted.log). Preformatted nodes now keep one
passage each, while prose still merges across links. Scripted research is back to 6/6 in round 2.
See D-031 in [DECISIONS.md](../../../DECISIONS.md).

After the final change, `pnpm check` (79 tests) and [nineteen gates](gates/) pass. That covers
live regressions (9/9 in both modes) and the credentials, safety, runtime, session, ask, find,
labelled-find, readers, discovery, discovery-safety, work-safety, TUI, work and model suites.
Safety, runtime and model suites also pass compiled.

## Retest outcomes

Both full rounds are retained: [round 1](comparison-round1.json) ran before the D7 fix and
[round 2](comparison.json) after it, with raw reports under `retests-round1/` and `retests/`.
Originals are each stage's last recorded attempt.

| Lane | Original | Round 1 | Round 2 |
|---|---:|---:|---:|
| Scripted Day 1, without search cases | 6/10 | 6/10 | 6/10 |
| Scripted Stage 2 | 8/8 | 8/8 | 8/8 |
| Scripted assisted research | 6/6 | 5/6 (D7) | 6/6 |
| Scripted recovery / BYOK protocol | 4/4 · 17/17 | 4/4 · 17/17 | 4/4 · 17/17 |
| Scripted Stage 6 terminal | 2/3 | 2/3 | 2/3 after harness fix |
| Local Day 1, without search cases | 4/10 at 8K | 4/10 | 4/10 |
| Local Stage 2 | 5/8 at 8K | 6/8 | 6/8 |
| Local assisted research | 3/6 | 5/6 | 3/6 |
| Local recovery / Stage 6 terminal | 2/2 · 4/4 | 2/2 · 4/4 | 2/2 · 4/4 |
| Local terminal Day 2 / Stage 3 / Stage 4 | 2/2 · 1/2 · 3/3 | same | same |

Day 1 and Stage 2 originals ran at 8K context. Their retest gains (Python and IANA reads) are
attributable to 16K context as much as to the capture fixes. Day 1's research and web cases were
not rerun because public search previously met an access barrier, so their recorded misses stand.
Terminal resize now delivers SIGWINCH; the earlier Stage 2–4 recordings did not.

## Model-specific results and limits

**Qwen3-VL 8B Q4_K_M, local.** Reliable here:
- exact short reads on httpbin, IANA, Python and CERN;
- absence handed back as uncertain;
- the CERN find;
- pause, cancel and reopen recovery;
- one approved loopback save;
- terminal inspection.

Not reliable:
- **Ordinary edits on public forms.** It repeats an already-verified write until recovery stops it (Day 1 retest, Stage 2 in every round).
- **Research positives.** 0/3, then 2/3, then 0/3 across the original and two retest rounds at temperature 0, with timeouts and invalid claim references.
- **Large pages.** MDN timed out; Stage 2's IANA find chose an unavailable target.

None of this generalizes beyond these few observed tasks.

**Dummy BYOK.** Protocol, accounting, retry and refusal mechanics pass 17/17 again. It says
nothing about vendor authentication, TLS, billing or hosted model quality.

## Open limits, not fixed here

- **Find on mutating pages.** Any DOM mutation after capture invalidates a snapshot (D-015).
  `nodejs.org/api` mutates after load, so its find fails as stale in scripted and local lanes alike.
  Relaxing this for read-only find is a safety-relevant design choice left to Kanishk.
- **Long passages.** One passage holds 2,000 characters; omission is now reported to the model
  and research readers, but the TUI does not show it beside an answer.
- **Site drift and barriers.** Recorded Day 1 drift, viewport-absence uncertainty and the public
  search barrier remain limitations, not passes.

## Harness and process mistakes retained

- The plan commit's chained `pnpm check` [failed on an uncommitted lint error](check-freeze-worktree-lint-failure.log)
  in `live-cleanup.browser.mjs`, and the commit still ran. The [committed tree alone](check-freeze-committed-tree.log)
  was then verified to pass; that verification came after the commit.
- Round 2's scripted deny case sent its second task when the durable completion appeared, before
  the TUI settled; the TUI correctly refused it. The harness now waits for the result row, and the
  [rerun](retests/scripted-stage6-harness-fixed/report.json) restored 2/3.
- `stage6.pty.py` gained an opt-in Playwright log for diagnosis; it never affects scoring.

PR #19's GitGuardian alert flags a SHA-256 of `gates/credentials.log` in the Stage 6 manifest.
The value is the file's digest and contains no key; Kanishk can mark it a false positive.

## Reproduce

```sh
pnpm eval:live-cleanup
pnpm eval:live-regressions
python3 docs/evidence/phase8/stage7/compare.py
```

The retest commands are listed in the frozen plan and in [commands](commands.json). `manifest.json` pins source and evidence bytes.
