# Phase 3 controlled runtime evidence

Phase 3 covers fix-04, fix-05, fix-06 and fix-08. The local gate ran on macOS with Node 24.18.0
and Chromium 155.0.8059.80. All planners here are scripted or synthetic loopback HTTP adapters.
These results measure runtime contracts, not model capability. Phase 2 merged through PR #4 at
`4190094`; Phase 3 is submitted separately for review.

| Command | Observed result | Evidence |
|---|---|---|
| `pnpm check` | Build, typecheck, lint and 39 tests pass | [log](check.log) |
| `pnpm eval` | 3 independent browser fixtures pass | [report](baseline-source-report.json), [log](baseline-source.log) |
| `node apps/cli/dist/index.js eval` | 3 compiled CLI fixtures pass | [report](baseline-built-report.json), [log](baseline-built.log) |
| `pnpm eval:credentials` | 13 credential groups pass | [report](credentials-report.json), [log](credentials.log) |
| `pnpm eval:safety` | 35 source safety groups pass, zero unsafe acts | [report](safety-source-report.json), [log](safety-source.log) |
| `node packages/browser/tests/safety.browser.mjs` | 35 compiled safety groups pass, zero unsafe acts | [report](safety-built-report.json), [log](safety-built.log) |
| `pnpm exec tsx --tsconfig tsconfig.base.json packages/agent/tests/runtime.browser.mjs --source` | 28 runtime groups pass against source | [report](runtime-source-report.json), [log](runtime-source.log) |
| `node packages/agent/tests/runtime.browser.mjs` | 28 runtime groups pass against compiled packages | [report](runtime-built-report.json), [log](runtime-built.log) |
| `node apps/cli/dist/index.js eval --inject-failure` | Exits 1 when the server receives Pune instead of Kolkata | [report](oracle-negative-report.json), [log](oracle-negative.log) |

The runtime source command resolves workspace imports through the root TypeScript configuration.
The check command built the final production code before these suites. No source was edited
while the final suites ran. Hosted CI is reported separately on the PR; local success does not
establish hosted success. Phase 2 gate-mutation evidence remains in its own historical report;
those mutations were not repeated for this phase.

## What ran in Chromium

A browser task extracts a fixture fact, navigates away and finishes through the HTTP planner
using retained evidence. The server checks that a synced crossing precedes its request. A 429
retries with another crossing; streaming cancellation stops without dispatching another act.
Synthetic credentials stay out of prompts and traces. A provider key echoed by the HTTP response
fails with a stable code before it can become a proposal.

Answer and approval states persist before controls receive them. Wrong IDs, duplicate replies,
stale approvals and replay attempts refuse. An external denial wins a race against later automatic
approval. Credential hand-back continues after a fresh capture without an agent credential write;
a raw credential-question reply is replaced with a manual-completion acknowledgment. A six-step
form verifies independent server state. Mid-task session expiry, a modal and the inherited stale
node/duplicate target cases exercise changed pages.

False completion is uncertain. An invalid citation cannot hide behind a valid one. Three identical
unsuccessful proposals stop recovery. One parser repair is allowed; the next failure stops.
Ambiguous commit acknowledgment stops before a duplicate act. Cancellation before dispatch,
during HTTP, during browser input and during a human callback has separate assertions. In-flight
cancellation reports possible effects rather than claiming undo.

A saved pending run reopens with fresh handles and pauses under its original permissions. A real
SIGKILL terminates a writer; a separate reader process reconstructs its complete records. Another
case appends a corrupt tail and retains readable records with a warning. Startup, cleanup and
storage failures have distinct assertions. Unit checks cover traversal, symlinks, invalid middle
records, missing files and I/O distinctions.

## Reading the artifacts

[Raw event logs](runs/) are grouped by suite and case. The JSON reports carry original run IDs.
Runtime `evidenceDir` names identify the original isolated local attempt; archived case directories
replace that temporary prefix. Reopening shares the pending run's ID and log deliberately.
The killed-writer case copies a real browser trace before interrupting its append process.
The deliberate storage-failure case has no trace: its inability to save is the asserted result.
The corrupt-tail log deliberately ends with an invalid record. Do not treat that as archive damage.

Logs contain only synthetic fixture material. Typed values and their thought text are withheld;
registered sensitive aliases and URL parameters are filtered without changing trusted IDs or
permissions. This is not generic PII classification or encoded-secret detection. Unknown request
cost is recorded as null, never zero. The default non-mock runtime remains disabled until Phase 4
adds accounting/configuration and actual model acceptance.

## Limits and reuse

No paid provider, actual local model, signed-in account or held-out live site ran. Exact extractive
grounding checks quote occurrence, not semantic entailment. No full terminal TUI or trace viewer
is claimed. Legacy unversioned traces remain historical and cannot silently grant resumable
authority. See [PHASE3.md](../../PHASE3.md) and [SAFETY.md](../../SAFETY.md) for the contracts
and browser-network/privacy limits.

Prompt confinement and human-control concepts selectively reuse co-owned Blindfold at `2f04984`.
See [the reuse record](../../BLINDFOLD_REUSE.md). Its complete upstream suite was not run.
Real BYOK/local models remain Phase 4, the TUI Phase 5, live testing Phase 8 and final README
presentation Phase 9.
