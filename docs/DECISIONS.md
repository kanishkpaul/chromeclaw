# Decisions

Record choices, their reasons, rejected alternatives and conditions for revisiting them. The
older entries remain preserved at `new:docs/DECISIONS.md`; do not rewrite that archived history.

## D-012 · 2026-10-17 · ChromeClaw lives fully in the terminal

- Decision: the TUI is ChromeClaw's complete frontend. Keep one-shot CLI and JSON/JSONL modes.
  Chrome is the browser work surface, with a minimal integration bridge only if a measured gap
  requires it. This supersedes archived D-001's MV3 side-panel product direction and the earlier
  unimplemented extension delivery plan, under Kanishk's explicit instruction.
- Why: build on runnable main and keep requests, model setup, approvals, progress and traces in
  the terminal. Support BYOK hosted and local models through the same task and safety contracts.
- Design: borrow the master at `../design-kit` and preserved `new:design/` identity, theme and TUI
  rules. Adapt presentation to the current TypeScript application; no Rust rewrite is implied.
- Safety: retain the intent of the old protections, upgrade failing mechanisms and map replacements
  to regression evidence. Model locality never bypasses a gate.
- Engineering: follow the archived engineering contract's applicable code/comment/commit rules.
  Prefer five readable lines over fifty when behavior and safety are equivalent. Add abstractions
  and dependencies only for demonstrated complexity, with focused commits and verification gaps.
- Rejected: a side-panel frontend, two autonomous runtimes, a framework transplant and a language
  rewrite solely to use the kit's Rust terminal helper.
- Revisit when: Kanishk changes the product direction, or a measured browser limitation requires
  a narrowly scoped integration decision. It does not authorize a second frontend by default.
- Status: product direction adopted; implementation and compatibility remain pending in the plans.

## D-013 · 2026-10-17 · Controlled checks precede features and live testing

- Decision: add `.github/workflows/ci.yml` for checks and isolated browser fixtures. This is the
  only new top-level directory in Phase 1. Use existing dependencies; add no model service or key.
- Why: the previous eval oracle could pass a search-title echo or a blocked task. A failed world
  state must fail the command and CI before later fixes can be measured.
- Boundaries: enforce today's package direction and freeze the one legacy network sender in
  `packages/agent/src/llm/openai.ts` until Phase 3 replaces it with egress. No additional sender
  may be added under this temporary exception. Future core/plugin invariants join checks as those
  packages are introduced; tests must not claim coverage of packages that do not exist.
- Reuse: adapt the explicit corpus count and sorted report ordering from Blindfold's
  `eval/src/report-json.ts`, and the minimal checkout/setup/check/artifact pattern from its
  `.github/workflows/ci.yml`, pinned to `2f04984`. Do not transplant its model downloads, Puppeteer
  harness, extension identity or permissive live-site substring checks.
- Rejected: keeping the ten legacy tasks as a capability score, or treating scripted smoke as a
  model benchmark. Phase 8 owns live testing; Phase 9 owns the final README presentation.
- Revisit when: model-backed fixtures are available in Phase 4, or Phase 3 removes legacy egress.

## D-014 · 2026-10-17 · Credential defense is enforced at capture and write time

- Decision: start Phase 2 with a credential-protection slice, `p2-01`. Adapt the field metadata,
  autocomplete and label rules from Blindfold `browser/src/content/extract.ts` and
  `core/src/credentials/index.ts` at `2f04984`. Keep the app's own types and browser driver.
- Why: a planner or action-policy miss must not permit a credential write. Type/password,
  autocomplete token lists and semantic labels suppress values before they enter observations;
  the driver independently refuses writes and rechecks after focus handlers. The check and
  native setter run in one document turn. Keep the native setter and input/change events for
  ordinary fields, and refuse hidden, covered, detached, disabled and read-only writes.
- Traces: withhold typed action values and their thought summaries. This is not arbitrary PII
  detection: user requests and ordinary page text may still contain sensitive information. Full
  structured trace/egress handling remains in Phase 3.
- Keyboard: temporarily admit only non-writing navigation keys, and refuse every key while a
  credential field is focused. Character entry, paste and keyboard/implicit submission wait for
  target-bound admission in the remaining Phase 2 work. No setting enables credential entry.
- Capture: use a safe DOM target summary rather than reading raw AX field values. Withhold
  screenshots on known credential/framed pages and mask form controls in other screenshots.
  This does not claim general visual-secret detection or canvas coverage. Native AX comparison,
  complete semantic capture and fresh numbered bindings remain in the next target-grounding task.
- Rejected: relying on model promises, label-only policy checks, or calling Playwright fill after
  a separate credential check that focus handlers can invalidate. Browser fixtures must test the
  port's real behavior; inspection of Blindfold alone is not acceptance evidence.
