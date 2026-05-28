# ChromeClaw

ChromeClaw is a terminal-first browser agent for running web tasks with visible traces, explicit safety gates, and a small eval loop.

I built it as a practical agent systems repo, not as a "magic browser AI" demo. The main idea is that browser automation gets more useful when planning, execution, failure, and recovery are all inspectable.

```bash
chromeclaw run "Go to example.com and tell me the page title." --headless --provider mock
```

## What it does today

- Accepts a browser task from the CLI
- Observes the page through structured snapshots and visible text
- Plans one strict JSON action at a time
- Executes the action through Playwright
- Logs the full run to JSONL for later inspection
- Replays recent runs from the terminal
- Supports a mock planner for cheap smoke tests
- Includes an eval harness for browser-task benchmarking
- Applies a safety policy before sensitive or risky actions

## Why this project matters

A lot of agent demos look impressive until you ask basic systems questions:

- What exactly did the model see?
- Why did it click that element?
- How do you reproduce a failure?
- What happens around login, payments, or destructive actions?

ChromeClaw is my answer to those questions. It is a browser agent scaffold that makes traces, safety, and evaluation first-class instead of afterthoughts.

## Repo layout

```text
apps/cli          CLI surface: run, repl, runs, show, eval
packages/agent    Runtime loop, planners, safety, JSONL storage
packages/browser  Playwright control and observation building
packages/shared   Shared schemas, types, and helpers
packages/evals    Task definitions and scoring
docs              Notes on safety and evaluation
```

## Local setup

```bash
pnpm install
pnpm build
pnpm dev
```

Useful commands:

```bash
node apps/cli/dist/index.js run "Open example.com and report the page title." --headless --provider mock --max-steps 4
node apps/cli/dist/index.js runs
node apps/cli/dist/index.js show <run-id>
pnpm test
pnpm eval
```

## Configuration

ChromeClaw supports mock mode, OpenAI-compatible endpoints, and Hugging Face's router API through environment variables.

The quickest zero-key path is:

```env
CHROMECLAW_PROVIDER=mock
```

For real planner calls, start from `.env.example`.

## Safety model

ChromeClaw is intentionally conservative around:

- logins and credentials
- purchases and payments
- sending or publishing content
- destructive edits or file/system pages
- attempts to bypass access controls

Instead of pretending those edge cases do not exist, the runtime blocks or requires confirmation when a task crosses those boundaries.

## Evaluation

The repo includes a small deterministic benchmark harness in `packages/evals`.

- Mock mode keeps the basic loop testable without paid model keys.
- Eval runs emit a report with success rate, step count, and failure reasons.
- The goal is not to claim solved browser autonomy; it is to make iteration measurable.

## Current gaps

- Anthropic support is still a placeholder
- Confirmation is surfaced as a blocked run instead of a full approval workflow
- JSONL is the default storage path; a richer persistence layer can come later
- Arbitrary JavaScript execution is intentionally disabled for now

## What I am exploring next

- Better recovery after ambiguous page states
- More grounded element selection and ranking
- Richer eval tasks and failure taxonomies
- Interactive approval flows for sensitive actions
- Cleaner trace visualization outside the terminal

## Why it belongs in this repo collection

ChromeClaw shows how I think about agents as systems work: tools, traces, safety, evals, and failure handling, not just prompt wrappers around browser clicks.
