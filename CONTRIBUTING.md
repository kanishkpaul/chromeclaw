# Contributing to ChromeClaw

Thanks for helping make transparent browser agents better.

## Development

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm dev
```

## Principles

- Keep browser actions real and inspectable.
- Prefer accessible selectors and deterministic observation summaries.
- Add safety tests when changing autonomous behavior.
- Do not expose hidden chain-of-thought. Store short reasoning summaries only.
- Keep provider integrations keyless by default through mock mode.

## Pull Requests

Please include:

- A short summary of behavior changes.
- Tests or an explanation of why tests are not needed.
- Screenshots for UI changes.
- Notes for any new permissions, storage, or external network behavior.
