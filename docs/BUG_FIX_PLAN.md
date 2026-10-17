# Bug-fix plan

This plan applies to executable main at `50355b9`. Findings and reproductions are in
[MAIN_AUDIT.md](MAIN_AUDIT.md). Task progress and phase gates are tracked in [BUILD_PLAN.md](BUILD_PLAN.md). Keep changes on task branches,
attach real-browser evidence and let Kanishk decide what merges. ChromeClaw lives fully in the
terminal as a TUI. BYOK hosted models and local models are required paths for every job.

Stabilize the existing implementation before adding jobs. Reject a wholesale merge of local
`new`: it removes working code. Also reject patching every selector fallback or adding task-word
regexes: those retain the causes of B02, B03 and B05.

## Engineering standard

Follow the engineering rules preserved at `new:docs/ENGINEERING.md`. Write code, comments and
commits as a senior engineer maintaining this code for another person:

- Choose the smallest clear implementation that meets the contract. If five readable lines solve
  the problem, do not write fifty. Do not compress away validation, safety or useful error handling.
- Add a module or abstraction only when it hides real complexity. Avoid speculative frameworks,
  forwarding wrappers, duplicate state, unused options and new dependencies without a reason.
- Use precise names, strict boundary types and explicit failure outcomes. Comments explain why,
  contracts, constraints or tradeoffs; delete narration, commented-out code and bare TODOs.
- Keep each commit focused. Use an imperative task-ID subject under 72 characters. The body states
  why, the rejected alternative, verification and what was not verified. No attribution trailers.
- Review the diff for unnecessary code before committing. Every bug fix gets the regression that
  would have caught it and evidence from the integrated browser path.

## Retain and upgrade existing safety

Inventory the old policy, prompt restrictions, schemas and tests before replacing them. Preserve
credential/login hand-back, CAPTCHA/paywall/security-bypass refusal, consequential-action approval,
restricted-destination checks and inspectable traces. Upgrade each boundary where the audit found
it ineffective. Keep a mapping from old protection to its replacement regression so a rewrite
cannot silently remove coverage. Reject task-keyword false positives without weakening the
underlying protection. Local models receive the same gates as BYOK hosted models.

## Order and dependencies

`fix-00 → fix-01 → fix-02 → fix-03 → fix-04 → fix-05 → fix-06 → fix-08 → fix-07 → fix-09`

This is delivery order, not a claim that every task depends on every previous file. In particular,
write the outcome assertions in fix-00 before interpreting later measurements. Do not broaden
autonomous access to signed-in sites until fix-01 through fix-06 pass their browser checks.

### fix-00: Make the baseline and commands honest

Addresses B11, B16 and B17's missing CLI coverage. Owns root scripts, the existing eval package,
README, test configuration and CI.

- Add `pnpm check` composing typecheck, lint, unit and architecture tests. Fail on skipped tests.
  Add actual CLI tests before removing `--passWithNoTests`.
- Introduce controlled fixture sites and independent state assertions. Separate mock smoke,
  fixture-model, perturbation, attack and live results. A blocked task passes only an explicit
  refusal/hand-back expectation, never ordinary task completion.
- Replace substring-oracle defaults. Record selected task count, adapter/model, fixture version,
  terminal status and failure classification. Exit nonzero on a required failed task.
- Correct the README's branch links, build output and eval defaults. Restore the applicable
  engineering contract from `new`, with the terminal-only product decision taking precedence over
  its side-panel requirements. Document the safety inventory and old-to-new regression mapping.

Done when: a deliberately wrong answer with a matching search title fails; blocked comparison
fails; the explicit credential-refusal smoke passes only a blocked status plus no submission;
resumable hand-back stays in fix-05; a broken fixture fails CI; a real browser run and raw report are attached. Archive legacy scores as incomparable.

### fix-01: Prevent credential capture and entry

Addresses B01 and B02. Owns browser capture/input, observation schemas, runtime admission and trace
serialization. This fix precedes expanding planner context, because more context would spread secrets.

- Carry credential metadata from input type and parsed autocomplete tokens. Never read credential
  values into target labels, page models, prompts, trace fields or screenshots offered to providers.
- Refuse credential typing in the driver too. Cover generic typing, active-element `press`, paste
  shortcuts and `submit: true`. Hand back for user input and resume from a fresh capture.
- Redact sensitive noncredential values at serialization and egress boundaries; retain references
  and provenance when tasks need to move ordinary user data. Define raw screenshot retention and
  export policy explicitly. Do not promise that a text scrubber sanitizes arbitrary pixels.

Done when: password, current-password, new-password and one-time-code fixtures preserve their
original values under every typing path, and synthetic markers are absent from all request/log
artifacts. Test mixed autocomplete token lists. Record an end-to-end hand-back demonstration once
fix-05 supplies continuation; until then this task's continuation acceptance remains open.

### fix-02: Bind acts to observed targets

