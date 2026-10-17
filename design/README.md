# ChromeClaw terminal direction

ChromeClaw's entire control surface lives in the terminal. Chrome is the work surface.
This direction supersedes the archived side-panel direction at `new:design/README.md`.

- Identity: ChromeClaw, glyph ⋔, Ember skin, light kawaii in optional waiting indicators only.
- Inherit the master terminal grammar from [system/TUI.md](system/TUI.md). TypeScript reads
  the installed [tokens/tokens.json](tokens/tokens.json); it does not copy a palette into code.
- Use native terminal typography and scrollback. A banner appears once in interactive sessions,
  collapsing to the wordmark when narrow. Tool rows use ┊ and aligned verbs. Gates alone are boxed.
- Every gate names the exact action, destination and reason. Deny is always available; Enter never
  approves. Approval is bound to the current pending ID. There is no always-approve command.
- Quote untrusted content, show control characters visibly and wrap it inside its data row.
  Page/model strings cannot add terminal instructions or impersonate trusted gate rows.
- Name the provider, model, locality and pending state. Never invent context percentages or prices.
  Honor NO_COLOR, TERM=dumb, terminal width, and explicit light/dark and color preferences.
- Keep JSON/JSONL free of decoration. A noninteractive TUI invocation explains the one-shot commands
  and starts no browser. Sources and trace inspection remain local and use filtered runtime records.

The kit was installed with `kit init . --project chromeclaw --skin ember`. Its manifest retains
upstream fingerprints. Unused Rust, web-CSS and Hermes output was intentionally removed; kit
updates preserve these deletions. Shared changes belong in the master. This project direction is
ignored by kit updates. The first slice is a scrollback control surface, not completed J1/J2/J3.
