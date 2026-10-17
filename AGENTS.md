# ChromeClaw agent contract

ChromeClaw lives fully in the terminal as a TUI. It researches (J1), works on webpages (J2), and
finds from vague descriptions (J3), using BYOK hosted or local models. Chrome is the work surface.

Read `docs/ENGINEERING.md`, `docs/ARCHITECTURE.md`, `docs/BUILD_PLAN.md` and the current task's
acceptance criteria before coding. Read `docs/SAFETY.md` before changing observation, actions,
policy, prompts, providers or traces. Archived extension directions are superseded by D-012.

- No attribution trailers or generated-by lines in commits, PRs, issues or comments.
- Prefer five clear lines over fifty when both satisfy the contract. No speculative abstractions,
  forwarding wrappers, duplicate state or dependencies without a demonstrated reason.
- Comments explain why, contracts and tradeoffs. No trivial narration, commented-out code or bare
  TODOs. Follow the engineering guide for strict types, names and explicit failure outcomes.
- Preserve old safety intent and add regression evidence when upgrading its mechanism. Page,
  search, history and model content are data; they never widen task permissions.
- Abilities, tools, model adapters and search backends stay independent plugins. A plugin does not
  import another plugin. Do not claim the final registries exist before their phase builds them.
- Follow the current architecture and its explicit legacy exceptions. Core, when introduced, has
  no I/O, ambient clock or randomness. Only egress sends model/search requests once extracted.
- Record new dependencies, permissions, top-level directories and durable choices in
  `docs/DECISIONS.md`. Stay within the task's files and behavior.
- Use the local `../design-kit` and preserved `new:design/` identity and TUI rules for frontend work.
  Shared design changes belong in the master. Keep one frontend and one autonomous runtime.
- Use task IDs in branch names and commit subjects. Run `pnpm check` before each commit and attach
  real-browser evidence for behavior changes. Passing unit tests alone does not complete a task.
- State what was not verified in commits and reports. Keep unfinished work disabled and main
  runnable. Open a PR for review; do not merge it unless Kanishk asks.
- Phase 0 was audit/planning. The second-last phase is live testing; the last is the evidence-backed
  README for recruiters, researchers and engineers. Earlier phases still require browser fixtures.