- Revisit when: fresh target bindings and the immutable permission envelope land, then Phase 3
  adds resumable hand-back. This slice does not close the Phase 2 gate.

## D-015 · 2026-10-17 · Bind Phase 2 acts to snapshots and fixed permissions

- Decision: remove selector and label fallbacks from model actions. Offer at most 200 visible,
  uncovered controls in document order, retain their node/document handles and report omissions.
  A changed document, form value, control metadata or DOM invalidates the proposal. Recapture
  without repeating the action. Same-origin frames and open shadow trees participate; foreign
  frames are explicitly unreadable. Native ARIA comparison uses synthetic fixtures only because
  raw AX serialization may contain field values.
- Permissions: freeze copied user-origin/tool/read/write/irreversible permissions before capture.
  Default to no origins and no writes. Loopback requires explicit harness scope. Enforce parsed
  destinations on navigation, redirects and browser requests. Redirect responses are inspected with Playwright route fetch, automatic
  redirects disabled, and refused before any next hop. Block popups, service workers,
  WebSockets and cross-origin data-bearing requests. Do not infer origins from task/page prose.
- Approval: adapt Blindfold's envelope immutability and control-based irreversible/action-state
  approach at `2f04984`. Every activation requires exact approval, including unknown handlers and
  links. The approved proposal names its snapshot, control and advertised destination; recheck
  permissions and retained state afterward, consume the target once and authorize one matching
  data-bearing request. No callback means hand-back without acting. Durable waiting, terminal
  approval controls and restart/resume remain Phase 3/5 work.
- Budgets: enforce finite positive step/time budgets at admission, including after approval.
  Keep monetary spend at zero until actual provider accounting exists in Phase 4. Non-mock
  built-in planners are disabled under that budget; trusted scripted fixture injection remains
  available. This avoids claiming enforcement of a monetary limit without usage accounting.
- Input: ordinary typing retains credential checks, native setters and events. Enter/Space only
  activate an explicitly offered button/link through the same gate. Free keyboard input, paste,
  implicit form submission and unsupported navigation keys refuse. Native DOM activation can be
  rejected by sites requiring trusted input; measure that in later real-site integration.
- Rejected: copying Blindfold's extension executor, approval crypto ecosystem or whole framework;
  keyword-only commit detection; permitting unknown handlers on the assumption they are benign;
  model-generated selectors and approvals that silently widen origins or write permission.
- Limits: these are finite fixture-tested boundaries, not a sandbox for arbitrary malicious site
  JavaScript. GET without parameters is treated as a read request; mislabeled endpoints may have
  side effects. Credential detection, arbitrary pixels and generic PII retain D-014's limits.
  Prompt confinement, general redaction, recovery/outcome verification and durable continuation
  keep their Phase 3 tasks. No dependency, top-level directory or Chrome permission is added.

## D-016 · 2026-10-17 · Phase 3 owns transport, continuation and truthful outcomes

- Decision: add `packages/egress` as the only application HTTP sender. It owns byte limits,
  deadlines, abort and bounded retries. Agent adapters build the provider payload through one
  confined prompt builder and validate replies strictly. Browser request routing remains separate.
  Use existing dependencies; this is a package inside the existing top-level `packages/` directory.
- Reuse: adapt Blindfold's fence escaping/control-token treatment and explicit step outcomes from
  `core/src/confine` and `core/src/agent/step` at `2f04984`. Do not copy its full agent, rollback,
  signatures or cancellation implementation. An ambiguous act is not a successful rollback.
- Lifecycle: pending answer/approval/pause is durable and distinct from completion. Bind responses
  to one pending ID and consume them once. Reopening always recaptures and pauses; it cannot revive
  old node handles or widen the original permissions. Cancellation stops new acts and closes the
  browser to interrupt in-flight driver work; it does not claim to undo an act already dispatched.
- Verification: completion requires a trusted task outcome predicate or an exact extractive answer
  with valid captured evidence. Unverifiable outcomes require judgment and are uncertain. A model's
  finish proposal alone never proves success. Never retry a possible commit automatically.
- Traces: persist validated event records and reconstruct runs rather than appending mutable run
  copies. Recover complete lines, report a corrupt tail, reject traversal/symlinks and preserve
  startup/cleanup/storage failures. Typed values, registered sensitive strings and URL parameters
  are scrubbed before logs, callbacks and HTTP payloads. This is not arbitrary PII classification.
- Rejected: transport fetches in adapters, raw body diagnostics, whole-prompt truncation, throwing
  away unknown model keys, counting hand-back as done, restoring persisted approval as authority,
  promise races that pretend to cancel browser side effects, and unbounded retry loops.

