# Phase 4: provider configuration and model acceptance

The first slice, p4-01, makes configuration explicit and inspectable. It does not complete Phase 4.
The execution lock remains until cost accounting and admission are implemented. Hosted model
testing is intentionally skipped at Kanishk's request. No hosted inference or paid call is authorized
by inspecting settings. Actual local-model acceptance is still open.

## Selection

`config --json` describes the selected provider, model, endpoint, local/hosted/mock mode, whether a
key is configured, and readiness. It does not send a request or print a key. Non-mock readiness is
`accounting-required`; this means configured, not compatible or available.

Provider selection is flag, then `CHROMECLAW_PROVIDER`, then mock. The presence of `OPENAI_API_KEY`,
`HF_TOKEN` or another key never selects a provider. Model selection is flag, then
`CHROMECLAW_MODEL`; only mock has a default model. `hf` normalizes to huggingface. Anthropic is
unavailable and refuses before Chrome opens. No protocol fallback exists.

| Setting | Explicit option | Environment, in order | Default |
|---|---|---|---|
| Hosted endpoint | `--base-url` | `CHROMECLAW_BASE_URL`, then `HF_BASE_URL` or `OPENAI_BASE_URL` for the selected provider | OpenAI/Hugging Face official compatible endpoints only |
| Local endpoint | `--base-url` | `CHROMECLAW_LOCAL_BASE_URL` | Required |
| Hosted key | No CLI flag | `CHROMECLAW_API_KEY`, then selected provider's `OPENAI_API_KEY` or `HF_TOKEN`/`HUGGINGFACE_API_KEY` | Required |
| Local key | No CLI flag | `CHROMECLAW_LOCAL_API_KEY` | None |
| Step limit | `--max-steps` | `CHROMECLAW_MAX_STEPS` | 20 |
| Time limit | `--timeout-ms` | `CHROMECLAW_TIMEOUT_MS` | 120000 ms |
| Headless | `--headless` | `CHROMECLAW_HEADLESS` | false |

Explicit API callers can supply `apiKey` to the factory. Keys are not CLI flags because shell
history and process arguments are observable. Environment remains plaintext process configuration,
not an encrypted credential store. Empty configured values refuse instead of silently falling back.

Local endpoints must parse to exact localhost, 127.0.0.1 or ::1 on HTTP(S). A hostname containing
localhost is not local. Hosted endpoints require HTTPS and refuse these loopback hosts. Both reject
URL credentials, query and fragment. Keys cannot appear in the endpoint or model setting. This is
selection validation, not DNS pinning or an attestation that a loopback service runs inference
locally. Remote model loading by a local service remains the user's server configuration.

Run/repl flags win over environment. Budgets must be positive finite integers, and timeouts must
fit Node's signed 32-bit timer limit. Headless environment values are exactly true or false.
Reopening a run retains its original permission expiry and step allowance. The current phase
cannot reopen a non-mock run into unrestricted execution.

## Commands

```sh
node apps/cli/dist/index.js config --json
node apps/cli/dist/index.js config --provider local --model my-installed-model \
  --base-url http://127.0.0.1:11434/v1 --json
```

These commands inspect selection only. No inference server is bundled or downloaded. Runtime
permissions still control browser reads, writes, origins and exact approvals; provider settings
cannot widen them. The full design-kit TUI belongs to Phase 5.

## Remaining gate

Add pre-send monetary reservations, bounded output/usage accounting and honest handling of missing
usage/prices. Then run the same browser protocol and safety gates with an actual configured local
model. Hosted acceptance is waived for this session and must remain explicitly unverified. Keep
simulated HTTP fixture evidence separate from real model evidence. Complete fix-09's combined
release checks and reconcile implementation status before claiming Phase 4 complete. Held-out
sites and final presentation remain Phases 8 and 9.
