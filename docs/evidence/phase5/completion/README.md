# Phase 5 controlled acceptance

The terminal starter merged as PR #8 at `4d09383`. This completion covers `tui-00` and `tui-01`:
read-only grounded ask, snapshot-bound passages, explicit source opening, bounded SSE progress,
truthful cancellation/browser loss, terminal control coverage and a measured browser-session choice.
Hosted inference was **explicitly waived by Kanishk**. No hosted calls, paid inference, model
downloads or personal Chrome profile access were performed. Phases 6–9 remain pending.

| Check | Result | Evidence |
|---|---|---|
| Build, strict types, lint, unit/architecture/process tests | 61 tests in 16 files | [check log](check.log) |
| Controlled ask, source and compiled | 20/20 each: 17 grounded answers and 3 expected unreadable hand-backs; 5 additional safety/source checks | [source](ask-source-report.json), [compiled](ask-built-report.json) |
| Actual offline local ask | 20/20 source and compiled, independently labelled fixture outcomes | [source](ask-local-report.json), [compiled](ask-local-built-report.json) |
| Terminal + real browser | 12 groups, exactly one independently verified Kolkata save | [report](terminal-report.json), [PTY recordings and traces](terminal/) |
| Actual local terminal | Known-answer ask, live progress, passage/trace inspection, guarded source opening | [report](terminal-local-report.json), [recording](terminal-local/actual-local.cast) |
| Owned profile versus authorized disposable CDP | 3 checks, including persistent cookies, detach ownership and browser loss | [report](session/report.json) |
| Inherited regressions | Baseline 3, credentials 13, safety 35 × 2, runtime 28 × 2, configuration 5 × 2, model/CLI 16 × 2 | [command results](regressions.json), individual reports/logs here |

The [manifest](manifest.json) pins source, fixture and dependency hashes. Logs retain original UTC
timestamps; the local acceptance date is 2026-10-18 in India. CI runs controlled fixtures and
archives evidence; actual local inference is a separate manual gate, never a silent CI skip.
The earlier eight browser gate mutations remain historical Phase 2 evidence, not newly rerun here.

## What these results establish

Twenty questions have answers fixed independently of model output. Fixtures include Unicode,
tables, readable same-origin frames, open shadow roots, scrims, an actual locally bundled React
form, rendered virtualized content, protected/hidden values, prompt injection and changing DOM.
Offscreen text, canvas-only facts and foreign-frame content must hand back instead of guessing.
Assertions also require no credential/foreign-frame marker in traces, no server-side writes,
read-only task powers and resolvable snapshot/passage citations. Forged IDs finish uncertain;
attempted writes or navigation away block. Expired source permission refuses before another
browser request. Source opening makes a real browser request only under original
unexpired read/origin permissions and preserves the completed task status.

Ask opens the user's explicit permitted page before inference, refuses model navigation elsewhere
and cannot enable editing even inside a writable terminal session. Successful completion requires
an exact captured extract and valid citations. That checks extractive support, not general semantic
entailment, numerical reasoning or arbitrary summaries. Source opening shows the live URL; it
cannot promise the page still matches the stored capture. Closed shadows, OCR, scrolling and
unrendered virtualized items remain outside this reader.

The TUI is a single native scrollback adapter over the existing runtime. Pending IDs, permissions,
reservations and final outcomes stay authoritative in the durable runtime. Partial SSE proposals
are buffered within existing byte/deadline limits; live output shows **received byte counts**, not
unvalidated JSON or word-by-word model text. Complete replies alone pass to the strict parser and
policy. Truncated streams and split credential echoes refuse; cancellation cannot dispatch a
partial action. User cancellation and browser disconnection have distinct outcomes.

## Actual model and development failures

The recorded model is cached Qwen3-VL 8B Instruct Q4_K_M through installed offline llama.cpp 9780
(`1191758c5`), native `llama-schema`, 8192-token context, one slot, temperature 0, reasoning off,
512 output tokens and 90-second inference deadline. Exact revision, command and current versions
are in [server metadata](local-server.json). No weights/server were installed or bundled.
The terminal check uses the same production local factory and compiled CLI, not synthetic model
responses. Neither Ollama, LM Studio, another model nor hosted inference is established here.

The first local run passed 12/20: the model sometimes asked for help while still on a blank tab.
[Its report/log](development-local-before-navigation.log) and [traces](development-local-before-navigation/)
remain preserved. Moving the already-authorized explicit URL navigation before inference fixed
that generic integration failure; fixture questions, expected answers and hand-back criteria were
unchanged. This is development acceptance after a repair, not held-out model performance.

A source-only capture initially failed because tsx's serialized function referenced `__name`.
The reader now supplies that helper inside its own evaluation closure without changing page
globals; source/compiled browser gates check parity. The session fixture initially used a
session-only cookie and incorrectly expected persistence after browser close; the final test
explicitly creates a persistent synthetic cookie. Missing bundled Chromium on this Mac caused
an initial fixture startup failure; it now uses installed Chrome with Chromium fallback, matching
the production driver. These fixture repairs do not broaden task powers.

After the session pause, a terminal run encountered a stopped local server and recorded an explicit
network failure. [That partial trace/recording](development-local-server-unavailable/) is retained.
Restarting the same offline server allowed the final actual-terminal gate to pass. No retry through
a different provider or endpoint occurred.

## Browser choice and remaining scope

The session comparison uses an explicitly debuggable disposable browser, never personal Chrome.
It measures owned launch/reopen versus CDP attach and proves detach leaves its owner alive.
Keep owned profiles: CDP exposes session contexts, so production attachment needs a distinct
permission/cleanup contract. The faster attachment measurement alone does not justify a bridge.

The old ordinary `run` surface still allows explicitly granted editing under its existing gates.
No profile registry, automatic model-readiness approval, arbitrary PII classifier, malicious-page
isolation proof or signed-in-site readiness is claimed. The richer screenshot/timing trace viewer
remains on TODO. Phase 8 is held-out live testing and bounded daily use; Phase 9 is the beautiful,
evidence-backed README for recruiters, researchers and engineers.
