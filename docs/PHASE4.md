# Phase 4: provider configuration, accounting and model acceptance

Phase 4 implements explicit BYOK/local selection, bounded inference, pre-send cost reservations,
reported usage and machine-readable terminal outcomes. PR #6 supplied configuration and merged at
`b22254a`. The completion evidence is linked from [BUILD_PLAN.md](BUILD_PLAN.md).
Hosted inference testing is intentionally skipped at Kanishk's request. No hosted inference or
paid request was used for implementation or validation.

## Selection and protocol

`config --json` describes provider, model, endpoint, mode, key presence, output limit and declared
request ceiling. It neither probes a server nor prints a key. `configured` describes selection,
not server availability, model quality or permission to spend. Hosted selection without a ceiling
is `request-ceiling-required`; execution also needs a positive task budget.

Provider selection is flag, then `CHROMECLAW_PROVIDER`, then mock. Possessing `OPENAI_API_KEY` or
`HF_TOKEN` never selects a provider. Model selection is flag, then `CHROMECLAW_MODEL`; only mock
has a default. `hf` normalizes to huggingface. Anthropic refuses before Chrome opens. There is no
provider, endpoint or protocol fallback after an HTTP failure.

| Setting | Option | Environment, in order | Default |
|---|---|---|---|
| Hosted endpoint | `--base-url` | `CHROMECLAW_BASE_URL`, then selected `HF_BASE_URL` or `OPENAI_BASE_URL` | Official OpenAI/HF endpoint only for those providers |
| Local endpoint | `--base-url` | `CHROMECLAW_LOCAL_BASE_URL` | Required |
| Hosted key | No CLI flag | `CHROMECLAW_API_KEY`, then selected `OPENAI_API_KEY` or `HF_TOKEN`/`HUGGINGFACE_API_KEY` | Required |
| Local key | No CLI flag | `CHROMECLAW_LOCAL_API_KEY` | None |
| Task steps | `--max-steps` | `CHROMECLAW_MAX_STEPS` | 20 |
| Task time | `--timeout-ms` | `CHROMECLAW_TIMEOUT_MS` | 120000 ms |
| Task USD reservations | `--max-cost` | `CHROMECLAW_MAX_COST` | 0 |
| Hosted USD ceiling per attempt | `--request-cost` | `CHROMECLAW_REQUEST_COST` | Required before hosted execution |
| Output tokens | `--max-output-tokens` | `CHROMECLAW_MAX_OUTPUT_TOKENS` | 1024 |
| Token-limit parameter | `--token-limit-field` | `CHROMECLAW_TOKEN_LIMIT_FIELD` | OpenAI: max_completion_tokens; compatible/local/HF: max_tokens |
| Response shape | `--response-format` | `CHROMECLAW_RESPONSE_FORMAT` | json; explicit llama-schema for llama.cpp grammar |
| Request deadline | `--request-timeout-ms` | `CHROMECLAW_REQUEST_TIMEOUT_MS` | 60000 ms, includes retries |
| Headless | `--headless` | `CHROMECLAW_HEADLESS` | false |

Keys are environment or trusted API configuration, not process arguments. Environment remains
plaintext process configuration, not encrypted credential storage. Empty values refuse rather
than silently falling back. Local does not inherit hosted keys or endpoint variables. It requires
exact localhost, 127.0.0.1 or ::1 on HTTP(S). A hostname containing localhost is not local. Hosted
endpoints require HTTPS and reject these loopback hosts. Both modes reject URL credentials, query
and fragment; keys cannot appear in endpoint/model settings. Local selection does not attest that
a loopback service itself avoids remote inference. The tested llama.cpp process used offline mode.

