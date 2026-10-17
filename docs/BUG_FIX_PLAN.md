# Bug-fix plan

This plan applies to executable main at `50355b9`. Findings and reproductions are in
[MAIN_AUDIT.md](MAIN_AUDIT.md). Every task below is pending. Keep changes on task branches,
attach real-browser evidence and let Kanishk decide what merges.

Stabilize the existing implementation before adding jobs. Reject a wholesale merge of local
`new`: it removes working code. Also reject patching every selector fallback or adding task-word
regexes: those retain the causes of B02, B03 and B05.

## Order and dependencies

`fix-00 → fix-01 → fix-02 → fix-03 → fix-04 → fix-05 → fix-06 → fix-07 → fix-08 → fix-09`

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
- Correct the README's branch links, build output and eval defaults. Document the user-supplied
  engineering contract as active policy rather than treating the archived README as authority.

Done when: a deliberately wrong answer with a matching search title fails; blocked comparison
fails; the explicit login hand-back task passes only the expected hand-back; a broken fixture
fails CI; a real browser run and raw report are attached. Archive legacy scores as incomparable.

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

### fix-07: Correct provider and CLI configuration

Addresses B13, B17 and B18. Owns provider factory, configuration parsing and CLI commands.

- Parse settings once with schemas. Reject nonpositive/nonfinite step/time limits and absent
  required model configuration. Honor flag-over-environment-over-default precedence.
- `local` requires an explicit local endpoint; parse hostnames instead of substring matches.
  Validate key/destination pairing. Refuse an unavailable provider before opening the browser.
- Represent provider capabilities honestly. Keep Anthropic disabled/unavailable until implemented.
  Add clean JSON output and meaningful exit statuses for failed, stopped and awaiting-input runs.

Done when: CLI process tests cover each terminal state, option precedence, invalid budgets, hosted
model omissions, an attacker hostname containing localhost and local-without-endpoint. Provider
selection never silently crosses to a hosted endpoint. Attach a CLI browser smoke run.

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

## Scope after this plan

Keep the CLI as a working entry point and evaluation driver. Its repaired contracts and pure
decisions become the extension's shared core; its filesystem and Playwright I/O do not. The next
plan adds the Chrome shell and jobs, rather than maintaining two different autonomous loops.
