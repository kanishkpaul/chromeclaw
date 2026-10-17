# ChromeClaw

> **Building a terminal TUI.** The existing CLI is the implementation base for research, page work
> and find, with BYOK and local models. Follow [the phases](docs/BUILD_PLAN.md). The archived
> extension design is preserved locally on `new`. Controlled fixture results do not establish
> unattended control of signed-in sites. Phase 2 adds snapshot-bound targets
> and fixed permissions. Phase 4 adds explicit local/BYOK selection and pre-send reservations; hosted inference testing is intentionally unverified.

## Current baseline

A terminal-first browser agent, built May 2026. You give it a task. It opens Chrome through
Playwright, takes one action at a time, prints every step, and writes the run to a JSONL trace you
can inspect later.

The output below is historical. The command now requires an explicit permitted origin.

```text
$ node apps/cli/dist/index.js run "Go to example.com and tell me the page title." --headless --provider mock --origin https://example.com

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

1. **Observe:** visible text plus a bounded numbered list of offered controls.
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

These are historical audit findings. Phase 1 replaced the legacy scorer. Phase 2 replaces
selector fallback and keyword-only action gates with snapshot-bound targets, fixed permissions
and exact approvals. Native ARIA fixtures check the safe DOM role/name subset.
Phase 3 adds confined history, bounded transport, resumable hand-back, cancellation and explicit
outcome verification. Phase 4 tests local model compatibility separately from scripted checks. [Phase 4 evidence](docs/evidence/phase4/completion/README.md) includes actual local inference and accounting limits. Full TUI and job acceptance remain in later phases.
See [the audit](docs/MAIN_AUDIT.md), [safety limits](docs/SAFETY.md) and [phase evidence](docs/evidence/phase2/README.md).

## Running it

Needs Node 20.9 or later and pnpm. It drives your installed Google Chrome and falls back to
Playwright's Chromium if Chrome is not there.

```bash
pnpm install
pnpm build
pnpm exec playwright install chromium    # only if Google Chrome is not installed
```

```bash
node apps/cli/dist/index.js run "Open example.com and report the page title." --headless --provider mock --origin https://example.com
node apps/cli/dist/index.js repl --origin https://example.com  # bounded interactive session
node apps/cli/dist/index.js runs              # recent runs
node apps/cli/dist/index.js show <run-id>     # one run's full trace
node apps/cli/dist/index.js resume <run-id> --interactive  # recapture, then ask before planning
node apps/cli/dist/index.js eval --all        # all 3 controlled scripted smoke fixtures
pnpm eval                                     # the same fixtures, report and JSONL in .chromeclaw/eval
```

`--origin` fixes the permitted HTTP(S) origins before page reads. Default runs have no origins
and no write permission. `--write` permits ordinary field editing; consequential activation
still hands back in the current CLI. Basic controls use `run --interactive --allow-commit` and `resume <run-id> --interactive`;
approval is once-only and defaults to denial. `run --json` is undecorated. The full TUI remains Phase 5. See [EVALS.md](docs/EVALS.md) for current checks.

## Planners

| Provider | Setup |
| --- | --- |
| `mock` | No key. Scripted smoke only |
| `local` | Explicit `CHROMECLAW_LOCAL_BASE_URL` and model; optional `CHROMECLAW_LOCAL_API_KEY` |
| `openai`, `openai-compatible` | Explicit model/key/endpoint, positive `--max-cost` and declared `--request-cost` |
| `huggingface`, `hf` | Selected HF key/endpoint and the same reservation requirements |
| `anthropic` | Unavailable; refuses before Chrome opens |

`config --json` inspects selection without keys or network requests. `run --jsonl` streams durable
events and a final result; SIGINT stops the runtime. Zero task cost permits configured local
inference; it never means unlimited hosted spending. A local failure cannot select a hosted
provider. Compatible means the implemented JSON-mode Chat Completions subset, not every model
or server. Tested llama.cpp uses explicit `--response-format llama-schema`. Hosted inference testing is skipped; Ollama and LM Studio remain unverified. See
[the Phase 4 contract](docs/PHASE4.md) for settings, limits and accounting assumptions.

Copy `.env.example` to `.env`. It defaults to mock. Selecting a local model does not grant any
browser origin; a controlled loopback page requires `--allow-loopback` and an explicit `--origin`.
A first kit-based TUI slice is available as `tui` (`repl` alias); see [Phase 5](docs/PHASE5.md)
for controls and remaining acceptance. Final README presentation remains Phase 9.

## Layout

```text
apps/cli          run, repl, runs, show, eval
packages/agent    runtime loop, planners, safety policy, JSONL storage
packages/browser  Playwright control and page observation
packages/shared   Zod schemas, types, permissions and privacy
packages/egress   bounded application HTTP and crossing records
packages/evals    controlled fixture tasks and outcome scoring
docs              safety and eval notes, as written at the time
```

## License

MIT
