# Phase 5: terminal control surface

Phase 4 merged through PR #7 at `5ee565e`. Phase 5 starts with a reviewable `tui-00` slice;
this is not completion of Phase 5 or the J1/J2/J3 abilities. The original acceptance criteria
remain in [J123_BUILD_PLAN.md](J123_BUILD_PLAN.md).

```sh
pnpm build
node apps/cli/dist/index.js tui --provider local --model my-installed-model \
  --base-url http://127.0.0.1:11434/v1 --origin https://example.com
# repl remains an alias; run --json / --jsonl remain the scripting interface.
```

The TUI uses installed Ember tokens and ChromeClaw identity from [design](../design/README.md).
It uses native terminal scrollback and readline, with live durable crossing/step updates, safe
settings metadata and explicit pending states. Model adapters still return bounded action objects;
this slice does not implement streaming model tokens. Browser launch uses the existing owned
profile, never a personal default Chrome profile. No browser bridge is introduced.

| Input | Behavior |
|---|---|
| A task, then Enter | Run under CLI-selected model and fixed permissions |
| `/compose`, lines, `/send` | Multiline task, up to 6,000 characters; `/discard` clears the draft |
| `/settings` | Show selected endpoint/model/locality and task permissions, without keys |
| `/provider NAME`, `/model NAME`, `/endpoint URL` | Validate explicit settings for future tasks, only while idle |
| `/history`, `/trace` | Inspect steps and the last 40 filtered durable events |
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

## Evidence and remaining acceptance

`pnpm check` covers the terminal content boundary and existing CLI process contracts.
`pnpm eval:tui` builds and runs Python 3 standard-library PTY tests against a real Chrome fixture
and synthetic model HTTP service. It writes reports, raw traces and asciinema v2 recordings to
`.chromeclaw/phase5-terminal`. The fixture independently checks exactly one saved Kolkata value,
no save on denial/stale approval, answer continuation, cancellation, EOF/reopen, trace/source
inspection, terminal injection, resize and NO_COLOR. These are UI/driver mechanics, not model scores.

The full phase remains open for token-stream presentation, a measured authorized-session versus
owned-profile comparison, the 20 controlled `ask` tasks with passage-bound citations, explicit
source opening under origin permissions and separate actual local-model evidence. Hosted inference
testing remains excluded as requested. No held-out site or daily-use readiness is claimed.
