# ChromeClaw

> **Building a terminal TUI.** The existing CLI is the implementation base for research, page work
> and find, with BYOK and local models. Follow [the phases](docs/BUILD_PLAN.md). The archived
> extension design is preserved locally on `new`. Runtime safety fixes remain open; do not treat
> the current baseline as unattended control of signed-in sites.

## Current baseline

A terminal-first browser agent, built May 2026. You give it a task. It opens Chrome through
Playwright, takes one action at a time, prints every step, and writes the run to a JSONL trace you
can inspect later.

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

Each step:

1. **Observe:** visible text plus a ranked list of interactive elements.
2. **Plan:** ask the planner for one action as JSON, validated with Zod.
3. **Check:** run a safety policy that allows, asks to confirm, or blocks.
4. **Act:** through Playwright.
5. **Log:** append the step to the run's JSONL file.

## Known runtime gaps

An audit on 2026-10-13 found the loop sound and the agent around it too thin to build on. The
implementation plan addresses these gaps:

- **The model saw too little.** Its history carried only each step's action type, never the URL it
  opened, the text it typed or what `extract_text` returned. The prompt held an 1,800-character
  summary and 8 elements without selectors.
- **The model wrote selectors,** and a resolver guessed what it meant. The rebuild has the model pick
  an index from a numbered list instead.
- **The accessibility snapshot stopped working.** Playwright 1.60 removed `page.accessibility`, so
  every run records it as unavailable.
- **There was no recovery.** One unresolved click or one malformed model reply ends the run.
  `ask_user` logs a line and carries on.
- **The safety policy is regexes with no word boundaries.** Two examples:
  - It blocks `finish` on a Wikipedia article about phishing, and asks to confirm any click when the
    task mentions "postgres".
  - It allows a click on an unlabelled button on a `/cart` page, and navigation to a router admin
    page.
- **The retired evals measured the loop, not the agent.** With the scripted mock planner, `eval --all` scored
  9 of 10. Five of those passed because the search results page title repeats the query that
  contains the expected word. The one safety task, "log in to my bank", failed.

The pinned findings are in [the main audit](docs/MAIN_AUDIT.md). Phase 1 replaces the legacy
eval scorer with controlled browser fixtures; the other runtime fixes remain pending.

## Running it

Needs Node 20.9 or later and pnpm. It drives your installed Google Chrome and falls back to
Playwright's Chromium if Chrome is not there.

```bash
pnpm install
pnpm build
pnpm exec playwright install chromium    # only if Google Chrome is not installed
```

```bash
node apps/cli/dist/index.js run "Open example.com and report the page title." --headless --provider mock
node apps/cli/dist/index.js repl              # interactive session
node apps/cli/dist/index.js runs              # recent runs
node apps/cli/dist/index.js show <run-id>     # one run's full trace
node apps/cli/dist/index.js eval --all        # all 3 controlled scripted smoke fixtures
pnpm eval                                     # the same fixtures, report and JSONL in .chromeclaw/eval
```

Last checked on 2026-10-13 on macOS with Node 24: it builds, typechecks and lints, all 15 tests pass,
and the example above runs.

## Planners

| Provider | Setup |
| --- | --- |
| `mock` | No key. Scripted, for smoke tests only. Its scores mean nothing |
| `openai` | `OPENAI_API_KEY`, and `OPENAI_BASE_URL` for any OpenAI-compatible server, including Ollama, LM Studio and `llama-server` |
| `huggingface` | `HF_TOKEN`, through Hugging Face's OpenAI-compatible router |
| `anthropic` | A placeholder that throws |

Copy `.env.example` to `.env` to set the provider, model, headless mode and step limit. The example
file sets `CHROMECLAW_PROVIDER=openai`, so without a key either set it to `mock` or pass
`--provider mock`.

## Layout

```text
apps/cli          run, repl, runs, show, eval
packages/agent    runtime loop, planners, safety policy, JSONL storage
packages/browser  Playwright control and page observation
packages/shared   Zod schemas, types, helpers
packages/evals    controlled fixture tasks and outcome scoring
docs              safety and eval notes, as written at the time
```

## License

MIT
