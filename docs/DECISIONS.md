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
