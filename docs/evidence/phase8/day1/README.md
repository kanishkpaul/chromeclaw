# Day 1 live pilot: failures are part of the result

Date: 2026-10-18. Base: `ecb73e7fe78fceba0c44a5807aa205da9f31e25b`.
Phase 8 has started. Its seven-day bounded-use gate is **open**; Phase 9 has not started.
This pilot does not establish dependable autonomous browsing or personal-history quality.

## Conditions and scope

Kanishk requested that unnecessary apps/workloads be stopped first. Inventory found Finder and
ChatGPT/Codex as the only foreground apps, no unrelated browser, model server or development job,
and four WhatsApp/Gemini helpers. The verified helpers received SIGTERM. macOS services and the
Codex process tree stayed running. Reported system memory free changed from 68% to 69%; this is
an observation, not a precise attribution of freed memory. The machine was reserved for this test
session, with normal operating-system background work still present. See [environment](environment.json).

BYOK uses dummy credentials, synthetic token usage and an injected loopback OpenAI-compatible
wire emulator. **No hosted inference or spending occurred.** This exercises wire, redaction and
reservation mechanics, not vendor authentication, hosted model quality or billing. Existing
production configuration still requires HTTPS and rejects hosted loopback endpoints. The emulator
knows the frozen labels; its results cannot be model-quality scores.

Actual inference uses cached Qwen3-VL-8B-Instruct-Q4_K_M, text only, on offline llama.cpp 9780.
The original server had 8,192 context tokens; a separate diagnostic used 16,384. Both used
temperature 0, one slot, reasoning off, 1,200 output tokens and a 90-second request timeout.
Local browser profiles were disposable and removed afterward. Only the synthetic customer name
field in httpbin's demonstration form was editable; no form submit/control activation was allowed.
The two history cases used fabricated selected bookmarks and **zero model calls**.

## Frozen results

The [original manifest](../../../../packages/agent/tests/fixtures/live-day1.json) was frozen
before the first attempt. Its hash is in every report. Original misses were not removed or
relabeled after seeing the sites. The twelve cases comprise ten public live tasks and two
synthetic-history mechanics checks. Counts below include both subsets, so they are not model
benchmark percentages. All commands with misses returned nonzero.

| Attempt | Frozen checks passed | Interpretation |
|---|---:|---|
| [Dummy BYOK before fix](emulated-before/report.json) | 5/12 | Revealed blocked-subresource task failures and outdated expectations |
| [Dummy BYOK after fix](emulated-after/report.json) | 6/12 | Reading recovered; viewport/stale-reference limits, site drift and search barriers remained |
| [Actual local, 8K](actual-local-8k/report.json) | 4/12 | Two history lookups, absent-control uncertainty and independently verified unsent edit passed |
| [Actual local, 16K diagnostic](actual-local-16k/report.json) | 0/4 | Repeated development subset; larger context alone did not solve completion |

The 8K model result is **2/10 live checks**, plus **2/2 zero-inference synthetic-history checks**.
Five public tasks exceeded the server's context limit (8,551–15,358 input tokens). This is a
deployment-capacity failure, not evidence about their answer quality. The Python reading result
failed the exact-citation contract. Two example.com expectations were obsolete: the captured
page had no `h1`, and its link now targeted `/help/example-domains`, not `/domains/example`.
The model returning a cited paragraph for a nonexistent-heading request shows why extractive
support alone does not prove that the user’s question was answered.

The 16K diagnostic retained the same labels and model. Python reading again failed citation/mode
validation; MDN performed an extra extraction and timed out; Python find selected a different
beginner-guide destination than the frozen tutorial label; Node find refused a stale result.
The alternative beginner guide may be relevant to the vague description, but it is a frozen-label
miss. Do not turn that exact-URL miss into an independently established semantic failure.
The small set was already observed and is not held out. Some early raw report metadata calls
the pilot “held-out”; interpret that only as outside prior controlled suites, **not** a blind
evaluation. The post-observation diagnostic is explicitly development evidence.

After initial successful search reading, the search engine presented an access barrier on later
attempts. The original local run had request-context failures before synthesis; subsequent mock
retests handed back at the barrier. After reviewing those results, no solver, engine switch or new
search run was launched.
Out-of-scope results remained blocked. Exact `/tutorial/` versus `/tutorial/index.html` URL labels
also limited the original web score; no equivalence credit was added afterward.

## Confirmed product defect and fix

Python, MDN and Node main documents loaded, but rejected fonts, query-versioned assets or telemetry
poisoned the shared refusal queue and failed read-only tasks. The [diagnostic](diagnostic.json)
separates main-page success from denied subresources. The [pre-fix regression](regression-before.log)
failed the completion assertion while independently confirming zero forbidden requests.

The guard now tags main-document refusals. Read-only callers can discard nonfatal subresource
diagnostics while retaining every request block. Interactive actions still consume all refusals.
No origin, query, redirect, credential, write or approval rule was relaxed. Readable pages may
still lack styling or script content. See D-027 and [the live-testing contract](../../../PHASE8.md).

The expanded regression passes **4/4 in source and compiled modes**: readable main page,
zero forbidden asset/telemetry requests, explicit source opening, and main-document redirect
refusal without following. Existing source/compiled safety matrices and reading suites pass.
The controlled suites are regression evidence, not live quality measurements. Commands, logs,
raw reports and traces are retained beside this report.

## Development follow-ups and terminal evidence

Revised example.com text/link labels live in a separate development manifest; they do not replace
original misses. Dummy and actual-local follow-ups both pass **2/2**. Follow-up and actual TUI
reports/recordings are linked in [the attempt index](index.json).
The terminal trial reads a public paragraph with the actual local model, inspects sources/trace,
resizes and exits. It is a small follow-up, not seven days of daily use or a general usability test.
The final terminal trial passes **2/2**. Its first attempt read the paragraph correctly but the
harness raced its exit predicate against a second process poll, reporting failure despite the
recorded `Closed` message. The final-state recheck fixes the harness; both recordings are retained.

Reports retain per-task statuses, latencies, steps, token usage, reservations and source failures.
Mock token numbers are synthetic. Fresh browser profiles do not make this a paired cold/warm
benchmark; server caches were warm after the first request. A controlled regression ran briefly
alongside the beginning of the 16K diagnostic, so its latency is diagnostic only. No capture
assertion proves universal relevance, no-match truth, arbitrary PII protection or all-network
isolation. The suite structurally disallowed live activation and observed none; it did not install
an independent audit of every live network request.

## Remaining work

Review seven distinct days of bounded TUI use, with task-specific scopes, human interventions,
failure classification and regressions before fixes. Add paired cold/warm measurements and more
diverse, newly frozen tasks before broad quality claims. Keep the synthetic-history and dummy-BYOK
choices explicit. Do not begin the final README phase until the live gate is actually satisfied.

`manifest.json` hashes the retained evidence and tested source files. Raw files use `-text` so Git
does not normalize their bytes. The model servers and temporary Chrome profiles are cleaned up
at the end of this session; no unattended process is needed to preserve this evidence.
