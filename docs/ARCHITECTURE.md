# Architecture

ChromeClaw is a TypeScript terminal application driving Chrome through Playwright. The current
implementation is the starting point, not the final plugin layout. [BUILD_PLAN.md](BUILD_PLAN.md)
orders migration; [DECISIONS.md](DECISIONS.md) records the terminal product direction.

## Current packages

| Package | Role | Internal dependencies |
|---|---|---|
| shared | Action schemas, observation/run types and formatting helpers | None |
| browser | Persistent browser sessions, observation and browser input | shared |
| agent | Runtime, providers, legacy policy and JSONL storage | browser, shared |
| evals | Controlled fixture server, scripted smoke and independent outcome scoring | agent, shared |
| apps/cli | Human commands, REPL and eval entry point | agent, evals, shared |

Root Vitest aliases resolve packages to source. `pnpm check` builds, typechecks, lints and tests.
Architecture tests check the current dependency direction, keep Chrome APIs out of Node packages
and prevent a second network sender. The browser request guard uses Playwright routing with redirects disabled; it is separate from
application model/search egress. The existing provider fetch is a documented temporary
boundary; Phase 3 moves it into egress. These tests are regression guards, not a full static
proof against every JavaScript networking or import pattern.

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
