# ChromeClaw MVP TODO

MVP: complete bounded browser tasks with an inspectable trace and meaningful user control.

This checklist tracks the current implementation branch. Phase 2 merged through PR #4; Phase 3 evidence is linked below. Fix correctness before expanding features. Existing archive/rebuild notices may describe the previous branch layout; do not treat them as instructions to switch branches. Mark an item complete only after implementing it and verifying its behavior.

## What needs fixing

- [x] Include actual targets, URLs, entered values, extracted results, and errors in planner history, with appropriate handling of sensitive values.
- [x] Replace model-invented selectors with selection from stable, numbered elements observed on the current page. Refresh observations when targets become stale.
- [x] Restore safe DOM accessibility observations, compared with supported native ARIA fixtures. Full accessible-name coverage remains limited.
- [x] Recover from malformed model responses and unresolved targets with bounded retries and useful error feedback.
- [x] Make `ask_user` pause execution, collect an answer, and provide it to the planner before continuing.
- [x] Make confirmation decisions resumable after an explicit approval or denial, rather than terminating the run.
- [x] Replace broad task-keyword safety checks with checks on the proposed action, target, destination, and task permissions. Cover harmless-keyword false positives and consequential unlabelled controls.
- [x] Replace evaluation criteria based on incidental page-title matches with assertions about the requested outcome.

## What features to add

- [x] Add per-task allowed sites and action permissions, with approval gates for consequential submissions and changes.
- [x] Detect loops and repeated unsuccessful actions, attempt a bounded recovery, and stop with a clear explanation when recovery fails.
- [x] Require explicit completion checks backed by observed page evidence before declaring success.
- [x] Add pause, resume, and cancel controls that preserve an accurate run status and trace.
- [ ] Add a trace viewer pairing observations, actions, results, screenshots, timings, and approval decisions.
- [x] Add controlled evaluation tasks that exercise a real local model planner and verify resulting page state; retain mock tests as loop smoke tests. Hosted model testing is waived and unverified.

Phase 2 evidence: [completion report](docs/evidence/phase2/completion/README.md). Phase 3 evidence:
[runtime report](docs/evidence/phase3/README.md). History withholds typed values and registered
sensitive content. Completion requires a trusted world predicate or exact extractive grounding;
other outcomes remain uncertain. These controlled fixtures do not establish real-model quality.

Phase 4 model/server-specific acceptance and accounting limits: [completion evidence](docs/evidence/phase4/completion/README.md).
Phase 5 adds a local TUI trace/source inspector, passage-grounded ask and explicit source opening.
The richer screenshot/timing trace viewer above remains open. Held-out testing and final README
remain Phases 8 and 9. See [Phase 5 evidence](docs/evidence/phase5/completion/README.md).

Phase 6 implements `/find` / `run --find`, labelled ranking reports and nine independent browser
tool plugins. Twenty scripted workflows pass through the TUI with independent state checks.
Actual local-model outcomes, misses and interventions are reported separately; this is controlled
engineering acceptance, not reliable autonomous or held-out capability. See
[Phase 6 scope](docs/PHASE6.md) and [evidence](docs/evidence/phase6/completion/README.md).

Phase 7 completion adds fixed-query research, ranked source URLs and selected JSON history/bookmark
lookup through the TUI and machine-readable CLI. History filtering makes no model requests and
reads no live personal profile. Controlled and actual-local results, seeded recollections and
remaining limits are in [completion evidence](docs/evidence/phase7/completion/README.md) and
[the contract](docs/PHASE7.md). Live testing and final presentation remain Phases 8 and 9.

Phase 8 has started with a bounded public-site pilot, dummy BYOK wire emulation and cached local
inference. Original failed attempts and controlled regressions remain evidence. The seven-day
bounded-use gate is open; Phase 9 has not started. See [the live-testing contract](docs/PHASE8.md).