- Phase 3 detail: pending segments use `run_suspended`, not a completion timestamp. Credential
  questions/replies hand back to Chrome and retain only an acknowledgment. Explicit sensitive
  strings are filtered; automatic typed aliases shorter than four characters are not global
  prose filters, while their action values are always withheld. Registered IDs and permissions
  remain stable. Known configured provider-key echoes refuse before becoming a proposal.
- Accounting detail: crossings record `estimatedCost: null` and `accounting: not-estimated`.
  Built-in non-mock planners remain off until Phase 4. Trusted injected fixture code is not an
  attested pricing boundary. Unsupported unversioned legacy logs are preserved and reported
  explicitly rather than silently converted into current executable authority.
- CLI detail: follow the preserved kit's gate grammar, default denial, no banner for one-shot/
  non-TTY output and undecorated JSON. These are basic terminal controls, not the Phase 5 TUI.

## D-017 · 2026-10-17 · Phase 4 starts with explicit provider configuration

- Decision: resolve provider/model/endpoint/key at one boundary. Options win over environment;
  no key selects a provider implicitly. Non-mock models are explicit. Hosted endpoints require
  HTTPS and a selected key; local requires an explicit exact loopback endpoint and never inherits
  hosted credentials. `hf` is an alias, not a fallback. Anthropic refuses before opening Chrome.
- Reason: a local failure must not send page data to the default hosted URL. Reject credentialed,
  query and fragment endpoints rather than attempting to repair potentially private input.
- Inspection: `config --json` describes selection without keys, network probes or capability claims.
  Human metadata precedes browser startup. Preserve the existing zero-cost execution lock until
  accounting and budget admission exist; a valid configuration does not authorize spending.
- Scope: this first Phase 4 slice adds no dependency, permission or top-level directory. Actual
  BYOK/local model acceptance and accounting remain open. Reject a hardcoded pricing table in this
  configuration change because a static price cannot establish a present provider charge.

- Session constraint: Kanishk requested skipping hosted testing. Hosted inference remains
  intentionally unverified. This does not waive local-model acceptance or authorize paid calls.

## D-018 · 2026-10-17 · Reserve each inference attempt before sending

- Decision: enable configured local inference at zero provider monetary cost. Hosted inference
  requires a positive task USD budget and a user-declared USD ceiling per request attempt.
  Reserve that full ceiling before every attempt, including transport and parser retries. Never
  refund a reservation based on missing, failed or provider-reported usage. Reopen reconstructs
  reservations from synced crossings and retains the original task allowance and endpoint.
- Reason: token prices and compatible-server metering differ. A hardcoded price or guessed token
  estimate cannot establish an invoice. The ceiling controls dispatch under the user's declared
  tariff assumption; it is not a guarantee against a provider charging more than declared.
  Provider-side billing limits remain necessary for an external hard invoice cap.
- Bound every output explicitly. OpenAI uses max_completion_tokens; compatible/local defaults to
  max_tokens with an explicit override. No automatic protocol, provider or endpoint fallback.
  Record validated reported usage or explicit unknown usage. Refuse over-limit/invalid usage and
  truncated output; do not turn transport/accounting errors into parser repair loops.
- Scope: no new dependency, permission or top-level directory. Reuse installed offline llama.cpp
  and cached Qwen weights for real local acceptance. Hosted inference testing remains waived by
  the owner. Synthetic HTTP checks and actual inference reports stay separate.

- CLI detail: expose the existing loopback browser-origin permission with `--allow-loopback`.
  Model loopback selection does not imply browser-origin access. Both the flag and an explicit
  allowed origin are required. Add undecorated JSONL durable events and a final result; neither
  JSON mode accepts interactive approvals. Monetary reservations round upward to microdollars,
  while total allowances round down. This is a client dispatch budget, not a provider invoice.

- Integrated repairs: real Qwen output copied the old prompt's registry as a `fields` array.
  Render that registry as prose and show valid action objects; keep strict parsing. Disable
  Playwright's SIGINT handler because the CLI must persist/print its stopped result. Bound
  browser cleanup to five seconds with an explicit warning rather than hanging final recording.
  Preserve validated configuration metadata during content redaction so typed aliases cannot
  corrupt a saved endpoint or mode.


## D-019 · 2026-10-18 · Explicit llama.cpp grammar mode

Actual Qwen JSON-mode form runs produced malformed actions despite local parse repair. Add an
explicit `llama-schema` response format, derived from the existing Zod action contract, using the
server's documented JSON grammar extension. Default JSON mode and strict reply parsing remain.
Persist the chosen format on reopen; never fall back between protocols. The small converter
covers only schema kinds already used by actions and adds no dependency. The driver records its
verified write postcondition without returning the value, so the planner can recognize completed
ordinary input from its history. Real-model outcomes still use independent fixture assertions.

