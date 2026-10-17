# Architecture

ChromeClaw is a TypeScript terminal application driving Chrome through Playwright. The current
implementation is the starting point, not the final plugin layout. [BUILD_PLAN.md](BUILD_PLAN.md)
orders migration; [DECISIONS.md](DECISIONS.md) records the terminal product direction.

## Current packages

| Package | Role | Internal dependencies |
|---|---|---|
| shared | Action/event schemas, permission and privacy contracts | None |
| egress | Bounded application HTTP and crossing admission | None |
| browser | Persistent browser sessions, observation and browser input | shared |
| agent | Runtime, providers, pure admission and durable JSONL events | browser, shared, egress |
| evals | Controlled fixture server, scripted smoke and independent outcome scoring | agent, shared |
| apps/cli | Human commands, terminal TUI and eval entry point | agent, evals, shared |

Root Vitest aliases resolve packages to source. `pnpm check` builds, typechecks, lints and tests.
Architecture tests check the current dependency direction, keep Chrome APIs out of Node packages
and prevent a second application network sender. `packages/egress` owns application HTTP;
`browser/navigation.ts` separately gates browser-origin requests with Playwright routing and
redirects disabled. These are regression guards, not a complete proof against every JavaScript
networking/import pattern.

## Intended boundaries

Extract pure core decisions, DOM capture and egress when their implementation tasks arrive.
Only egress makes application-origin model/search requests. Browser navigation and page requests
remain separately gated operations. Core has no I/O, ambient clock or randomness. Browser and
terminal adapters supply dependencies.

Four plugin kinds remain: abilities, tools, model adapters and search backends. Each lives in its
own folder, registers once and never imports another plugin. The app composes registries and
passes them inward; core does not import plugins. Unfinished plugins are disabled. Add removal,
registry, egress and purity tests when these packages exist. The terminal TUI owns all user
controls, including approvals; a browser bridge is conditional on a measured integration gap.

The extension architecture preserved at `new:docs/ARCHITECTURE.md` is a reference for boundaries,
not the current product contract. Do not import its side-panel, worker or offscreen lifecycle.


## Phase 2 execution boundary

`shared/permissions.ts` constructs frozen task powers and parses destinations without I/O.
`browser/targets.ts` retains document/node handles and exposes numbered snapshot targets;
`browser/navigation.ts` gates browser-origin HTTP and refuses redirects/popups. Browser I/O,
DNS and snapshot IDs stay in the browser adapter. `agent/safety.ts` makes pure admission decisions
with explicit time/step/spend inputs; the runtime rechecks them after its trusted approval callback.
No plugin registry or new pure-core package is claimed. See D-015 for the limits and rejected
alternatives; `SAFETY.md` maps every retained protection to its regression.


## Phase 3 execution boundary

Providers call the single prompt builder and egress module; no provider calls fetch. Runtime
control owns pending IDs, answer/approval/pause transitions and cancellation. Trusted application
outcome predicates verify world state; otherwise exact source-grounded answers have a limited
extractive check and other completion proposals are uncertain. Versioned event records reconstruct
runs and preserve interrupted/corrupt-tail evidence. [PHASE3.md](PHASE3.md) specifies the contracts.
The four final plugin registries and pure-core package are still not claimed as implemented.


## Phase 4 configuration boundary

`agent/llm/config.ts` parses explicit provider/model/endpoint/key selection and task timing settings.
The factory consumes its resolved union; possessing a key cannot choose a provider. Local has
separate environment names and an explicit loopback endpoint. Configuration inspection describes
selection without a network probe or credential output. Runtime reservations admit configured local/hosted execution before every send; saved metadata
and cumulative reservations survive reopen. Provider usage stays distinct from reserved cost. See [PHASE4.md](PHASE4.md).


## Phase 5 terminal adapter

`apps/cli/src/tui.ts` presents durable runtime states and uses the existing one-use reply API.
It does not implement another agent loop or browser driver. `terminal.ts` reads installed kit
identity/palette data and escapes content before drawing. Settings changes affect future tasks;
reopened runs retain and display their saved model configuration. Source/trace inspection reads
filtered local events. `agent/abilities/ask.ts` narrows permissions and validates snapshot-bound
extractive citations; `browser/reading.ts` captures bounded visible passages. Source opening uses
a separate guarded owned window. Egress buffers bounded SSE proposals while the terminal displays
byte progress; only validated complete actions reach the runtime. The final plugin registries
remain future work. See [PHASE5.md](PHASE5.md), D-020 and D-021.