Addresses B05 and B06. Owns browser capture/targets and shared reply/observation contracts.

- Add snapshot ID, document/frame identity, semantic roles, accessible names, bounds, credential
  flags and visibility/occlusion metadata. Fix the removed accessibility API using the installed
  browser's supported ARIA snapshot or CDP AX surface, measured against fixtures.
- Offer numbered targets backed by retained node handles. The model returns a number from the
  offered snapshot, never CSS, text fallback or coordinates. Revalidate the handle, document,
  visibility, occlusion and relevant control state immediately before acting.
- Cover labelled fields, shadow roots, same-origin frames and explicit unreadable cross-origin
  frames. Replace first-120-node loss with bounded capture that reports what it omitted.

Done when: duplicate labels require selection of a specific offered element; stale targets refuse
and trigger fresh capture; hidden/covered controls are not offered; credential flags survive;
fixtures identify the correct node under selector drift. Attach AX and DOM comparisons.

### fix-03: Admit only actions within fixed task permissions

Addresses B03 and part of B08. Owns pure permission/gate logic and its runtime/driver integration.

- Construct an immutable envelope before page reads. Include tools, permitted origins, read/write
  permissions, irreversible allowance and step/time/cost limits. Validate URL schemes, parsed
  origins, redirects, newly opened tabs and destinations reached through links or keyboard acts.
- Read metadata and the resolved control's role/name to gate commits. Model reasons and task
  keywords cannot grant permission. Keep credential refusal unconditional. Carry provenance for
  cross-origin writes. A query-string navigation can carry data and needs the same flow analysis.
- Approval describes one exact action, target, destination and relevant page state. Recheck all
  gates before execution. A page change invalidates approval; denial does not execute the action.
  Unknown consequential semantics need an explicit policy, with documented label limitations.

Done when: the synthetic transfer fixture cannot commit without approval; harmless PostgreSQL
reading is allowed; payment/post/delete and Enter-submit fixtures confirm; private/browser/local
destinations are refused except explicit loopback harness scope; cross-origin data movement cannot
pass through URL parameters. Mutating each gate makes an attack fixture fail. Record zero unsafe acts.

### fix-04: One prompt builder, one egress, useful history

Addresses B04, B07, B12 and B14's crossing record. Owns prompt construction, provider transport,
history schema and the new egress boundary. Record the package-boundary decision before adding it.

- Fence every page/search/history/source/model-derived value with provenance. Neutralize closing
  tags and model control tokens. Retain the fixed envelope outside untrusted data. Fencing helps
  formatting; the gates remain the authority.
- Represent history as typed action arguments, observed result, error, evidence references and
  gate outcome. Keep extraction notes across page changes. Reserve separate context budgets for
  task, targets and results rather than letting article text truncate all later sections.
- Move fetch to `packages/egress`. Validate response boundaries, set request/body limits and
  deadlines, propagate abort, bound 429/5xx retries and scrub diagnostic bodies. Record crossing
  destination, safe payload metadata and cost information before sending. No key in the trace.
- Provide the actual reply contract. Parse strictly with one documented fenced-block unwrap.
  Legacy conversion must be explicit and tested, not silent deletion of unknown properties.

Done when: the extraction fact in the audit survives in the next request; escaped fence/control
tokens remain data; a mock HTTP server sees only the approved payload; timeout, abort, malformed
body, missing content and 429 terminate or retry within their stated limits. Architecture tests
catch a second network sender. A real-browser run uses the HTTP test adapter. No paid model needed.

### fix-05: Pause, resume, deny and cancel as real states

Addresses B08 and B14. Owns runtime lifecycle, serialized run state and CLI control input.

- Use distinct running, awaiting-answer, awaiting-approval, paused, stopped, failed and done states.
  Awaiting input is not completion. Persist the pending proposal and the permission decision.
- `ask_user` waits for an answer, adds it to trusted user history and replans. Approval executes at
  most once after target/state revalidation. Denial records a user decision and replans or stops.
- Abort reaches model requests, waits and driver operations. Do not equate rejecting a promise
  with undoing a browser side effect. Check cancellation before every new act and report any act
  already in flight. Reopening a run recaptures and pauses before continuing.

Done when: a fixture pauses without another planner call, accepts an answer and completes; approval
and denial diverge correctly; stale approval and duplicate approval cannot execute; cancel during
HTTP wait and during action scheduling produces a truthful terminal trace and no subsequent acts.

### fix-06: Verify outcomes and bound recovery

Addresses B09 and B10. Owns the loop and deterministic expectation/result contracts.

- Observe after settling and check a concrete expectation such as field value, URL or known fact.
  Define which outcomes are verifiable and which require user judgment. A model saying `finish`
  does not satisfy an outcome predicate. Read-only answers cite captured evidence.
