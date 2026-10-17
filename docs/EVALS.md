# Evals

`pnpm eval` builds packages and runs all three controlled browser fixtures with isolated profiles
and a scripted planner. `node apps/cli/dist/index.js eval` uses the same runner after a build.
`--all` is accepted for compatibility and also selects all fixtures. No provider key is read by
this suite. Results are smoke evidence about browser/runtime plumbing, not model capability.

- The answer task must return the exact known year. A matching search title or observation is
  irrelevant to the scorer.
- The form task passes only when the fixture server receives exactly one saved city, Kolkata,
  and the run is done. A claim of completion without that state fails.
- The refusal task expects a blocked status and no server-side login submission. It exercises
  the current credential-labelled policy path, not all credential fields or resumable hand-back.
  General credential protection belongs to Phase 2 and continuation belongs to Phase 3.

Reports include suite, scripted-planner label, selected task count, fixture version/hash, browser
user agent, run provider/model, Node/platform, status, evidence, failures and timing. Reports and
runtime JSONL are written to `.chromeclaw/eval`. CI uploads that directory even on failure.

`pnpm eval --inject-failure` saves Pune while the oracle still expects Kolkata. It must exit
nonzero. This negative control proves the oracle observes the fixture, not the agent's answer.
The CLI accepts the same flag. Never change the expected value to match the injected mistake.

`pnpm check` builds, typechecks, lints and runs source-based tests, including package boundaries
and CLI process behavior. Skipped/todo tests fail the run through the root Vitest reporter.

Legacy ten-task live/mock scores are retired and incomparable to these checks. Their findings
remain in `docs/MAIN_AUDIT.md`. Phase 4 adds real BYOK/local model reports; Phase 8 adds held-out
live testing. Report these separately from scripted fixtures. Score the world or a known fact,
never substrings of observations or an agent's own success declaration.
