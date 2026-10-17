# Phase 5: terminal control surface

Phase 4 merged through PR #7 at `5ee565e`; the terminal starter merged through PR #8 at
`4d09383`. Phase 5 implements `tui-00` and `tui-01` against controlled fixtures, with hosted
inference explicitly waived by Kanishk. This is not completion of J1/J2/J3 or held-out live testing.
The acceptance criteria remain in [J123_BUILD_PLAN.md](J123_BUILD_PLAN.md).

```sh
pnpm build
node apps/cli/dist/index.js tui --provider local --model my-installed-model \
  --base-url http://127.0.0.1:11434/v1 --origin https://example.com
# repl remains an alias; run --json / --jsonl remain the scripting interface.
```

The TUI uses installed Ember tokens and ChromeClaw identity from [design](../design/README.md).
It uses native terminal scrollback and readline, with live durable crossing/step updates, safe
settings metadata and explicit pending states. Model adapters receive bounded SSE streams through egress. Live progress shows received byte
counts; complete replies are validated before displaying an answer or dispatching an action.
Raw partial proposal tokens are withheld because they can contain split credentials or invalid acts. Browser launch uses the existing owned
profile, never a personal default Chrome profile. No browser bridge is introduced.

| Input | Behavior |
|---|---|
| A task, then Enter | Run under CLI-selected model and fixed permissions |
| `/compose`, lines, `/send` | Multiline task, up to 6,000 characters; `/discard` clears the draft |
| `/settings` | Show selected endpoint/model/locality and task permissions, without keys |
| `/provider NAME`, `/model NAME`, `/endpoint URL` | Validate explicit settings for future tasks, only while idle |
| `/history`, `/trace` | Inspect steps and the last 40 filtered durable events |
| `/ask URL question` | Open the explicit permitted page, then ask using captured visible passages; writes are disabled |
| `/passage ID`, `/open ID`, `/close-source` | Inspect a stored passage; explicitly open its cited page in a separate guarded owned window; close that window |
| `/sources`, `/source N` | List captured snapshots and inspect their stored content locally |
| `/approve ID` | Approve the current exact pending action once; stale IDs refuse |
| Enter, Esc, `/deny` at a gate | Deny; the runtime records the resulting blocked outcome |
| `/answer TEXT` | Answer a noncredential question |
| `/continue` | Continue manual credential hand-back or a fresh-capture pause |
| `/pause`, `/cancel` | Request pause before another act, or cancel without promising rollback |
| `/resume ID` | Reopen the saved envelope, recapture and pause before another model call |
| Ctrl-C | Cancel active work while retaining the session; idle Ctrl-C exits |
| EOF, `/quit` | Cancel active work and close the terminal session |

Settings/permission inspection never authorizes additional acts. Readline history is disabled;
there is no key-entry command or task-wide approval. Logs and source text remain local until an
explicit model task uses the normal egress boundary. Content controls, bidi overrides and line
breaks render visibly inside prefixed data rows; they cannot operate the terminal or redraw a
gate. Native readline supplies cursor editing. Themes accept `--theme auto|dark|light` and
`--color auto|always|never`, with `CHROMECLAW_THEME`, COLORFGBG and NO_COLOR support. TERM=dumb or
non-TTY invocation refuses with a plain explanation and exit 2, before opening a browser.

Starter-slice reports, PTY recordings and traces: [acceptance evidence](evidence/phase5/terminal-start/README.md).

## Grounded ask

Ask opens only the explicitly selected HTTP(S) page without query/fragment data. It intersects
existing tool permissions with reads, disables writes/irreversible acts and refuses model navigation
to another page. The bounded reader visits currently visible document text, open shadows and
readable same-origin frames. It excludes form values, hidden/covered/offscreen text and reports
canvas/foreign frames as unreadable. It does not scroll, perform OCR or infer virtualized items.

Every passage has a snapshot-bound ID. A successful answer must be an exact captured extract with
resolvable citation IDs and quotes. This checks extractive support, not arbitrary semantic claims.
`/passage` inspects the saved capture; `/open` loads its cited URL only within the original
read/origin/expiry permissions. A live page can change after capture; opening it does not reverify
an answer. The source window must close before starting another task.

```sh
node apps/cli/dist/index.js run 'What is the release year?' --ask https://example.com \
  --origin https://example.com --provider local --model my-installed-model \
  --base-url http://127.0.0.1:11434/v1 --stream
# TUI enables streaming by default; --no-stream supports JSON-only servers.
# CHROMECLAW_STREAM=true|false also configures the transport.
```

## Acceptance and limits

`pnpm eval:tui` drives the compiled TUI through real PTYs, isolated Chrome and synthetic HTTP
inference. It independently checks exactly one saved Kolkata value, denial/stale IDs, answers,
source/trace inspection, pause/reopen, cancellation, EOF, resize, NO_COLOR, terminal injection,
long streams and browser disconnection. `pnpm eval:ask` checks 20 independently labelled cases,
plus invalid citations, forbidden writes and explicit source opening. Use `--built` directly on
the ask script to test compiled packages. `pnpm eval:session` measures persistent owned profiles
and an explicitly debuggable disposable CDP session; it never attaches to personal Chrome.
Owned profiles remain the production choice because CDP session ownership needs further scoping.

`pnpm eval:ask-local` requires explicit `CHROMECLAW_TEST_LOCAL_URL` and
`CHROMECLAW_TEST_LOCAL_MODEL` and performs actual inference without downloading a model. `pnpm eval:tui-local` uses the same
explicit configuration for an actual-model PTY answer, citation/trace inspection and source opening.
Controlled fixtures are development acceptance, not held-out model quality or daily-use readiness.
Hosted inference remains unverified by explicit waiver. Local results are specific to the recorded
server/model/protocol. The earlier ordinary `run` surface retains its explicitly granted write
mode; no final profile registry or automatic model-readiness approval is claimed.

Reports, recordings, traces, development failures and model provenance are in
[Phase 5 completion evidence](evidence/phase5/completion/README.md). The starter evidence remains
[separately preserved](evidence/phase5/terminal-start/README.md). Phases 6–9 remain pending;
Phase 8 is live testing and Phase 9 is the final evidence-backed README.
