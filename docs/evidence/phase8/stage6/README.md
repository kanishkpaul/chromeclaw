# Stage 6: terminal workflows

2026-10-18. Parent: Stage 5, PR #18, commit `60165eb`. The [frozen manifest](../../../../packages/agent/tests/fixtures/live-stage6.json)
was committed at `dbb8681` before any case ran. Stage 7 and Phase 9 remain unstarted.

Every case drives the compiled TUI (`apps/cli/dist/index.js tui`) through a real PTY with
[`stage6.pty.py`](../../../../apps/cli/tests/stage6.pty.py), on headed Chrome with disposable
profiles. Pending IDs come from durable run state, never from terminal text. Before testing,
only Finder and Claude were in the foreground, no Chrome, model or development workload ran,
and 79% of 16 GB memory was free; nothing unrelated needed stopping. See [environment](environment.json).

## Outcomes

| Lane | Attempt | Result | What it establishes |
|---|---|---:|---|
| Scripted | [initial](scripted-initial-harness-failures/report.json) | 1/3 | Two harness mistakes plus one product defect, below |
| Scripted | [final](scripted/report.json), [retest after fixes](scripted-retest/report.json) | 2/3 each | Approval card, wrong-ID refusal, Enter/Esc denial, compose/discard/send, Ctrl-C, EOF; long output fails on the capture bound |
| Actual local | [initial](actual-local-initial/report.json) | 1/4 | Correct save; ask and find exposed two capture defects; inspection not exercised |
| Actual local | [retest after fixes](actual-local-retest/report.json) | 4/4 | Cited ask, source/passage/open/trace inspection, find and one approved save |

Scripted replies come from a loopback emulator selected as an explicit local endpoint. They
measure terminal mechanics, not model quality. The actual lane uses cached Qwen3-VL-8B-Instruct
Q4_K_M (SHA-256 `67d1659b…e9e2`, verified) on offline llama-server, 16,384 context, temperature 0.
No hosted inference, key, download or spend occurred. The owned server was stopped by exact PID.

## Product defects, reproduced before fixing

Each defect failed a controlled loopback check in
[`live-regressions.browser.mjs`](../../../../packages/agent/tests/live-regressions.browser.mjs)
before its fix ([omission](regression-before/omission-source.log), [structure](regression-before/structure-source.log)).
[D-030](../../../DECISIONS.md) records the change and rejected alternatives.

1. **Cut passages were reported complete.** One text node over 2,000 characters was truncated
   while `omittedPassages` stayed false. The model prompt and research readers rely on that flag.
   Found by the scripted httpbin Moby-Dick case; fixed in `browser/reading.ts`.
2. **A sentence with an inline link became unquotable.** Capture produced one passage per text
   node, so CERN's sentence split around `<A>hypermedia</A>`. The local model's answer text was
   exactly right, but no single passage could support it, so the run ended `uncertain`. Text
   nodes now merge within their block-level ancestor. Ordinary whitespace collapses, `pre*` text stays exact.
3. **Legacy anchors were named by their fragment.** `<A NAME=14 HREF="People.html">People</A>`
   was offered as `14`. The model still picked the right destination, but the frozen name label
   failed. `placeholder`/`name` now label only form fields (`browser/credentials.ts`).

After the fixes, all eight regression checks pass from source and compiled code, and so do
`pnpm check` (79 tests) and fourteen capture-dependent gates: credentials, safety, runtime, ask,
find, labelled find, readers, discovery, discovery safety, work safety, TUI, work, models and
live regressions. Safety, runtime and model suites also pass compiled. See [gates](gates/)
and the earlier [omission-only gate run](gates-omission-fix-only/). The live retest reached 4/4.
The CERN ask and find tasks were used to confirm the fixes, so they are no longer held out.
A last correction stopped whitespace-only text from consuming the capture budget. After it,
`pnpm check` and the live-regression, ask, readers, discovery, find and credential gates were
rerun and passed. The remaining gate logs and both live retests predate that one-line change.

## Limits and open findings

- **Long output.** The terminal reproduces the durable answer exactly at 100 columns and keeps
  `/source 1` complete (4,803 characters, no silent truncation). The frozen criterion still fails:
  one passage holds at most 2,000 characters, so a 3,566-character paragraph cannot be quoted
  whole. Capture now reports the omission; the TUI does not yet surface it beside the answer.
- **Resize.** Signalled resizing to 48 columns redraws the narrow status bar and wraps rows.
  `TIOCSWINSZ` without SIGWINCH never reached Node (rows stayed 95 wide). The Stage 2–4 harnesses
  resized that way, so their "resize" checks did not exercise a real resize. Their other results stand.
- **Browser cleanup warning.** Seven of nine actual-local TUI runs recorded "Browser cleanup
  failed." exactly 5 s after the final step. Run status, answers and server state were unaffected
  and no owned Chrome remained. It never occurred in eleven scripted TUI runs, and four direct
  runtime runs on the same page closed in under 80 ms. A [diagnostic
  replay](actual-local-cleanup-diagnostic/) did not isolate the cause because the runtime discards
  the close error. Root cause and fix belong to Stage 7.
- **Scope.** Public-site submit proposals were only refused, never approved. The approved save
  used a harness loopback form with synthetic data and a server-side oracle. Before the run, the
  operator policy fixed approval as one `Save note` click after a field write. These are four
  small tasks. They do not establish broad local-model reliability; earlier stages' misses stand.

Harness mistakes in the initial scripted attempt: the deny case assumed a denial lets the run
continue (PHASE3 says denial stops it), and it counted the initial `about:blank` observation as
navigation. The narrow-status regex also ignored prompt residue. Corrections changed the harness
flow and parsing, not any frozen label or criterion. [Review](review.json) classifies every attempt.

## Reproduce

```sh
pnpm eval:live-terminal-stage6
# With CHROMECLAW_TEST_LOCAL_URL and CHROMECLAW_TEST_LOCAL_MODEL set explicitly:
python3 apps/cli/tests/stage6.pty.py --actual-local
pnpm eval:live-regressions
```

The harness refuses local endpoint variables without `--actual-local`. `manifest.json` pins source and evidence bytes.
