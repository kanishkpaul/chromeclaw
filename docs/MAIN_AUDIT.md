# Main audit, 17 October 2026

## Conclusion

Build on the runnable CLI on GitHub `main`, after fixing its safety boundaries, observations,
state machine and evaluation oracle. The updated direction is a terminal TUI, using the local
design-kit and preserved `new` assets. Preserve the extension design as historical reference. Do not
merge the archived branch wholesale: that would replace the implementation with a plan.

The current code has useful pieces: a runnable workspace, browser launch and input functions,
Zod action schemas, an OpenAI-compatible adapter, JSONL persistence and a small CLI. The action
loop is not ready for unattended work on signed-in sites. It can expose credential values,
execute consequential controls without confirmation, and declare completion without evidence.

This audit changes documentation and adds a reproduction script. It fixes no production bugs.
The owner's subsequent direction on 17 October makes the TUI the full product frontend, requires
BYOK and local models, and calls for retaining/upgrading old safety with concise, maintainable
code. The current plans reflect that direction; archived side-panel requirements are superseded.

## Exact sources and branch handling

| Source | Commit | Meaning |
|---|---|---|
| GitHub `main` | `50355b976c833f9bd9df3e0b8148d80a53205e00` | Audited executable CLI and MVP checklist |
| GitHub `new`, now local `new` | `2a8b4c155bab96896dc73dc4670a930563ec0023` | Extension direction, engineering contract, architecture, phases and design kit |
| Blindfold upstream | `2f04984d66fec2aa854665a40bf2c8044de31758` | Read from a fresh temporary clone of `ArneshBanerjee/blindfold` |

Before removal, `new` was saved as a local branch and a verified complete-history bundle at
`.git/local-archives/new-2026-10-17.bundle`. Deletion used an expected-SHA lease. A fresh remote
listing showed only `main`, still at `50355b9`. Restore with
`git push origin new:refs/heads/new` if needed. The bundle is local and is not part of this PR.

The pre-existing local `main` also points to `2a8b4c1`; it was not reset. The audit branch starts
from GitHub `main`. The modified local Blindfold checkout was not touched. Its checkout was
87 commits behind its tracking ref, so it was not used as the upstream source of truth.

## The jobs on the archived branch

`git show new:docs/BUILD_PLAN.md` defines:

| Job | Intended behavior | Present on executable main |
|---|---|---|
| J1, research | Search, read sources in a separate tab group, answer with passage citations | Search navigation and text extraction only. No research orchestration or citation contract |
| J2, page work | Complete a bounded task, gate actions, verify results, hand back for login | One-action loop with click, type, press and scroll. No resumable gates or verification |
| J3a, find on page | Rank, reveal and highlight an element from a vague description | No dedicated ability or highlight |
| J3b, find in history | Search history and bookmarks, confirm candidate pages | No history integration |
| J3c, find on web | Return a verified target URL from a vague description | Search navigation only. No target-identity check |

The extension phase gates are historical and are not the current delivery path. The audited
`main` produces a CLI build and contains no extension. The archived plan's claims about `main` and `old` no
longer describe GitHub's current branch layout.

## Implementation assessment

`apps/cli` selects a provider and constructs `BrowserAgentRuntime`. The runtime opens a persistent
Playwright context, captures the page, asks for one action, applies a regex policy, executes and
appends a step. It repeats until `finish`, `fail`, an exception, a policy decision or the step cap.

The provider receives an 1,800-character observation summary and six recent action-type lines.
The full observation is retained locally but is not passed through the hosted prompt. Browser
results replace `observationSummary` on the logged step, without becoming structured planner
history. There is no post-action observation tied to a verified expectation.

These details explain why a two-step mock navigation can work while multi-page research and
forms fail. Increasing the step cap does not restore lost evidence or add a recovery policy.

## Findings

Priority P0 blocks signed-in autonomous use. P1 blocks reliable task completion or measurement.
P2 covers diagnostics, configuration and maintainability. "Reproduced" refers to the local
fixture runner below; "inspected" means source evidence without an end-to-end demonstration.

