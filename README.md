# ChromeClaw

A terminal-first browser agent. You give it a task, it drives Chrome through
Playwright one action at a time, and every step is printed, logged to JSONL,
and replayable. A safety policy sits between the planner and the browser.

```text
$ node apps/cli/dist/index.js run "Go to example.com and tell me the page title." --headless --provider mock

ACT #0 navigate 1033ms
  reason Open the target page first so I can inspect its title.
  action https://example.com
  page  about:blank

DONE #1 finish 165ms
  reason The requested page is open and the title is visible in the browser state.
  action The page title is "Example Domain".
  page Example Domain https://example.com/

Final
DONE The page title is "Example Domain".
Run id: run_muflu8i6_fylw6wp
Trace: .chromeclaw/runs/run_muflu8i6_fylw6wp.jsonl
```

The point is inspectability: what the model saw, why it chose that element,
how to reproduce a failure, and what happens at logins, payments, and
destructive actions.

## How a step works

1. **Observe.** Build a structured snapshot of the page: visible text plus a
   ranked list of interactive elements.
2. **Plan.** Ask the planner for exactly one action as strict JSON, validated
   with Zod.
3. **Check.** Run the action and the task through the safety policy: `allow`,
   `confirm`, or `block`.
4. **Act.** Execute through Playwright.
5. **Log.** Append the observation, action, reason, and outcome to the run's
   JSONL file.

## Run it

Needs Node 20.9+ and pnpm. ChromeClaw drives your installed Google Chrome and
falls back to Playwright's Chromium if Chrome isn't there.

```bash
npm install -g pnpm                      # if you don't have it
pnpm install
pnpm build
pnpm exec playwright install chromium    # only if Google Chrome isn't installed
```

```bash
node apps/cli/dist/index.js run "Open example.com and report the page title." --headless --provider mock
node apps/cli/dist/index.js repl         # interactive session
node apps/cli/dist/index.js runs         # recent runs
node apps/cli/dist/index.js show <run-id>
```

Tested on macOS (Apple Silicon) with Node 24 and Chrome.

## Planners

| Provider | Setup |
| --- | --- |
| `mock` | No key. A scripted planner for smoke tests. |
| `openai` | `OPENAI_API_KEY`. Set `OPENAI_BASE_URL` for any OpenAI-compatible server, including local ones (Ollama, LM Studio, `llama-server`). |
| `huggingface` | `HF_TOKEN`, through Hugging Face's OpenAI-compatible router. |
| `anthropic` | Placeholder; not implemented yet. |

Copy `.env.example` to `.env` to configure the provider, model, headless mode,
and step limit.

## Safety model

The policy in [`packages/agent/src/safety.ts`](packages/agent/src/safety.ts)
blocks or asks for confirmation before:

- logging in or entering credentials
- sending messages, posts, or forms with personal data
- purchases, payments, banking, or checkout
- deleting, uploading, or downloading user data
- bypassing CAPTCHAs, paywalls, or login walls
- visiting browser-internal or local system pages

A `confirm` decision currently ends the run as `blocked` rather than pausing
for approval. Arbitrary JavaScript execution is disabled. See
[`docs/SAFETY.md`](docs/SAFETY.md).

## Evals

```bash
node apps/cli/dist/index.js eval          # first 3 tasks
node apps/cli/dist/index.js eval --all    # all 10
```

Tasks are in [`packages/evals/src/tasks.ts`](packages/evals/src/tasks.ts) and
the report goes to `.chromeclaw/eval-report.json` with success rate, steps,
duration, and failure reasons.

Two caveats before reading anything into the numbers:

- **The tasks hit live websites** (Hacker News, Wikipedia, DuckDuckGo), so
  results change with the sites.
- **Scoring is loose.** Most tasks pass if an expected substring appears in the
  answer *or anywhere in a page observation*, and some only check the URL
  visited. The scripted mock planner scores 3/3 on the default set without
  solving the Hacker News task. The loop is measurable; the scores aren't a
  benchmark yet.

## Repo layout

```text
apps/cli          CLI: run, repl, runs, show, eval
packages/agent    runtime loop, planners, safety policy, JSONL storage
packages/browser  Playwright control and page observation
packages/shared   Zod schemas, types, helpers
packages/evals    task definitions and scoring
docs              safety and eval notes
```

## Development

```bash
pnpm test        # vitest, 15 tests across 4 packages
pnpm lint
pnpm typecheck
```

On macOS, clone into a path without spaces. Vitest fails to resolve the
workspace packages from paths like `~/Library/Application Support/...`.

## License

MIT
