# Stage 2: run the core tasks ourselves

2026-10-18. Base: `b86c5f6ba4dba6a896b9325d85d1577e309ff8b8` (PR #14).
The owner clarified that Days 1–7 are **seven back-to-back testing stages**, not calendar days.
This stage was executed while the preceding PR's hosted CI ran. No week-long wait is required.
The [current seven-stage plan](../../../PHASE8.md) supersedes historical calendar-day wording.
Phase 9 remains unstarted.

## Real tasks and fixed scope

The [frozen manifest](../../../../packages/agent/tests/fixtures/live-day2.json) defines eight tasks:
read httpbin's Moby-Dick heading and robots.txt; read IANA's example-domain heading; find its RFC
2606 link; report an absent checkout control; edit the demonstration form's delivery-instructions
textarea without submitting; and recover two fabricated saved URLs from a selected history JSON.
These are anonymous public sites, with disposable Chrome profiles and bounded original permissions.
The new heading/link tasks were frozen before capture or model evaluation. The form is an
additional control on a previously used site, not a new held-out site. Search was not retried
after Stage 1's barrier. No login, activation, posting, personal history or real hosted key was used.

Inventory found only Finder and ChatGPT/Codex in the foreground and no unrelated model, browser
or development jobs. Memory free was 80%; no unnecessary app needed closing. macOS services and
the working session remained. An offline cached Qwen3-VL 8B server ran with the same 8K context,
temperature 0 and explicit grammar as the original Stage 1 profile. This preserves a comparison
condition; it does not guarantee that every public-page prompt will fit. See [environment](environment.json).

The dummy BYOK emulator exercises the production compatible adapter through its injected test
seam, with synthetic usage, dummy bearer credentials and simulated reservations. Actual spending
is zero. It selects replies using frozen labels and does not measure model quality. Production
hosted configuration still rejects loopback endpoints; no network or permission gate changed.

## Outcomes

| Profile | Result | Meaning |
|---|---:|---|
| [Dummy BYOK](emulated/report.json) | 8/8 | Wire, references, scope, exact DOM edit and retrieval mechanics |
| [Actual local](actual-local/report.json) | 5/8 | 3/6 public live tasks plus 2/2 zero-inference synthetic-history checks |
| [Actual local through TUI](terminal/report.json) | 2/2 | Exact public robots.txt read, sources/trace inspection, resize and clean exit |

Actual inference passed both httpbin reading tasks and returned uncertainty for the absent checkout
control. IANA read/find requests were rejected because their prompts contained 8,688 and 8,715
tokens, exceeding the declared 8,192-token server context. These are capacity failures, not answers
scored for quality. No larger-context or revised-label retest was used to replace them.

The model reached the correct textarea and the driver verified the first write. It then repeated
the already-completed write despite success/no-change feedback. Recovery stopped after three
identical unsuccessful proposals. The task remains **failed**: it never proposed completion, so
the independent final DOM predicate did not run. Do not count a driver acknowledgment as the
independent end-to-end success criterion. The mock run did finish and independently verified the
exact textarea value and unchanged form URL, with a masked screenshot. No submit control was
admitted in either profile.

That failed local edit also recorded a browser-cleanup warning after the five-second deadline.
Later process inspection found no leftover Chrome process. This is a retained operational warning,
not a silently discarded error or a confirmed logic defect. The stopped model/server and removed
temporary profiles are recorded in environment metadata.

The real TUI run used the compiled product with the actual local endpoint. It read the complete
robots.txt text with exact captured evidence, then exercised `/sources`, `/trace`, terminal resize
and `/quit`. Inspect the [recording](terminal/terminal.cast), [plain output](terminal/terminal.txt)
and raw JSONL. This is one real task, not a broad usability or autonomous capability claim.

## Verification and provenance

`pnpm check` passes 78 tests. Production runtime, driver, safety, provider and prompt behavior did
not change in this slice. The existing live harness gained a frozen second manifest, selected
synthetic history and exact textarea assertions; the terminal harness gained its second scenario.
No dependencies, permissions, browser frontend or top-level directories were added.

One invocation omitted `--actual-local` and therefore repeated the emulator even though local
endpoint variables were set. Its raw report correctly says `actualLocal: false`; it is retained in
[the duplicate-emulator attempt](emulated-duplicate/report.json), never counted as real inference.
The explicit actual-local invocation is the sole 8-case local result above.

The manifest bytes retain `distinctDayCredit: false`, written before the owner's clarification.
That metadata has no acceptance effect under D-028. Evidence keeps the original bytes rather
than rewriting history. Reports include hashes, raw statuses, per-task latency, usage and simulated
reservations. All failed original outcomes remain. Latencies are unpaired sequential measurements,
not a cold/warm benchmark. Synthetic history makes zero inference requests and is kept out of the
six-task actual-model denominator. The terminal task repeats the robots.txt case and is not added
to that denominator. No semantic absence, broad relevance or complete live-network isolation claim
follows from these results.

Stage 2 is recorded and reviewed. Stages 3–7 remain: research/retrieval, interruption/recovery,
BYOK failure handling, extended terminal workflows, then final regressions/retests and cleanup.
Future live-test PRs stack on their predecessor; after an authorized parent merge the child is
retargeted to main. Confirmed product defects require reproductions before fixes; model misses,
capacity failures, site drift and barriers remain explicit limitations.

`manifest.json` hashes the retained raw evidence and source state. `-text` preserves evidence
bytes in Git. No actual hosted spending, personal-profile read or unattended test job is required.
