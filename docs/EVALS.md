# Evals

ChromeClaw includes a small deterministic benchmark harness in `packages/evals`.

Run:

```bash
pnpm eval
```

The runner emits a JSON report with success rate, average steps, duration, and failure reasons.

Mock mode is intentionally supported so the evaluation harness can run in CI without paid model keys. Browser-grounded evals use Playwright and can be run headful for demos.
