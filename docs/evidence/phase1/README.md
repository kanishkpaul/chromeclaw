# Phase 1 evidence

This phase implements trustworthy checks and scripted browser smoke evaluation, not the later
safety/runtime/TUI features. `docs/BUILD_PLAN.md` controls the phases. The original audit remains
historical evidence under `docs/audit-2026-10-17/`.

## Observed checks

- `pnpm check`: build, typecheck, lint and 24 tests passed, including three CLI process tests and
  current package-boundary checks. Full output: `check.log`.
- `pnpm eval`: all three loopback browser fixtures passed with isolated profiles. Report and
  runtime JSONL: `passing/`; command output: `eval.log`. This is scripted smoke only.
- Wrong-city control: the runtime reported done after saving Pune, while the independent server
  oracle expected Kolkata. The form result failed and the process exited 1. Report/JSONL:
  `wrong-city/`; command output: `wrong-city.log`.
- A temporary test file containing skip, todo and runtime skip was rejected with exit 1 and the
  root reporter's diagnostic. It was removed afterward. Output: `skip-negative.log`.
- A temporary production fetch in the browser package made the architecture test fail with exit
  1. It was removed afterward. Output: `architecture-negative.log`.

Negative eval command, after building:

```js
import { runEvaluationCli } from './packages/evals/dist/index.js';
await runEvaluationCli({ injectFailure: true, outputDir: '.chromeclaw/eval-negative' });
```

Run that with `node --input-type=module`. `pnpm eval --inject-failure` and the built CLI's
`eval --inject-failure` select the same negative control. Keep its output separate from a passing
baseline when retaining evidence. Result run IDs identify JSONL files in the corresponding runs
folder; reports record browser user agent, Node/platform, fixture version/hash and planner/model.

## Blindfold reuse

Adapted sorted result ordering and explicit corpus/task-count reporting from pinned upstream
`2f04984` (`eval/src/report-json.ts`). Executed that exact upstream module with sample results and
verified ordering, count and repeat serialization before adapting the behavior. Also adapted
its minimal checkout/setup/check/artifact workflow pattern. Did not copy its live-site substring
assertions, extension harness, model downloads or its dependency graph. The complete upstream test
suite was not run. Ports of credential handling and other runtime code belong to Phase 2 onward.

## Gaps

No real model, hosted endpoint or local inference server was exercised. This suite does not prove
J1/J2/J3 capability, generic credential protection, resumable hand-back, a working TUI or live-site
reliability. The old runtime's unsafe behavior remains open in Phase 2. The local report is not
proof that GitHub Actions ran; hosted CI status is checked separately on the PR. Final README
presentation belongs to Phase 9; this change corrects only stale status/command references.
