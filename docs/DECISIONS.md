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

## D-023 · 2026-10-18 · Registered page tools and event-time input guards

Phase 6 introduces the tool registry, one of the four intended plugin kinds. Each tool owns its
folder and one composition registration line; tool plugins import contracts/adapters, never each
other. Legacy search, extraction and screenshot dispatch stays explicit until its own migration.
No pure-core, ability/model/search registry, dependency or top-level directory is claimed or added.
Removing select plus its single registration line passes `pnpm check`; restoration is byte-exact.

Use Playwright's trusted pointer/key activation on retained node handles. An adapter-owned capture
listener rechecks document, target metadata, geometry and ordinary form state at input events.
Resolve acknowledgment before navigation discards the document. Never retry a possibly dispatched
activation through native click. Native checkbox/radio preactivation changes are permitted only
for the expected target/group after an admitted gesture; unrelated form drift still refuses. A
private post-action checked-state check can acknowledge that edit without serializing its value.
The existing string-outcome adapter distinguishes that acknowledgment from dispatch-only results.

Retain the atomic native setter for text/contenteditable and select, with `native-dom-fallback`
recorded alongside tool effect before dispatch. Select adapts Blindfold's select behavior from
`browser/src/content/apply.ts` at `0fddc14a24f88c5bcb72db5f93c53fd4db2c0b08`, upgraded with exact
unique enabled option labels, protected field classification, focus-time revalidation and input/
change acknowledgment. Option values remain inside the browser. Selection proposals and typed
text are withheld in traces. No credential or unknown-widget fallback is enabled.

Back uses the owned page's observed CDP history destination. Tabs are bounded to five owned pages;
only the exact Page returned by an explicit open can join the run, including during a racing
noopener popup. Browser requests remain guarded on the active page. Closing a tab needs exact
approval and cannot close the last task tab. This is not personal-history or personal-profile
access and does not implement Phase 7 concurrent research reading.

Find uses a development cutoff of 0.98 after observing a confident wrong ambiguous result at 0.95.
Self-reported confidence is not a calibrated probability. Indistinguishable control labels require
an explicit first/second/third ordinal from trusted user input; unsupported disambiguation hands
back. Keep the cutoff frozen before Phase 8 held-out testing and publish the development failures.
The controlled fixture suite is not a held-out sample. Native event guards do not provide isolation
from arbitrary malicious JavaScript or earlier page-installed listeners.

The added browser/terminal gates extend CI's timeout from 15 to 25 minutes. React remains an
already pinned test-only dependency; the work fixture bundle is generated locally without a CDN.
Hosted inference remains waived; no model weights or providers are downloaded or changed silently.

Interactive page work can hand an unverified finish back for user judgment at most twice while
retaining the current page and edits. The answer cannot approve an action or widen permissions;
recapture and the original action gates still apply. Noninteractive completion stays uncertain.
This follows an actual local-model failure that mistook Next for a final save. The terminal eval
counts these corrections separately from exact approvals and manual session restoration; assisted
completion is not reported as autonomous completion. The failed run remains in the evidence.

Compact action history retains safe target names for up to 24 steps, without typed values. It
omits redundant before/after IDs; the next-action snapshot ID is restated after history to avoid
copying an obsolete post-navigation capture. The strict freshness gate is unchanged. An actual
Back task exposed this confusion and its failed trace is retained. History reads require the
back tool explicitly; ask/find do not collect history or tabs. Driver acknowledgments time out
after three seconds when a trusted key produces no click, and runtime cancellation can interrupt
that wait without claiming an in-flight gesture was undone.

## D-024: Admit static source readers separately from page-work tabs

Phase 7 starts with a browser-owned reader pool composed into the existing navigation guard.
Readers do not select the foreground page or use page-work tab permissions to gain action powers.
They require the original read/navigation/origin/expiry permissions and have separate exact-page
ownership. Five concurrent readers and twenty unique attempted sources are the initial bounded
research budgets; each reader closes after at most fifteen seconds or task expiry. The caller
must compose reader admission with the guard before reading. No application command enables
research until runtime composition and acceptance evidence exist.

