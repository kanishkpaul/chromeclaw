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