| ID | Priority | Evidence | Finding and owning source |
|---|---|---|---|
| B01 | P0 | Reproduced | `packages/browser/src/controller.ts:134` uses `input.value` as target text, including password fields. Values enter observations and JSONL. On a short page the synthetic value also enters `summarizeObservation`, the hosted planner's input. No real credential or external model was used |
| B02 | P0 | Reproduced | `packages/agent/src/safety.ts:21` does not inspect field type/autocomplete. `type` into a password field identified only by `#field` was allowed and changed the field. `controller.ts:106` has no independent credential refusal |
| B03 | P0 | Reproduced and inspected | No per-task tool/origin envelope exists. `safety.ts:22` searches task, page title, URL and action strings. Clicking `#primary` committed the fixture's transfer control without confirmation. A server-side counter recorded the commit. The gate never saw the resolved label |
| B04 | P1 | Inspected | `packages/agent/src/prompt.ts:24` interpolates page data into the user-message instruction stream. There is no provenance fence or control-token neutralization. Prompt text is not a capability boundary; B03 must be fixed too |
| B05 | P1 | Reproduced and inspected | `packages/browser/src/targets.ts:19` accepts model-written selectors and takes `.first()` for every fallback. Two identical buttons silently selected the first. No observation identity binds a target to the page the planner saw |
| B06 | P1 | Reproduced and inspected | `controller.ts:83` uses unavailable `page.accessibility`. Capture labels `visibility:hidden` controls visible because it checks area alone. It slices the first 120 nodes before ranking, misses frame contents and lacks credential, occlusion and accessible-name metadata. Native input tags are not semantic ARIA roles |
| B07 | P1 | Reproduced | `packages/agent/src/runtime.ts:246` drops arguments and results from history. A fact returned by `extract_text` was absent from the next hosted-planner context. `packages/shared/src/utils.ts:31` truncates the combined prompt so long body text can crowd out all target descriptions |
| B08 | P1 | Reproduced | `runtime.ts:86` treats confirm and block as terminal and closes the browser. `runtime.ts:198` turns `ask_user` into a string and continues without an answer. No pause/resume API binds approval to one action and current page state |
| B09 | P1 | Reproduced and inspected | `runtime.ts:124` trusts a model's `finish`. A fabricated completion on `about:blank` became `done`. Browser calls returning without error are not task completion, and there is no settle/expectation check after an act |
| B10 | P1 | Reproduced and inspected | `runtime.ts:142` catches failures around the whole run. One planner error ended the run after one call. Unresolved targets and transient HTTP failures have no bounded re-observation/replan path. Repeated actions continue until the step cap |
| B11 | P1 | Reproduced | `packages/evals/src/scoring.ts:24` accepts a substring in any observation and any status except `failed`. A search-title echo and a blocked run both scored success. `tasks.ts:56` explicitly accepts blocked price comparison as success. Visiting Hacker News is enough to pass its story-selection task |
| B12 | P1 | Inspected | `packages/agent/src/llm/openai.ts:35` calls fetch directly, with no deadline or abort signal. It throws raw provider bodies and partial malformed content, which can enter logs. It advertises a provided schema but sends only JSON-object mode and prose. Compatibility normalization discards unknown fields before strict parsing |
| B13 | P2 | Inspected | `packages/agent/src/llm/index.ts:38` defaults hosted models to `mock-browser-operator`. Selecting `local` without a base URL still constructs the OpenAI endpoint. The keyless-local check matches hostname substrings rather than a parsed loopback host |
| B14 | P2 | Inspected | `runtime.ts:44-57` creates the planner and writes the first event outside the run catch. Close errors are swallowed. Error steps omit the failed proposal. The recorded observation is pre-act, while its summary may describe the result. There is no exact model-request/crossing record or token/cost accounting |
| B15 | P2 | Inspected | `packages/agent/src/storage/jsonl.ts:32` trusts JSON without schemas, hides read errors and resolves unchecked run IDs as paths. A partial final line can hide otherwise readable events. This is a local-file integrity issue, not a demonstrated remote exploit |
| B16 | P1 | Observed and inspected | `pnpm check` does not exist; no CI workflow or architecture tests exist on this branch. CLI tests use `--passWithNoTests`. README calls current main an archive and links missing `PREBUILD.md`. `docs/EVALS.md` calls live-site tasks deterministic, and README says `pnpm eval` runs ten although its default selects three |
| B17 | P2 | Inspected only | `apps/cli/src/index.ts:56` prints a failed/blocked run without setting a failure exit status. Step limits are parsed with `Number` without range checks; CLI defaults override environment headless/step settings. No clean JSON run mode exists. The separate Anthropic CLI exit-status probe was not executed |
| B18 | P2 | Inspected | `packages/agent/src/llm/anthropic.ts` is a throwing placeholder exposed in the CLI provider list. No capability profiles distinguish text, vision, structured output or context limits. The archived extension's Chrome built-in adapter was proposed, not implemented or required by the current TUI plan |

## Verification

On Node `24.18.0`, pnpm `10.23.0`, with the frozen lockfile:

| Command | Observed result |
|---|---|
| `pnpm install --frozen-lockfile` | Completed. Initial missing eval-bin warning before build; ignored esbuild lifecycle-script warning |
| `pnpm build` | All packages and CLI built |
| `pnpm typecheck` | Passed |
| `pnpm lint` | Passed |
| `pnpm test` | 15 tests passed. CLI had no tests and exited successfully |
| `pnpm check` | Failed because the command does not exist |
| `node docs/audit-2026-10-17/reproduce.mjs` | 14 defect checks reproduced in Chrome `155.0.8059.80` and local scorer calls |

The 14 checks are not 14 independent vulnerabilities, an eval success rate or a model benchmark.
They include capture checks, runtime traces and two direct scorer checks. Scripted planners make
the control-flow failures deterministic. The runner uses temporary browser profiles, loopback
fixtures and synthetic credential markers. It does not read a person's saved browser profile.

Evidence: [results](audit-2026-10-17/evidence/results.json),
[browser trace](audit-2026-10-17/evidence/capture-trace.zip),
[fixture screenshot](audit-2026-10-17/evidence/fixture.png), and
[reproduction script](audit-2026-10-17/reproduce.mjs).
Per-case planner inputs and runs are in the evidence folder; raw runtime JSONL is in `evidence/runs`.
Run the script after `pnpm build`. An optional output-directory argument keeps later runs separate.
The assertions intentionally describe today's bugs and should be replaced by prevention tests
as each fix lands. The capture trace covers capture/target selection; runtime cases have JSONL,
not Playwright traces. Open the trace with `pnpm --filter @chromeclaw/browser exec playwright show-trace <path>`.

Not verified: real model quality, hosted requests, live-site eval outcomes, extension loading,
worker lifetime, trusted CDP input, daily-use reliability, Blindfold's full test suite, or copied
Blindfold code. No production code was copied or changed. Automatic approval review rejected the
separate Anthropic CLI probe on possible paid-provider risk; B17 remains source-inspected.

## Next work

Follow [BUG_FIX_PLAN.md](BUG_FIX_PLAN.md), then [J123_BUILD_PLAN.md](J123_BUILD_PLAN.md).
[BLINDFOLD_REUSE.md](BLINDFOLD_REUSE.md) identifies pieces to adapt and their limits.
The current `TODO.md` remains open; this audit is evidence and planning, not implementation.