Disable JavaScript through CDP and allow only a single main-document navigation and same-origin
static assets, without queries. Blocking external scripts alone would leave inline exfiltration.
This sacrifices script-dependent content for a small reviewable first boundary. Keep these
failures explicit rather than silently activating pages. Reuse the existing passage reader and
request gate instead of adding another network sender, browser context, runtime or dependency.
No personal Chrome history/database access is introduced. No new dependency or top-level directory.
The local Blindfold code was searched for reader/history overlap; this slice reuses ChromeClaw's
existing capture/navigation code and copies no additional Blindfold implementation.

The fixture records real browser concurrency, independent request observations and per-source
outcomes in source and compiled modes. This is engineering evidence, not actual-model research
quality or held-out coverage. Search, synthesis, terminal orchestration, web finding and bounded
history integration are the remaining Phase 7 work; hosted inference stays waived.

## D-025: Compose discovery into the existing runtime with fixed queries

Research and web finding use the existing agent loop, model adapters, request accounting, trace
store and TUI. A search backend is a separate plugin folder with one typed registration; it takes
injected readers and does not import another plugin. Engine-tab search is the enabled baseline;
[the API comparison](SEARCH_BACKENDS.md) does not select an unmeasured paid provider. No new
runtime, frontend, dependency or top-level directory is introduced.

Parse discovery scope before reads. User-supplied subquestions are fixed before source content;
models and pages cannot add queries. The browser reader accepts a parameter-bearing main-document
request only when it is the exact predeclared search URL on its exact owned reader tab. Static
assets and source documents retain the no-query rule. Search result links are deduplicated
candidates, never citations. Only admitted source passages can back final claims or URL matches.
Reopen pauses before new reads, preserves scope and expiry, and counts previous search/read
reservations against the twenty-attempt limit. Reading never grants page-write authority.

Research claims distinguish exact extraction from qualified/conflicting statements. Only complete-passage
extracts with resolvable passage IDs can pass automated support checks; final answer text must
exactly join those claims. Paraphrase/conflict references can be mechanically valid while support
requires human review. This is not a semantic entailment detector. The design follows Blindfold's
structural grounding boundary (`core/src/grounding/index.ts`, revision
`0fddc14a24f88c5bcb72db5f93c53fd4db2c0b08`) while using ChromeClaw's existing passage contracts;
no page node is allowed to justify a new action or query. No additional Blindfold source is copied.

## D-026: Bound history access through an explicitly selected portable snapshot

The disposable-browser probe records tab-local `Page.getNavigationHistory`; `History.search`
is unavailable and normal page contexts expose neither `chrome.history` nor `chrome.bookmarks`.
This integration cannot read a user's global Chrome history/bookmarks without another mechanism.
Choose an explicitly supplied, selected version-one JSON snapshot rather than scrape a live
profile database or install a privileged browser bridge. The TUI remains the only control surface.
This supports snapshot history/bookmark lookup, not automatic live-profile synchronization.

Require a bounded time window and explicit title/URL terms. Read a regular, nonsymlink JSON file
of at most 1 MiB and 10,000 records; filter and rank locally, deduplicate and confirm at most three
permitted pages. Unselected entries never enter model input or traces. This first history ranker
makes zero inference requests, including with a hosted configuration; candidate metadata is not
disclosed to a hosted model. A future semantic ranker would require a separate metadata-disclosure
gate and evidence of incremental gain. No embedding/text index is introduced or justified by these
synthetic tasks. Kanishk authorized made-up recollections; the twenty-case history report is seeded,
not a claim about personal memory or a week of use. Cancel revokes an active run; deleting/changing
the selected snapshot refuses subsequent admissions. `/forget RUN-ID` deletes its local trace and
retained notes, without claiming to erase original exports or external copies.

