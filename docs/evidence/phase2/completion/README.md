# Phase 2 completion evidence

Phase 2's controlled gate passes on macOS, Node 24.18.0 and Chrome 155.0.8059.80. This completes
credential protection, observed-target binding and fixed task admission. It does not complete
Phase 3's resumable hand-back, prompt/egress/redaction or outcome-verification tasks, nor establish
BYOK/local-model quality or signed-in-site readiness. PR #4 contains the implementation.

| Command or negative control | Observed result | Evidence |
|---|---|---|
| `pnpm check` | Build, typecheck, lint and 28 tests pass | [check.log](check.log) |
| `pnpm eval` | All 3 independent source-run fixtures pass | [report](baseline-source-report.json), [log](baseline-source.log) |
| `node apps/cli/dist/index.js eval` | All 3 compiled-CLI fixtures pass | [report](baseline-built-report.json), [log](baseline-built.log) |
| `pnpm eval:credentials` | All 13 grouped credential checks pass | [report](credentials-report.json), [log](credentials.log) |
| `pnpm eval:safety` | All 35 source-based safety groups pass; zero unsafe fixture acts | [report](safety-source-report.json), [log](safety-source.log) |
| `node packages/browser/tests/safety.browser.mjs` | Same 35 groups pass against compiled packages; zero unsafe fixture acts | [report](safety-built-report.json), [log](safety-built.log) |
| Disable each critical gate | All 8 probes exit 1 at browser assertions; production sources restored byte-for-byte | [report](mutation-report.json), [log](mutations.log) |
| `node apps/cli/dist/index.js eval --inject-failure` | Exits 1; server receives Pune while oracle requires Kolkata | [report](oracle-negative-report.json), [log](oracle-negative.log) |

The reports link 56 run IDs to their [raw JSONL](runs/). Normal and deliberately failing runs
are separate. The source suite sets `--tsconfig tsconfig.base.json` explicitly so runtime package
imports resolve to source too. A built-only pass does not stand in for source serialization.
The original credential screenshot mask remains in the parent evidence directory.

## What the browser checked

Numbered targets select the second of two identical labels without guessing. Replacing a node,
changing its selector/label/visibility, covering it, navigating the document or silently changing
an ordinary form value invalidates it. Consumed targets do not replay. Hidden controls before
node 120 do not displace visible controls; the 200-offered-node bound reports 20 omitted controls
on a 220-button fixture. Same-origin frames and open shadow roots work; foreign frames report
unreadable. `evidence.accessibilityComparison` records native Playwright ARIA beside the safe
DOM role/name/bounds list for synthetic noncredential controls.

Independent counters observe the world: no approval, denial, stale approval, missing tools/write
permission, timeout, implicit Enter, transfer/pay/post/delete/unknown controls and forbidden URLs
produce no commit. Exact approval and Enter on its bound submit button each produce exactly one
commit. Stale approval recaptures without another act. PostgreSQL reading succeeds despite payment
words in page prose. CAPTCHA/paywall bypass still refuses. Neither a permitted second origin nor
approval can enable cross-origin form/query export. The foreign server receives zero requests in
the redirect, unapproved-origin and export cases. Popups do not become another work surface.

Credential markers and attempted typed values remain absent from the credential-runtime JSONL.
Ordinary form values retained for state comparison live only inside browser handles. This is not
blanket PII redaction: a rejected model-proposed URL/query or arbitrary user/page prose can still
appear in a trace. General trace/egress redaction remains Phase 3; these synthetic traces contain
no real secrets or account data.

## Negative controls and repairs

Mutation probes temporarily remove the atomic credential refusal, retained-state/fingerprint
checks, origin check, write gate, tool gate, request-approval ticket, request expiry, or redirect
limit. Where a property has two independent layers, both are removed for that property. Every
probe must fail a browser assertion, rather than crash from a loader/type error. The report
records exact patches, exit status, source hashes and successful byte-for-byte restoration.
Mutation logs are retained beside this document; mutated source and negative-control browser
profiles are not retained. The full normal suites ran again after restoration.

The first expanded run exposed two real integration errors. Native activation returned before
form navigation, clearing its request ticket early; the driver now waits for the advertised
navigation without repeating the act. Playwright intercepts the initial request but automatically
follows redirects; the guard now inspects a response with `maxRedirects: 0` and refuses redirects
before any next hop. The redirect mutation restores automatic following and the foreign-server
assertion fails. In-flight response disposal also needed a safe close-race path. These repairs
were exercised through both source and compiled suites.

## Scope and provenance

The credential port and envelope/control/state concepts selectively reuse co-owned Blindfold at
`2f04984`; see [BLINDFOLD_REUSE.md](../../../BLINDFOLD_REUSE.md). Its complete upstream suite was
not run. ChromeClaw's integrated browser assertions are the evidence here.

No paid provider, actual local inference server, signed-in account or held-out live site was used.
Raw native AX values are not captured in production; the DOM semantic subset is not every
accessible-name rule. DOM activation may be rejected by sites requiring trusted input. Unknown
handlers confirm, redirects refuse, and generic PII, canvas/image secrets, deliberate credential
mislabeling, malicious JavaScript and DNS rebinding retain [documented limits](../../../SAFETY.md).
Hosted CI is reported on the PR separately; local reports alone do not establish hosted success.