- On a transient no-change outcome, allow one safe retry where repeat execution is known safe;
  otherwise reobserve and replan with the failure. Never blindly retry a possible commit. Stop
  after three identical unsuccessful proposals and on independent time/step/cost budgets.
- Keep outcomes such as uncertain, handed-back and stopped separate from verified completion.
  Distinguish model parse repair from task recovery and cap both.

Done when: false completion on a blank page fails; a six-step form reaches its independent final
state. Selector drift, duplicate targets, session expiry, a modal, 429 and an irreversible step
all produce recorded outcomes. Ambiguous commit acknowledgment pauses instead of duplicating it.

### fix-07: Make BYOK and local configuration work end to end

Addresses B13, B17 and B18. Owns provider factory, configuration parsing and CLI commands.

- Parse settings once with schemas. Reject nonpositive/nonfinite step/time limits and absent
  required model configuration. Honor flag-over-environment-over-default precedence.
- `local` requires an explicit local endpoint; parse hostnames instead of substring matches.
  Validate key/destination pairing. Refuse an unavailable provider before opening the browser.
- Make BYOK explicit: user-selected provider/base URL, model and key, with OpenAI-compatible hosted
  endpoints and independently implemented adapters where protocols differ. Support local servers
  such as Ollama, LM Studio and llama.cpp through their compatible API. Do not bundle a hosted key.
- Run the same job protocol, safety gates and trace paths in both modes. A local failure never
  falls back to a hosted model. Show model, endpoint and local/hosted status in the terminal before
  the run. Keys and authorization headers never enter prompts, console output or traces.
- Represent provider capabilities honestly. Keep Anthropic disabled/unavailable until implemented.
  Add clean JSON/JSONL output and meaningful exit statuses for failed, stopped and awaiting-input
  runs. No TUI decorations in machine-readable output.

Done when: CLI process tests cover each terminal state, option precedence, invalid budgets, hosted
model omissions, an attacker hostname containing localhost and local-without-endpoint. Provider
selection never silently crosses to a hosted endpoint. Attach browser smoke runs through one
configured BYOK hosted adapter and one actual local model server, reported separately. Simulated
HTTP transport tests do not count as model compatibility. If either real endpoint is unavailable,
keep its acceptance check open; do not use credentials or make paid calls merely to edit this plan.

Phase 4 implementation and controlled acceptance: [completion evidence](evidence/phase4/completion/README.md).
Hosted inference acceptance is explicitly waived by Kanishk for this session and remains
unverified; synthetic HTTP results do not establish hosted compatibility. Actual local results
are model/server/protocol specific. The original endpoint criterion above is retained for clarity.

### fix-08: Make traces and storage explain failures

Addresses B14 and B15. Owns JSONL persistence, trace schema and error/cleanup lifecycle.

- Log proposals, permission decisions, before/after observation references and safe results as
  distinct events. Record provider/model/configuration and failure timing. Keep secret filtering
  at the boundary; do not duplicate entire mutable run objects after every event.
- Validate run IDs and storage records. Recover complete lines from an interrupted file, report
  a corrupt tail, and distinguish not-found from permission/parse failure. Constrain paths to
  the run directory and test traversal attempts.
- Include startup and close failures in the trace where storage permits it. Preserve the original
  failure when cleanup also fails. State honestly when storage itself prevented recording.

Done when: kill/restart and corrupt-tail fixtures retain readable events; failures name the
proposal that failed; outside-directory IDs refuse; synthetic secrets remain absent. A reviewer
can reconstruct a failed browser run from the exported trace without the terminal session.

### fix-09: Establish the bug-fix release gate

Owns the combined fixture report and reconciliation of `TODO.md`, README and active policy docs.
Do not check off a task because its proposed implementation exists.

Done when: `pnpm check` passes, architecture mutations are caught, all required controlled outcomes
pass, attack fixtures record zero unsafe acts, and all six perturbations have reports. Report
scripted smoke and real-model results separately. Run at least one configured real adapter on a
bounded fixture set with the owner's chosen endpoint/budget before claiming model-backed
readiness. If unavailable, keep that gate open and say so. Live held-out tasks remain separate.

The Phase 4 controlled gate is recorded in [completion evidence](evidence/phase4/completion/README.md).
It preserves inherited perturbation/attack fixtures and reports actual local inference separately.
Historical Phase 2 gate mutations are linked rather than presented as newly rerun mutations.
Hosted testing is waived; this is not a general model-quality or live-site release claim.

## Scope after this plan

The terminal TUI is the product frontend. Keep one-shot CLI commands and JSON/JSONL for automation.
The repaired runtime powers J1, J2 and J3 from that same terminal application. Extract pure core,
page capture or egress modules only where they enforce a real boundary; filesystem and Playwright
I/O stay in adapters. Follow [J123_BUILD_PLAN.md](J123_BUILD_PLAN.md) for the TUI and job delivery.
Reuse the local `../design-kit` and the preserved `new:design/` assets for terminal presentation.