The compatible adapter uses JSON mode, one choice, non-streamed text and an explicit output cap.
`llama-schema` explicitly adds llama.cpp's documented schema grammar extension, derived from the
same Zod actions. It constrains shapes/discriminants; token/byte limits and full local Zod bounds
still apply. It does not silently replace JSON mode after failure. The actual Qwen acceptance
uses this explicit mode because its plain JSON-mode form runs failed strict parsing.
It validates the reply locally. There is no retry with a different parameter when a server rejects
one. Models that do not implement this protocol subset are unsupported until their own adapter
exists. See the [OpenAI request contract](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create)
and [llama.cpp server contract](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md).
Ollama and LM Studio have not been independently tested by this phase.

Step/time budgets must be positive finite integers. Timers fit Node's signed 32-bit range.
Headless environment values are true or false. Output is capped at 32768 tokens as an application
resource policy; the 1024 default is for individual action objects, not a model quality claim.
Unsupported providers, invalid configuration and missing hosted budgets refuse before Chrome.
A valid endpoint that later fails yields a transport failure and cleanup; configuration inspection
does not promise online availability.

## Accounting

Every HTTP attempt requires a synced crossing before send. Hosted execution requires the user's
positive USD ceiling per attempt plus an immutable total allowance. Both are dispatch accounting,
not verified provider pricing. Reservations round upward to microdollars; total allowances round
down. A refused reservation sends nothing. HTTP retries and parser-repair requests each reserve
again. Failed, canceled and missing-usage attempts keep their reservation. No provider response
can refund or expand the budget. Local records `local-zero`, meaning zero provider monetary
allowance, excluding electricity/hardware and any independently configured proxy service.

`estimatedCost` in the historical crossing format now holds this reservation, with `accounting:
user-ceiling` or `local-zero`; unpriced trusted historical fixtures retain `not-estimated`. The
run's `reservedCost` is the sum of durable reservations. It is not an invoice. The user must set
a ceiling consistent with their tariff and use provider-side billing controls for an external
hard invoice cap. No static price table or token estimate pretends to prove actual charges.

`model_usage` records validated prompt/completion token counts, or explicit null values when a
server omits usage. Negative/malformed counts and completion tokens above the requested cap
refuse. Missing usage never becomes zero reported usage or a refund. Length-truncated replies
cannot act. Transport/accounting failures do not enter a parser repair loop.

Reopening reconstructs reservations from crossings, retains the original allowance/expiry and
saved endpoint/model/output policy, recaptures and pauses. It never resets spend or revives an
approval. A saved model run without endpoint metadata or a hosted ceiling needs a new bounded
task. Keys are resolved afresh for the retained provider and are never saved in configuration.

## Runtime and terminal

The original trusted task stays stable after ordinary typing. Typed aliases continue to filter
observations, history and trace content; they cannot erase words from the task sent for planning.
Declared secrets and known keys are filtered before that task is fixed. Credential replies still
hand back to Chrome. This is not generic PII or encoded-secret classification.

`--json` prints one run. `--jsonl` streams durable safe events then a `result` object containing the
run. Neither includes a banner or ANSI decoration, and neither accepts interactive approvals.
SIGINT cancels the runtime before printing its stopped result; Playwright does not exit first.
Exit statuses are 0 verified, 1 failed/blocked, 2 awaiting input/paused, 3 uncertain and 130 stopped.
Browser cleanup has a separate five-second bound. A slow/disconnected driver yields a recorded
cleanup warning, not an indefinite wait or a claim that browser effects were undone.

`--allow-loopback` exposes the existing browser-origin permission for controlled local pages.
It also requires an explicit `--origin`. Selecting a local model alone grants no browser origin.
All other origin, credential, exact-approval and irreversible-action gates remain in force.
The full terminal TUI remains Phase 5.

```sh
node apps/cli/dist/index.js config --provider local --model my-installed-model \
  --base-url http://127.0.0.1:11434/v1 --json
node apps/cli/dist/index.js run 'Read https://example.com and quote its title.' \
  --provider local --model my-installed-model --base-url http://127.0.0.1:11434/v1 \
  --origin https://example.com --headless --jsonl
```

These commands require the user's running compatible server. No server, model or key is bundled
or downloaded. Hosted test coverage remains waived and unverified. Held-out sites, daily use and
final presentation remain Phases 8 and 9.
