# Build phases

Phase 0 was the repository audit, local preservation of `new`, defect reproductions and plans.
This file orders implementation. [BUG_FIX_PLAN.md](BUG_FIX_PLAN.md) and
[J123_BUILD_PLAN.md](J123_BUILD_PLAN.md) retain the task-level acceptance criteria. Phase gates
require integrated browser evidence, not documentation or unit tests alone. Kanishk decides what
merges; agents do not merge their own PRs.

| Phase | Scope | Tasks | Gate |
|---|---|---|---|
| 0 | Audit and planning | audit-00 | Complete. Pinned audit, archive bundle, 14 defect reproductions and plans |
| 1 | Trustworthy checks and fixture baseline | p1-01, maps to fix-00 | Check, CLI tests, package boundaries, skip rejection and independent browser-fixture oracle; wrong-world-state mutation must fail |
| 2 | Safety and observed targets | fix-01 through fix-03 | Credential protection, fresh numbered targets, fixed envelope, origin/commit gates and retained old safety regressions; zero unsafe fixture acts |
| 3 | Prompt/transport, history, lifecycle and recovery | fix-04 through fix-06, fix-08 | One egress, fenced inputs, useful history, pause/answer/approval/cancel, verified outcomes, bounded retries and truthful durable traces |
| 4 | BYOK and local models | fix-07, fix-09 | Same contracts and gates with an actual BYOK model and local server, no silent fallback; label any missing endpoint coverage |
| 5 | Terminal TUI | tui-00, tui-01 | Kit-based terminal frontend, settings, evidence, approvals and cancellation; PTY recording and browser fixture report |
| 6 | Grounding and page work | find-01, work-01 | J3a and J2 fixture sets, perturbations, attack set and model-specific results |
| 7 | Research and remaining find modes | research-01, find-02, find-03 | J1, J3b and J3c controlled outcomes, passage support, bounded history access and per-model reports |
| 8 | Live testing | live-01, includes daily-01 | Second-last phase. Held-out public sites, real BYOK/local models, seven days of bounded personal use, reviewed traces and regression cases |
| 9 | README and final presentation | readme-01 | Last phase. Beautiful, evidence-backed README for recruiters, researchers and engineers, with accurate setup and reproducible results |

## Progress

Phases 0 and 1 are merged into main through PRs #2 and #3. Phase 1 passed its 24 tests and three
browser fixtures locally and in hosted CI. See [the evidence](evidence/phase1/README.md).
Phase 2 is complete against its controlled browser gate: 28 tests, 3 baseline fixtures,
13 credential groups, 35 safety groups in source/compiled modes and 8 failing gate mutations.
It implements credential protection, fresh numbered targets, immutable task permissions,
origin/data-flow gates and exact approvals. The acceptance report and negative controls are in
[Phase 2 evidence](evidence/phase2/README.md). Phases 3 through 9 are pending. Credential
continuation, generic PII/egress handling and durable approvals remain Phase 3 work, as scoped
below; controlled scripted fixtures do not establish model quality or signed-in-site readiness.

## p1-01: Trustworthy checks and fixture baseline

Create `pnpm check`, run tests against source, add CLI process tests and reject skipped/todo tests.
Enforce the actual current dependency graph and prevent new network senders while documenting the
one legacy provider sender until Phase 3 moves it to egress. Do not pretend the future plugin
architecture exists already.

Replace incidental substring scores with known-answer or independently observed fixture outcomes.
Use isolated browser profiles and loopback fixture sites. Scripted smoke never measures model
quality. CI must fail for a wrong saved value, even if the agent says it finished, and archive
the report/traces on failure. Preserve the old audit evidence as historical, not a current score.

Done when: `pnpm check` passes, all controlled browser fixtures pass, a skipped/todo test causes
nonzero exit, and deliberately saving the wrong city produces a failed eval and nonzero process
status. Attach commands, raw report and JSONL. CI configuration being present does not prove the
hosted CI job ran.

## p2-01: Credential capture and driver protection

Port the relevant Blindfold credential metadata and refusal behavior into the existing driver,
with autocomplete token lists, safe labels and no field values in capture. Recheck at write time,
including focus-time changes. Block paste/keyboard and implicit-submit bypasses; withhold typed
values in action logs. Ordinary noncredential editing must still emit input/change events.

Done when: unit checks and the credential browser suite pass, synthetic stored values and
attempted write values stay out of runtime JSONL, credential/framed screenshots are withheld,
and password/OTP, textarea, shadow/frame, focus replacement and ordinary-edit cases have evidence.
This slice did not implement fresh numbering or fixed permissions; p2-02 supplies those.
General PII/egress handling and resumable hand-back remain explicit Phase 3 acceptance gaps.

## p2-02: Observed targets and fixed task permissions

Implements the Phase 2 portions of fix-02/fix-03. Replace selectors with offered target numbers
and snapshot IDs backed by retained node handles. Admit visible controls in document order,
report omitted targets and unreadable frames, and compare DOM metadata with native ARIA fixtures.
Recheck document, frame, geometry, metadata and ordinary form state immediately before acting.
Stale proposals recapture without replaying the act.

Freeze copied user permissions before page reads. Enforce tools, origins, reads/writes,
irreversible policy and step/time/cost limits. Parse schemes/hosts; gate redirects, popups and
browser requests. Deny cross-origin form/query/hash exports even between permitted origins.
Every activation, including an unknown control or Enter/Space on a button, needs exact approval.
Recheck state and permissions after approval, consume the target once and never let approval
widen the envelope. Missing callback hands back; durable waiting/resume stays in Phase 3.

Done when: `pnpm check`, the three baseline fixtures, 13 credential groups and the safety browser
matrix pass; the fixture servers record zero unsafe acts and zero requests at denied destinations.
Disabling each critical gate must break a browser assertion, and source files must be restored
byte-for-byte. Attach source/built runs, gate mutations and native ARIA/DOM comparison. Real
BYOK/local models, signed-in sites, arbitrary malicious-JavaScript isolation and DNS rebinding
are not established by this gate. See D-015 and SAFETY.md for conservative behavior and limits.

## live-01: Live testing, second-last

Earlier phases still run real browsers against controlled sites. Phase 8 adds held-out live-site
and daily-use testing; it does not postpone regression testing until the end. Use bounded,
approved tasks, separate fixture/live results, record site drift versus agent/model failures and
turn each daily-use failure into an eval before its fix. Fix failures and rerun affected gates
before starting Phase 9. Credentials, irreversible actions and private history retain their gates.

## readme-01: README, last

Write the finished presentation only after live evidence exists. Lead with what ChromeClaw does
and show the real terminal interface using the design-kit identity. Give recruiters a concise
problem/contribution/demo overview; give researchers task definitions, methodology, per-model
results, limits and reproducibility; give engineers setup, BYOK/local configuration, architecture,
safety boundaries, commands and contribution guidance. Use measured claims, recorded demos and
working links. Do not turn scripted smoke scores into capability claims or imply planned work
has shipped. Prefer a focused README with deeper technical material linked in docs.

Minimal factual command/status corrections may accompany implementation; visual polish and the
full README rewrite stay in Phase 9. No new phase is appended after live testing or the README;
new implementation work belongs in the relevant earlier phase and must pass its gate.
