# Stage 3: research, retrieval and evidence quality

2026-10-18. Parent: Stage 2, PR #15, commit `eee18ca1a4af0f108cbc101e82f2b7186e1e51b8`.
Stage 3 was run through the actual browser runtime and compiled TUI. The seven-stage live-testing
plan has no calendar wait. Stages 4–7 and Phase 9 remain unstarted.

## What ran

The [frozen manifest](../../../../packages/agent/tests/fixtures/live-stage3.json) declared both
lanes before execution. The public lane made exactly one trusted DuckDuckGo HTML query for the
IANA example-domain explanation. The independent assisted lane used a controlled loopback
candidate index and actual public pages from IANA, RFC Editor and httpbin. It exercised two-source
inventories, an RFC URL, unavailable/redirected candidates and an out-of-scope candidate. Candidate
snippets deliberately contained an incorrect marker and were never admitted as source evidence.

**Assisted retrieval is not live-search quality.** Its URLs were deliberately preselected. It
was not an engine switch or an automatic fallback after the public challenge. Public-source
reads, original permissions, runtime citation checks and the final local-model proposals were
real; candidate discovery was controlled. The source-inventory questions are narrow extraction
tasks, not evidence of broad research reasoning. IANA/httpbin pages overlap earlier stages, and
the separate TUI workflow is a development follow-up rather than an additional held-out task.

Before testing, inventory found only Finder and ChatGPT/Codex in the foreground, no unrelated
browser/model/development workload and 80% memory free. No unnecessary app needed closing.
macOS services and the test session remained. Cached Qwen3-VL 8B ran offline with a predeclared
16K context, temperature 0, one slot, reasoning off and a 90-second request timeout. Runtime
output was bounded to 1,600 tokens; the TUI used 1,200. No model download, real hosted call/key,
posting, credential entry, personal profile or control activation was used. See [environment](environment.json).

## Original results, preserved

| Lane/profile | Outcome | Interpretation |
|---|---|---|
| [Public search, local profile](public-search/report.json) | 0/1 capability; safe barrier hand-back | Challenge refused; **zero model attempts**, no retry, solver or engine fallback |
| [Assisted sources, dummy BYOK](emulated/report.json) | 6/6 | Three labelled positive mechanics checks and three zero-inference negative checks |
| [Assisted sources, actual local](actual-local/report.json) | 0/3 positive; 3/3 negative | Model synthesis failed the frozen criteria; all negatives handed back without inference |
| [Actual-local TUI](terminal/report.json) | 0/1 research; 1/1 terminal inspection/exit | Research remained uncertain; sources/trace, resize and clean exit worked |

Mock replies used dummy credentials, synthetic usage and frozen labels. Their scores cannot be
model-quality evidence. Simulated reservations are separate from actual hosted spending, which
was zero. Actual local outcomes are not rescued by counting the three no-inference negatives.

Trace review found:

- The source-title task returned IANA's navigation label **Domains** rather than its **Example
  Domains** heading. Both references resolved, but the independently frozen heading criterion
  failed. Citation resolution did not establish that the requested title was selected.
- The RFC task repeated the same canonical URL three times and supplied a quote that did not
  resolve to its named passage. The original runtime therefore refused completion. This was not
  a successful retrieval merely because the URL string was correct.
- The HTTP inventory returned valid captured extracts but inserted an extra blank line rather
  than exactly joining claim texts with one newline, violating the declared completion contract.
  The original uncertain result is retained; no formatting relaxation or score correction was made.
- The TUI follow-up selected body prose rather than the requested Moby-Dick heading and failed
  claim validation. Its uncertain result and complete recording remain evidence. It was not
  rerun until it happened to pass.

The original title task also recorded a browser cleanup warning at the five-second deadline.
The task's status field was `done`, with the warning/error retained; its gold-title score still
failed. Final process inspection checks for leftovers. This is an operational warning, not a
discarded error or proof of a new lifecycle logic defect. Context fit alone did not make this
local model dependable on the research contract.

## Confirmed defect: duplicate ranked URLs

Reviewing the RFC proposal exposed an output-validation gap independent of its invalid quotation.
Input candidates were deduplicated, but an otherwise valid model result could present one source
as multiple ranks. A focused unit test and [controlled browser reproduction](regression-before.log)
were added and **failed before the fix**: the duplicate result was accepted as `done`, while a
single correctly cited result completed normally.

The fix adds one uniqueness condition before source-reference validation and returns an explicit
refusal. It does not invent a replacement answer, reorder output, grant destinations or relax
any citation/action gate. Canonical captured URL equality already applies to reference binding.
Original frozen local outcomes remain pre-fix evidence; the actual RFC proposal had already
failed for its invalid reference, so this fix is not presented as a recovered model success.

Post-fix evidence covers three checks in source and compiled browsers, plus a separate real-source
engineering retest: duplicates with valid citations refuse, one valid URL completes, and controlled
fixture requests remain GET-only. The live-source retest uses httpbin robots.txt with a scripted
planner; it is **not** actual-model quality evidence. Existing 60-case discovery suites run in both
source and compiled modes. Commands and logs are retained in [the gate index](gates/index.json).
`pnpm check` passes 79 tests. CI runs controlled regressions and archives their output; public
network/model runs remain manual.

## Terminal and reproducibility

The [asciicast](terminal/terminal.cast), [plain output](terminal/terminal.txt), raw JSONL and
candidate-index request record show the actual compiled `/research` workflow, `/sources`,
`/trace`, resize and `/quit`. A controlled index supplied two public HTTP resources under a fixed
query and origin set. It never supplied source facts or a hosted model answer.

After building, use `node packages/agent/tests/live-research.browser.mjs` for the dummy assisted
lane. Add `--actual-local` with explicit `CHROMECLAW_TEST_LOCAL_URL` and
`CHROMECLAW_TEST_LOCAL_MODEL` for local inference. The separate `--actual-local --public-probe`
command is the one-query public lane; stop at a challenge rather than repeatedly probing.
`python3 apps/cli/tests/live.pty.py --stage3` runs the assisted live-source TUI workflow. The
underlying `live-research-regression.browser.mjs --live-source` command is the manual real-source
validation retest, while `eval:live-regressions` keeps CI deterministic with controlled sites.

Reports include source failures, exact reference validity, independent source-title coverage,
latency, model attempts, reported tokens, simulated reservations and frozen-manifest hashes.
First/subsequent sequential requests are not a paired cold/warm benchmark. Invalid references,
literal formatting violations, wrong source selection and barriers remain distinct failure
classes. No semantic entailment, universal no-match truth, broad search quality or complete
live-network audit is claimed. The read-only envelope and trace showed no admitted control
activation; public-source request isolation retains documented limitations.

The cached weights were rehashed and the owned model server was stopped. Temporary Chrome
profiles are removed; final cleanup evidence and byte hashes are retained. The `manifest.json`
file pins evidence and source state; `-text` preserves raw bytes in Git. No dependency, frontend,
permission type or search plugin was added. Stage 4 is interruption and recovery testing.
