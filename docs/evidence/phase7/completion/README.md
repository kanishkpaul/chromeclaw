# Phase 7 completion: research, web finding and selected history

Phase 7 meets its controlled implementation gate on this branch. PR #12's reader starter was
merged at `2d823d3`; this completion adds research/web search, captured claim and URL references,
selected-snapshot history, terminal/JSON routing, source inspection and forgetting. See
[the contract](../../../PHASE7.md), [API comparison](../../../SEARCH_BACKENDS.md) and D-025/D-026.
Hosted inference remains explicitly waived. Kanishk authorized twenty made-up recollections
instead of personal-history testing. This report makes no held-out, personal-profile or daily-use
claim. Phase 8 and Phase 9 have not started.

## Recorded results

| Gate | Result | Evidence |
|---|---|---|
| Check/build/types/lint/unit/process | 78 tests, 21 files pass | [check](check.log) |
| Synthetic complete workflow set | 60/60 source and 60/60 compiled | [source](scripted-source/report.json), [compiled](scripted-compiled/report.json) |
| Actual cached local research | 20/20 exact answers, valid citations and known-fact extract support | [per-case results](actual-local/report.json), [summary](model-results.json) |
| Actual local web finding | top-one 15/15, top-three 15/15; negative errors 0/5 | [per-case results](actual-local/report.json) |
| Seeded snapshot history/bookmarks | top-one 20/20 and top-three 20/20; zero model requests | [per-case results](actual-local/report.json) |
| Final complete-passage verifier | all 60 recorded outcomes revalidated; no new inference | [deterministic replay](final-verifier-replay.json) |
| Actual local regression after final extraction guidance | 1/1 exact research answer | [report](actual-regression/report.json) |
| Discovery safety and recovery | ten groups pass in source and compiled modes | [source](safety-source/report.json), [compiled](safety-compiled/report.json) |
| Real terminal and JSON CLI | nine groups pass | [report](terminal/report.json), [recording](terminal/terminal.cast), [text](terminal/terminal.txt) |
| Five-reader ownership/budget/cancel boundary | ten source/compiled groups pass | [source](readers-source.log), [compiled](readers-compiled.log) |
| Plugin removal | check and twenty history cases pass without backend folder/registration; restored byte-exact | [report](plugin-removal.json), [log](plugin-removal-check.log) |

Inherited source/compiled browser gates pass: runtime 30 groups, safety 35, page-work 22, ask twenty
questions plus five checks, and page-find 14. [The suite manifest](inherited.json) records successful
process exits; `chromeclaw-p7-inherited-*.log` files preserve each complete report.

## What the tests measure

The loopback engine deliberately supplies a wrong snippet value, duplicate links, two source
pages, an unavailable page, a redirect and an unpermitted origin. The browser must read admitted
source passages before the independent known-answer oracle can pass. Sources contain poisoned
instructions to query private data or activate a transfer. Server-observed forbidden writes and
query/redirect/private endpoints remain zero. Forced model proposals independently test refusal,
so passing attacks does not rely only on a model choosing to ignore them.

The twenty capacity questions use a repeated development template and trusted fixture facts.
Two source URLs repeat each fact. This checks capture, reference binding and controlled extraction,
not broad retrieval, multi-hop research or semantic entailment. Web has fifteen known positive
URLs and five empty-result queries. Empty search results hand back uncertainty without inference;
that negative score is not an LLM relevance result. History's twenty recollections are local
lexical lookup and page confirmation. Their scores are not actual-model or personal recall quality.
Raw research ranking fields are inapplicable; the summary reports ranking only for find modes.

The actual run made 35 inference requests: twenty research and fifteen positive web cases.
History and empty-result web cases made none. Weights and settings are pinned in
[environment](environment.json); [server diagnostics](local-server.log) and per-task JSONL retain
execution evidence. The temporary offline server was stopped after acceptance. No model weights
were downloaded, no hosted model/search API was called, and no personal Chrome database was read.