`/origins` changes only future TUI tasks after trusted user input and full origin validation.
Search results cannot add origins to an active or saved envelope. A blocked source host can be
reviewed and explicitly included in a new task; no dynamic page-driven permission expansion.
A recovery regression caught legacy foreground restoration issuing an extra read after discovery
budget exhaustion. Discovery now skips that restoration entirely and uses only its reader path.

Source-reader CAPTCHA hand-back uses visible challenge widgets, not article keyword matching.
Ordinary security-topic articles retain read access, preserving the old harmless-keyword intent.

History reopen retains its local execution identity without invoking model configuration or
requiring credentials. The search plugin removal gate also runs all twenty seeded history cases,
so disabling web search cannot disable snapshot lookup.

## D-027 · 2026-10-18 · Live testing preserves mock and daily-use boundaries

Phase 8 starts with a frozen anonymous public-site pilot, an unsent synthetic demonstration-form
edit and synthetic history snapshots. Kanishk requested a process/app inventory and cleanup
before live testing and explicitly chose dummy BYOK emulation instead of real hosted inference.
The wire emulator uses the existing injected OpenAI-compatible adapter with dummy credentials,
synthetic usage and reservations; production hosted configuration remains HTTPS-only and refuses
loopback. Cached offline local inference is reported separately. No dependency, permission
expansion, profile attachment or top-level directory is added. Seven days of reviewed bounded use
remain required; a single pilot does not complete Phase 8 or authorize Phase 9.

Live Python/MDN/Node documentation exposed passive-resource refusals incorrectly failing a
successfully loaded read-only page. A controlled regression reproduced the defect before its fix.
The navigation guard now tags main-document refusals, and read-only callers drain only those as
fatal outcomes. Blocked fonts, query-versioned assets, telemetry and foreign requests stay blocked;
ordinary interactive actions retain all-request refusal handling. No redirect, query, origin,
credential or action gate is relaxed. Read-only captures can be incomplete after blocked assets;
reference validation remains distinct from semantic correctness. Original live failures and
revised-label development follow-ups remain separate evidence.

## D-028 · 2026-10-18 · Seven live-testing stages, without a calendar wait

Kanishk clarified: “day 1-7 should be like 7 phases of live testing” and “testing it yourself
while running real tasks.” This supersedes D-027's calendar-day requirement and the old
`daily-01` week-of-use wording. The seven stages in PHASE8.md can run back-to-back; evidence,
independent outcomes and regression-before-fix requirements remain. Recorded model misses,
site drift and barriers remain limitations, not capability passes. Keep dummy BYOK and synthetic
history per the owner's scope. No new dependency, top-level directory, runtime permission or
browser frontend is added. Historical Day 1 reports and already-frozen Stage 2 fixture bytes
retain their old calendar metadata for provenance; those fields no longer control acceptance.

## D-029 · 2026-10-18 · Distinct ranked URLs and explicit retrieval provenance

Stage 3's actual local proposal repeated the same RFC URL three times. A controlled browser
reproduction with valid citations and a focused unit test confirmed that the completion verifier
accepted duplicate URLs as distinct ranks. Require unique exact source URLs before accepting a
web/history result; citation-to-source binding already requires the canonical captured URL.
The gate does not repair model results, add destinations or relax source evidence. Preserve the
original live misses, then verify duplicate refusal and single-result success in source/compiled
fixtures and a separate real-source check.

Keep one fixed public-search probe separate from an independently predeclared assisted lane.
The latter uses a controlled candidate index with real public source reads; it cannot establish
public-search availability or retrieval quality. A challenge stops the public probe without a
retry, solver or engine switch. BYOK remains dummy emulation; actual local inference and TUI
outcomes remain separately scored. No dependency, top-level directory, search backend or task
permission is added. Subsequent live PRs stack on the preceding stage and stay unmerged until
Kanishk asks.
