# Stage 5: dummy BYOK protocol and failure handling

2026-10-18. Parent: Stage 4, PR #17, commit `3029d64`. This stage adds a frozen public-browser
protocol harness and evidence. It changes no production behavior. Stages 6–7 and Phase 9 remain
unstarted; the PR is stacked on Stage 4 without merging earlier work.

## Scope and method

The [manifest](../../../../packages/agent/tests/fixtures/live-stage5.json) froze seventeen cases
before execution. Each starts a disposable Chrome profile, reads the actual anonymous
`https://httpbin.org/robots.txt` page through the production runtime, and requests its exact
complete captured passage with a snapshot-bound citation. The emulator derives a response from
that captured passage, then applies the declared fault. The expected public text must exist
before fault injection, so a site failure cannot accidentally pass a provider-failure case.

Before testing, foreground inventory showed Finder and Codex. An unrelated WhatsApp service
extension was gracefully stopped; the transient Python process had already exited on inspection.
Memory reported 76% available. Codex and macOS services remained running. No local model server
was started. No personal browser profile, login, write, activation, submission or real key was
used. Public page loading is real; inference and all provider usage/cost data are synthetic.

The existing `OpenAICompatiblePlanner` is injected at its explicit test seam with a loopback
HTTP server and dummy bearer key. Production configuration continues to refuse hosted loopback
endpoints. This does not make loopback an accepted production hosted configuration. The server
checks the selected model, authorization, path, token-limit field and full request hash against
the already-persisted crossing record. Every retry needs its own durable reservation before its
body reaches the server. Only the declared emulator endpoint appears in model crossings.

## Results

| Case group | Expected behavior |
|---|---|
| Valid JSON and SSE | Exact runtime-verified answer; synthetic usage retained; both token-limit field names exercised |
| Invalid envelope, invalid action, truncated output | One bounded repair can complete; persistent invalid actions fail after two sends |
| HTTP 429 then success | Two requests and two retained reservations |
| Persistent HTTP 503 | Three requests, then explicit failure |
| HTTP 401 | One request, no authentication retry or provider switch |
| Missing usage | Completion permitted, token counts explicitly null |
| Negative or excessive output-token usage | Refused before proposal/act dispatch |
| Request timeout | Explicit transport failure after one attempt |
| SSE missing terminal marker | No proposal from an incomplete stream |
| Cancellation during partial SSE | Stopped run; byte progress contains counts only; no proposal dispatched |
| Credential echo | Refused; dummy key absent from persisted trace |
| Retry with exhausted reservation allowance | One request; denied retry sends nothing and retains the original reservation |

The [initial run](initial/report.json) passed all 17 contracts. A separately retained final run
strengthens the receipt check from finding a matching persisted hash to requiring exactly one
new durable crossing per send and matching the latest hash. Labels and expected outcomes were
unchanged. No failed attempts were discarded and no production defect was established.

The [final run](final/report.json) passed 17/17 contracts with 24 admitted dummy requests:
seven cases completed the cited read, and ten failed or stopped as deliberately required.
The [source model suite](models-source/report.json) and
[compiled model suite](models-built/report.json) each passed 16 checks. The full `pnpm check`
passed 79 tests after its first lint run caught an unused import in the new harness; that
diagnostic is retained. [Trace review](review.json) checks both public runs' exact failure
reasons and confirms their only browser act was permitted initial navigation.

Expected failures count as successful **protocol handling**, not as successful research or
model tasks. The emulator uses frozen labels; these scores carry no model-quality meaning.
There are no actual hosted or local inference calls, and actual hosted spend is zero.

## Accounting, safety and reproducibility

Each HTTP attempt reserves a declared synthetic 0.001, retained on failures, retries and
cancellation. The harness independently reconstructs every run from JSONL and checks that the
reservation total equals the number of admitted sends times that ceiling. Reported usage stays
separate from reservations; missing usage never becomes zero fabricated token usage. The
single-attempt budget cannot be renewed by a retry.

The public-browser trace admits only initial navigation, followed by data-only completion or
failure. No model-proposed write or activation is executed. Partial SSE chunks expose byte
counts only and never become executable proposals. Error diagnostics omit provider bodies and
the registered key. This is not arbitrary PII filtering or a proof against malicious pages.

Run `pnpm eval:live-byok`. Results live beneath `.chromeclaw/phase8-byok`; disposable profiles
are removed. Public-site commands remain manual, while existing source/compiled model fixtures
cover the deterministic configuration, budget, CLI and no-hosted-fallback contracts.
`manifest.json` pins source and evidence bytes, including original attempts and final results.
Final process inspection found no test Chrome or model process. The unrelated WhatsApp service
extension restarted under a new PID after its initial termination; [environment](environment.json)
records that observation without claiming macOS background services stayed absent.

This stage does not verify vendor TLS, real credentials/authentication, billing, rate-limit
semantics, provider availability, provider-specific API variants or model reasoning. It tests
the shared OpenAI-compatible wire and existing runtime using dummy data, as requested.
