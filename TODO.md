# ChromeClaw MVP TODO

MVP: complete bounded browser tasks with an inspectable trace and meaningful user control.

This checklist tracks the current implementation branch; Phase 2 is in PR #4 until merged. Fix correctness before expanding features. Existing archive/rebuild notices may describe the previous branch layout; do not treat them as instructions to switch branches. Mark an item complete only after implementing it and verifying its behavior.

## What needs fixing

- [ ] Include actual targets, URLs, entered values, extracted results, and errors in planner history, with appropriate handling of sensitive values.
- [x] Replace model-invented selectors with selection from stable, numbered elements observed on the current page. Refresh observations when targets become stale.
- [x] Restore safe DOM accessibility observations, compared with supported native ARIA fixtures. Full accessible-name coverage remains limited.
- [ ] Recover from malformed model responses and unresolved targets with bounded retries and useful error feedback.
- [ ] Make `ask_user` pause execution, collect an answer, and provide it to the planner before continuing.
- [ ] Make confirmation decisions resumable after an explicit approval or denial, rather than terminating the run.
- [x] Replace broad task-keyword safety checks with checks on the proposed action, target, destination, and task permissions. Cover harmless-keyword false positives and consequential unlabelled controls.
- [x] Replace evaluation criteria based on incidental page-title matches with assertions about the requested outcome.

## What features to add

- [x] Add per-task allowed sites and action permissions, with approval gates for consequential submissions and changes.
- [ ] Detect loops and repeated unsuccessful actions, attempt a bounded recovery, and stop with a clear explanation when recovery fails.
- [ ] Require explicit completion checks backed by observed page evidence before declaring success.
- [ ] Add pause, resume, and cancel controls that preserve an accurate run status and trace.
- [ ] Add a trace viewer pairing observations, actions, results, screenshots, timings, and approval decisions.
- [ ] Add controlled evaluation tasks that exercise real model planners and verify resulting page state; retain mock tests as loop smoke tests.

Phase 2 evidence: [completion report](docs/evidence/phase2/completion/README.md). The runtime
callback checks exact approvals; durable terminal pause/resume remains unchecked above.