The native grammar carries shapes and discriminants, not expanded string-length/range rules.
llama.cpp rejected the expanded grammar as too complex; the output token/byte caps and unchanged
local Zod bounds remain the authority. No unsupported server parameter is silently retried.

History strings are fenced directly rather than JSON-encoding already serialized action records
a second time. Brief progress summaries and explicit hidden-value guidance help the planner
advance after verified writes without disclosing ordinary input values. These are prompt aids;
strict action parsing, permissions and independent outcome predicates remain authoritative.


## D-020 · 2026-10-18 · Terminal scrollback over the existing runtime

Install design-kit 0.1.0 through its workflow with the Ember skin. Keep upstream fingerprints
in `design/kit.json`, rewrite only project-owned `design/README.md`, and preserve unused-file
deletions on updates. `design/` is the only new top-level directory. TypeScript imports installed
JSON identity/palette data directly; no second hand-maintained palette, Rust application, web
frontend, browser bridge or new npm dependency is introduced. Shared kit changes remain upstream.

Replace the old REPL with a native readline scrollback TUI (`tui`, with `repl` as its alias).
The existing runtime owns actions, durable checkpoints and one-use pending IDs. Presentation
accepts commands at arrival rather than queuing them across future gates. Enter/Esc deny; approval
requires the displayed pending ID. There is no task-wide approval option. EOF and Ctrl-C cancel
without claiming rollback. Restart still recaptures and pauses under saved permissions.

Escape terminal controls and directional overrides before rendering content. Repeat a data-row
prefix on wrapped lines; never interpret page/model text as terminal output or commands. Only the
presentation adapter emits ANSI. Respect explicit theme/color preferences, NO_COLOR and width.
Do not persist readline input history or expose key-entry commands. Settings changes apply to
future tasks; active permissions cannot be widened. Source/trace views read filtered durable data.

The first slice uses ChromeClaw-owned profiles. Authorized-session attachment is still unmeasured,
not an excuse to attach to a personal default profile. Token streaming and the 20-task `ask`
acceptance remain open. PTY/browser integration tests use Python 3's standard library (test-only)
and synthetic loopback model responses; they do not establish actual model quality.

## D-021 · 2026-10-18 · Read-only ask and provisional stream progress

Add an ask ability over the existing runtime, not a second loop or a claim that final plugin
registries exist. Ask narrows tools/writes before capture; captured visible passages have IDs bound
to snapshot records. Completion requires exact extractive answer support and resolvable passage
citations. A separate owned, origin-guarded source window opens only after an explicit user command.
It cannot attach to a personal default profile or renew an expired task permission.

SSE uses the sole egress sender and the existing byte/deadline/reservation limits. Stream progress
contains byte counts only; partial JSON proposals and potentially split secrets are never printed
or acted on. The complete stream must finish and pass strict reply/usage validation. There is no
protocol/provider fallback. Keep streaming explicit in saved configuration and allow legacy servers
to opt out. Model-token counts still come only from validated server usage.

Add pinned React/react-dom 19.2.0 as test-only development dependencies for an actual React form
fixture, built locally with the existing tsup. No React enters the terminal/runtime bundle and no
CDN is needed. No new top-level directory, npm runtime dependency or browser permission is added.
An explicit disposable CDP session is measured separately from owned profiles before deciding
whether a browser bridge is warranted. Personal Chrome session attachment remains out of scope.

The session comparison records disposable CDP attachment versus owned launch/reopen timings
on this Mac. Those are single development observations, not benchmarks; see the evidence report.
Keep owned profiles: attachment exposes session contexts and needs a separate permission/cleanup
contract. No auxiliary bridge is justified here. Browser context loss now interrupts pending
model/user waits as a failed run, distinct from user cancellation. Ask opens the explicit URL
through the existing policy before inference, avoiding blank-tab guesses; reopen retains the
saved ability and pauses. The CLI declares its existing shared-package dependency directly.

Phase 5 evidence-local attributes preserve raw transcript/log bytes and their prompt whitespace;
production sources retain the normal whitespace checks.

## D-022 · 2026-10-18 · Explicit find-on-page candidate contracts

Start Phase 6 with an opt-in `find-01` route over the existing runtime. Share read-only page-scope
construction in composition rather than making find import ask. Keep ranked references in the
strict finish contract, not an action that can activate a control. Revalidate target handles,
snapshot state and visible passages before displaying results; do not confuse reference validity
with semantic relevance. No-match remains uncertain and ambiguity can request clarification.

Do not invent a confidence threshold before measuring actual-model ranking on labelled development
fixtures. The current route is experimental and viewport-only. Optional browser reveal is deferred;
no highlight, scrolling, control activation or permission widening is needed to inspect these
results in the TUI. No new dependency, top-level directory or browser permission is required.
The four final plugin registries and J2 select/back/tab work remain pending. See PHASE6.md.
