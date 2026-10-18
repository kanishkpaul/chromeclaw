# Phase 6 controlled acceptance

PR #10 merged the find starter at `629b3d3`; this completion implements
`find-01` and `work-01`. The source/fixture manifest pins the tested tree independently of the
completion commit. Hosted inference is explicitly waived and unverified. No paid calls, model
downloads or personal Chrome profiles are used.

## Results

| Gate | Result | Evidence |
|---|---|---|
| Build, strict types, lint, unit/architecture/process | 71 tests in 18 files | [check](check.log) |
| Find binding/permissions, source + compiled | 14 groups each | [source](find-source-report.json), [compiled](find-built-report.json) |
| Labelled find plumbing, source + compiled | 20/20 each; synthetic planner only | [source](find-labelled-source-report.json), [compiled](find-labelled-built-report.json) |
| Actual offline find, compiled | 20/20; positive top-1 and top-3 15/15; negative errors 0/5; false no-match 0 | [report](find-local-report.json), [traces](find-local/) |
| Work, real TUI + synthetic HTTP planner | 20/20 independently checked workflows | [report](work-scripted/report.json), [recording](work-scripted/work.cast) |
| Work, real TUI + actual offline model | 20/20; zero completion corrections; 24 exact approvals; one required synthetic session restoration | [report](work-local-report.json), [recording](work-local/work.cast), [traces](work-local/work/runs/) |
| New input/select/history/tab/attack regressions | 22 groups each, source + compiled; zero unsafe/foreign requests | [source](work-source-report.json), [compiled](work-built-report.json) |
| Runtime/lifecycle + completion judgment | 30 groups each, source + compiled | [source](runtime-source-report.json), [compiled](runtime-built-report.json) |
| Retained safety and credentials | 35 groups each source + compiled; 13 credential groups | [source](safety-source-report.json), [compiled](safety-built-report.json), [credentials](credentials-report.json) |
| Inherited reading, transport, configuration, session, terminal | Ask 20 + 5 extra checks each mode; transport 16 each; configuration 5 each; session 3; terminal 13; baseline 3 | [reports](regressions.json), [terminal find/controls recording](terminal/controls.cast) |
| Independent tool removal | Remove select + one registration line, `pnpm check` passes; exact restoration | [report](support/plugin-removal-report.json), [log](support/plugin-removal-check.log) |

The work score is the final controlled acceptance run, not an average over attempts. Earlier
failures remain below. The [environment](environment.json) pins cached weights, settings and
machine; the [manifest](manifest.json) pins implementation, fixtures and evidence bytes. Logs
retain their original UTC timestamps. Hosted CI is a separate check on the published branch;
these archived local runs do not claim it already passed.

## What is measured

J3a has twenty independently labelled cases: fifteen positive targets/passages and five absent
or ambiguous cases. Six are marked development cases. Reports separate positive top-1/top-3,
negative errors, false no-match, confidence and latency. Synthetic labelled planners measure
plumbing, not relevance. Actual local inference uses cached Qwen3-VL-8B-Instruct Q4_K_M as a
text-only planner through the production local adapter. It does not inspect image pixels.

J2 has twenty workflows through a real PTY TUI and Chrome, including the six-step form. Saved
values and exactly one POST are checked independently of the model's finish proposal. Back and
tab cases additionally require their actual tool sequence and a server read of the secondary
page; an initially visible completion sentence cannot bypass that oracle. Approvals are exact
one-use controls. Manual session restoration and completion corrections are separate fields;
assisted completion must not be described as autonomous completion.

Forced adversarial proposals exercise gates even when a model ignores the attack. Browser tests
check native/React edits, event-time drift, guarded trusted activation, uncertain keys, duplicate
options, no-op edit replay, credential selects, owned tabs/history, popup races, exfiltration and
exact approval. Zero unsafe writes means the controlled fixture's forbidden endpoints were not
reached, not universal isolation from hostile JavaScript.

## Development failures and resulting changes

The retained `development/` runs are part of the evidence:

- Six-case find development passed 5/6. An ambiguous result scored itself 0.95 and was wrong at
  the initial 0.8 cutoff. The cutoff became 0.98, frozen before Phase 8.
- The first twenty-case local find run passed 17/20. Missing structured results led to one bounded
  format repair. A subsequent run passed 19/20 with 15/15 positive top-1/top-3, but the ambiguous
  case claimed confidence 1.0. An independent duplicate-label guard now requires a trusted ordinal;
  the two affected ambiguity/ordinal cases passed on rerun. Self-reported confidence is not
  probability calibration or semantic proof.
- The first local six-step work run finished after Next without saving. The runtime correctly
  reported uncertainty. Bounded interactive judgment now preserves edits, with at most two
  corrections and no action approval or permission widening.
- A subsequent judgment run repeated field writes and exhausted the step budget. Compact history
  now retains safe target names across 24 steps; already-correct writes do not replay events.
- A later work run passed thirteen tasks, then copied an obsolete post-navigation snapshot for
  Back three times. The freshness gate refused every proposal. Redundant historical IDs were
  removed and the current next-action ID is restated after history; freshness remains strict.
- The first resumed attempt could not reach the stopped temporary model server. It failed before
  any browser action. The task-owned offline server was restarted from the same cached weights.

The original task was present in the planner input throughout. An early debugging suggestion
that privacy redaction erased it was checked and rejected; no intent-redaction change was made.

A resumed run passed seven work tasks, then repeated an already verified write on the
duplicate-label form. It stopped after three no-op proposals without replaying input events.
The harness now collects every task outcome and exits nonzero for any miss, instead of aborting
the quality report at the first failure. The oracle and bounded runtime loop stop are unchanged.

## Reproduce

Run `pnpm check`, `pnpm eval:find-labelled`, `pnpm eval:work-safety` and `pnpm eval:work` for the
scripted gates. For compiled parity use the underlying browser scripts with `--built` (runtime
uses compiled mode by default). The individual logs record source/compiled selection.

With an explicitly started local OpenAI-compatible server, set `CHROMECLAW_TEST_LOCAL_URL` and
`CHROMECLAW_TEST_LOCAL_MODEL`, then run `pnpm eval:find-local` and `pnpm eval:work-local`.
Configuration absence fails; there is no synthetic fallback. Local commands create new timestamped
attempt directories, so reports and failures survive reruns. CI runs synthetic browser gates and
archives artifacts; actual inference is a separate manual gate.

## Limits

These are development fixtures on one cached local model, not held-out/public-site accuracy.
Hosted models, signed-in sites, arbitrary PII, non-English/unknown credential disguises, complex
custom widgets, image understanding and seven days of personal use remain unverified. Exact
extractive completion is not semantic entailment. Earlier page-installed event listeners are not
isolated by the event guard. Native setter events are untrusted and their fallback is explicit.
Only active owned tabs can make requests; parallel research remains Phase 7. The other three final
plugin registries and pure-core migration are not claimed. Phase 8 remains live testing and Phase 9
the final README, with no phase appended after them.