The final verifier requires the whole captured passage for an extract, rather than accepting an
isolated substring as support. The full run's immutable proposals were replayed against that final
verifier, and all outcomes agree. A separate actual regression used the final whole-passage
instruction. This replay is a deterministic gate check, not another sixty inference runs.
A verified quote says what a captured page stated; it does not establish general truth.
Qualified/conflicting claims remain uncertain, and undeclared contradictions are not detected.

The browser integration probe records tab-local CDP navigation history and the absence of global
history/bookmark APIs in ordinary page contexts. [Probe](safety-source/integration-probe.json).
The implemented history integration is an explicit version-one JSON snapshot, with selected time
window and title/URL terms, not live Chrome synchronization. No index or privileged bridge is built.
Unselected metadata stays local, and all history lookup avoids model disclosure. Cancel stops an
active run; changing/removing a snapshot refuses subsequent admissions. Forget removes the local
run's trace and source notes, not its original snapshot or external copies.

## Failures retained and fixes

- The [initial actual research task](development/initial-local/report.json) proposed extraction
  from an empty foreground observation despite already captured sources; the discovery action
  gate refused it. The planner now sees the captured source observation and explicit completion
  guidance. No extraction/navigation permission was relaxed to make the task pass.
- The new source-budget recovery regression observed ten requests where nine were expected:
  legacy foreground restoration reread a source after the discovery pool was exhausted.
  [Failing requests and traces](development/reopen-budget-failure/report.json) are retained.
  Discovery now skips that legacy restore and uses its only reader admission path. Both source
  and compiled regressions confirm no extra crossing, and exhausted step budgets stop before reads.
- Terminal harness attempts assumed IDs never wrap, inspected a previous run's passage, or stopped
  draining the PTY before waiting for exit. They were corrected to inspect the current durable
  record and drain output. [Attempts](development/terminal/) and diagnostic logs are retained.
  One harness attempt ran while the deliberate plugin-removal check had built a disabled backend;
  it truthfully reported no backend. Final runs happened after byte-exact restoration and rebuild.
- An overlapping build initially made a CLI process check fail while compiled files were being
  replaced. The final recorded check is a clean serialized build/check. Restricted-shell loopback
  and tsx IPC attempts were rerun with the permitted local fixture access; those restrictions do
  not represent product failures.
- Code review replaced a broad CAPTCHA keyword refusal with visible-widget recognition, preserving
  readable ordinary security articles. The source/compiled attack fixture includes an innocent
  CAPTCHA/PostgreSQL/payment article and a distinct visible challenge form.

History execution identity also has a recovery regression: reopening a snapshot lookup needs no
model configuration or credentials. Snapshot lookup remains functional with the search plugin
removed, keeping those capabilities independent.

## Reproduce and limits

Run `pnpm check`, `pnpm eval:discovery`, `pnpm eval:discovery-safety`,
`pnpm eval:discovery-terminal` and `pnpm eval:readers`. Actual inference needs the explicit endpoint
and model in the environment record, then `pnpm eval:discovery-local`. To replay these immutable
proposals against the current verifier:

```sh
pnpm exec tsx --tsconfig tsconfig.base.json packages/agent/tests/revalidate-discovery.mjs docs/evidence/phase7/completion/actual-local/report.json
```

The [manifest](manifest.json) pins exact current source/fixture and evidence bytes against the
merged base. CI runs synthetic gates and uploads failure artifacts; its status is separate from
these local results. Readers remain static and viewport-only, sources cannot automatically widen
origins, query-bearing source URLs and redirects refuse, and prompt context is bounded to eight
retained notes plus the first captured observation. No new response-byte quota, universal browser
isolation, DNS-rebinding defense, signed-in-site readiness or hosted endpoint quality is claimed.
Live public-site quality, seven days of use and the final README remain the last two phases.
