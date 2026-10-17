# Phase 5 starter: terminal control surface

This is the first `tui-00` slice after Phase 4 merged at `5ee565e`. It replaces the old REPL
with an Ember scrollback TUI over the existing runtime. Phase 5 remains open for the complete
`tui-00`/`tui-01` criteria. See [the current contract](../../../PHASE5.md).

- `pnpm check`: **54 tests / 14 files pass**, including terminal control filtering, wrapped data
  prefixes, theme/NO_COLOR and existing architecture/CLI process checks. [Log](check.log).
- PTY plus real Chrome: **9 check groups pass**. [Report](pty-report.json), [log](pty.log).
- Existing compiled model/accounting and JSON/JSONL CLI fixture: **16 groups pass**.
  [Report](models-report.json), [log](models.log), [raw traces](model-runs/).
- [Manifest](manifest.json): tested source hashes, commands and environment. [Kit status](kit-status.json)
  confirms upstream identity/tokens and deliberate unused-file deletions; [design detector](design-detector.json)
  reports no mechanical findings (it is a web-oriented detector, not proof of terminal usability).

## PTY evidence

The fixture runs the compiled CLI with a synthetic loopback model service in real 100-column
and 40-column pseudo-terminals, resizes the narrow session to 60 columns, and drives Chrome
against controlled pages. The server independently records **exactly one saved Kolkata value**.
Denial, stale approval, cancellation, EOF and restart must not add a save. Tests use Python 3's
standard library; no terminal framework or new runtime package is installed.

The [recordings directory](recordings/) includes three `.cast` files and readable transcripts:

| Recording | Covered interaction |
|---|---|
| [controls](recordings/controls.cast) | Multiline task, live tool rows, answer, settings, sources, history/trace, pause/continue, Enter denial, stale-ID refusal, exact approval, injection and Ctrl-C |
| [narrow / NO_COLOR](recordings/narrow-no-color.cast) | Collapsed identity, resize, pending gate and EOF cancellation without a save |
| [reopened](recordings/reopened.cast) | Saved permissions/model, fresh capture and pause, stale approval refusal, new pending ID and Escape denial |

These are [asciicast v2](https://docs.asciinema.org/manual/asciicast/v2/) output/resize streams.
They record this synthetic fixture's output, not a personal session or separately captured input
stream. A compatible player can replay them. Raw runtime records remain alongside their session
under `recordings/*/runs/`. ANSI cursor/color sequences in the recordings come from the terminal
renderer; the attack strings are visibly escaped and cannot clear the screen or emit OSC 52.

The fixture first exposed an incorrect test assumption: the existing runtime ends a denied act
as blocked rather than automatically retrying it. The corrected test requires that blocked state,
checks zero saves, then starts a separate explicitly approved task. It also exposed Escape-prefix
timing consuming the next command's first character; the renderer now uses a 50 ms sequence
window and the test waits for the denial outcome before issuing another command. No action gate
was weakened. Reopen is tested after changing future-task model settings; HTTP must still use the
original saved model, and the terminal labels the saved run accurately. Buffered lines after
`/quit` are ignored and must cause no new model request. Task input over 6,000 characters is
rejected visibly rather than silently truncating the user's instructions.

## Scope and limits

No actual model inference is performed by this UI fixture. Hosted inference remains excluded as
requested. Phase 4's real local-model evidence is historical runtime evidence, not a claim of new
TUI model acceptance. Browser/session-disconnect measurement, personal-session attachment,
model-token streaming, 20 controlled ask tasks with passage citations, explicit source opening,
held-out sites and daily use remain open. Sources here are captured snapshots, not the finished
passage registry or `ask` ability. There is no browser frontend, auxiliary bridge or second loop.

```sh
pnpm check
pnpm eval:tui
node packages/agent/tests/models.browser.mjs
```

CI runs the inherited browser suites plus the PTY fixture and archives `.chromeclaw/phase5-terminal`
on success or failure. Local reports establish only the executions recorded here; CI status is
reported separately on the PR.
