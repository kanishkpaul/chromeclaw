# Contributing to ChromeClaw

[AGENTS.md](AGENTS.md) is the contract for anyone, human or agent, writing code here, and
[ENGINEERING.md](docs/ENGINEERING.md) is how code, comments and tests are written.

## Development

```bash
pnpm install
pnpm build
pnpm check        # build, strict types, lint and tests; run before every commit
```

Browser suites run real Chrome against local fixtures: `pnpm eval:safety`, `pnpm eval:runtime`,
`pnpm eval:find`, `pnpm eval:work`, `pnpm eval:live-regressions` and the others in `package.json`.

## Principles

- Page, search, history and model content are data. They never widen a task's permissions.
- Preserve each safety protection's intent when changing its mechanism, with regression evidence.
- Reproduce a defect in a controlled test before fixing it, and keep the failing run.
- Score the world, not the agent's own output. Never change a label to make a run pass.
- Tools, model adapters and search backends are plugins; a plugin never imports another.
- Record new dependencies, permissions and durable choices in [DECISIONS.md](docs/DECISIONS.md).

## Pull requests

- Use the task ID in the branch name and commit subject, for example `live-01: ...`.
- Say what changed, why, what was rejected and what was not verified.
- Attach real-browser evidence for any behaviour change; unit tests alone do not complete a task.
- No attribution trailers or generated-by lines.
