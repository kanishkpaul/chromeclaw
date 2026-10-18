# Safety boundaries and retained protections

Phase 2 binds model proposals to captured nodes and fixed task permissions. It has controlled
browser evidence, not a proof of safety on arbitrary signed-in sites. Use the runtime's trusted
permission options; page text and model replies cannot grant origins, tools, writes or approval.

| Existing intent | Current enforcement | Regression evidence |
|---|---|---|
| Hand back for credentials/login | Safe labels and parsed autocomplete tokens; values omitted before capture; independent driver and atomic setter refusal; screenshots withheld on credential/framed pages | Password/current/new/OTP, textarea, shadow/frame, focus changes/replacement, direct setter, trace and screenshot cases |
| Refuse CAPTCHA/paywall/security bypass | User bypass intent and observed barrier controls refuse; ordinary page/task keywords alone do not block reading | Explicit bypass refusal and successful read-only PostgreSQL fixture |
| Confirm sending/purchases/destructive changes | Every activation needs write permission plus one exact approval, including unknown buttons and links; Enter/Space activate only the numbered button/link | Transfer/pay/post/delete/unknown, denial, exact commit, Enter, stale approval and replay cases |
| Restrict destinations and data movement | Parsed HTTP(S) origins, private-address/DNS checks, request interception, no automatic redirects/popups/service workers/WebSockets; cross-origin forms and query/hash exports refuse | Zero requests to redirect/foreign endpoint, form/query attacks, browser/file/private/unscoped-loopback cases |
| Never invent a target | Snapshot number resolves to retained element/document/frame handles; geometry, occlusion, metadata and form state rechecked; stale proposals recapture without replay | Duplicates, replacement, label/selector drift, hidden/covered, document change, silent form change and stale approval cases |
| Keep task powers fixed | Copied/frozen tools/origins/read/write/irreversible/step/time/cost permissions exist before page reads; rechecked after approval | Tool/write/budget refusal, expired browser requests and envelope immutability checks |
| Inspectable trace | Versioned event records with observation references; typed values and registered sensitive strings filtered; known key echoes refuse | Versioned JSONL, registered-value filtering, SIGKILL/new-process and corrupt-tail checks |
| Page/model content remains data | Actions parse strictly; no selectors, coordinates, approval field or permission-widening method | Strict action schema plus fixed-permission browser attacks; Phase 3 prompt/HTTP fixture and architecture guards |

## Target and approval contract

Capture offers at most 200 visible, uncovered, enabled controls in document order and reports
omissions. It includes semantic DOM roles, safe names, bounds, credential metadata and frame
identity. Same-origin frames and open shadow roots participate; foreign frames are explicitly
unreadable. The DOM role/name subset is compared with Playwright's supported native ARIA snapshot
on synthetic noncredential fixtures. Production capture never serializes raw AX values. This is
not a complete implementation of every accessible-name rule or custom widget.

Approvals identify one action, snapshot, target name and advertised destination. DOM mutations,
ordinary form-value changes, navigation and expiry invalidate them. Relevant ordinary values stay
inside browser handles and are never returned in observations. Every remaining control activation
confirms because a label cannot prove a handler harmless. Only a trusted runtime callback can
approve; an action cannot carry its own approval. A consumed node cannot replay its approval.
The snapshot binds relevant form state without disclosing its values to a provider; a human
callback must inspect that state in Chrome before approving. Scripted fixtures use synthetic
values and controlled approvals. Without a callback the run hands back without acting. Phase 3 supplies durable awaiting-input states, basic terminal controls and restart recapture;
the terminal controls and grounded ask are documented in [PHASE5.md](PHASE5.md).

The request gate permits one matching data-bearing request after approval. It checks redirects
with `route.fetch({ maxRedirects: 0 })` because Playwright does not route each redirect hop. All
HTTP redirects currently refuse and require a new permitted navigation. Attachment downloads
hand back. The read/write permission is enforced on browser requests as well as proposals.

## Deliberate limits

- GET/HEAD requests without query parameters are treated as reads. A server can attach side
  effects to those requests; URL parsing cannot infer that. This is not a sandbox for arbitrary
  malicious JavaScript, same-origin request handlers or every browser background protocol.
- DNS addresses are checked before requests, but are not pinned across a malicious DNS rebinding.
  No rebinding guarantee or real-site browser-network isolation claim is made.
- Credential classification uses type/password, autocomplete tokens and recognized English
  labels. A deliberately mislabelled generic field can evade classification. Ordinary values
  are omitted from observations, but arbitrary page/user prose is not a generic PII scrubber.
- Screenshots on known credential/framed pages are withheld; other screenshots mask controls.
  Canvas/image secrets and arbitrary pixels are not detected. Raw screenshots are not exported
  automatically beyond their local path.
- Native DOM activation is untrusted input. Some real applications may reject it. React/custom
  widget and signed-in-site compatibility have not been established by these fixtures.
- Phase 4 admits configured local inference with a zero provider monetary allowance. Hosted
  attempts require a declared ceiling and total task budget, reserved durably before every send.
  Failures/retries retain reservations; reopening does not reset them. This is dispatch accounting
  under user-declared prices, not an invoice guarantee. Hosted inference testing is waived.
  Trusted scripted fixture planners use the same browser gates.
  Time/step limits stop new acts; Phase 3 propagates cancellation to requests, waits and browser
  closure. It reports possible in-flight effects and does not claim rollback.
- Phase 3 adds one confined prompt builder, one application egress, bounded retries, explicit
  outcomes, durable human input and credential continuation. Its filter covers declared sensitive
  strings, typed aliases and URL parameters, not arbitrary private prose or encoded secrets.
  Read [PHASE3.md](PHASE3.md) for contracts and [the evidence](evidence/phase3/README.md).

Preserve each old protection goal when these mechanisms change. Mutation checks remove the
credential, target-state, origin, tool, write, request-approval, request-expiry and redirect gates
one at a time; the associated browser assertion must fail. Negative controls are separate from
normal runs with zero unsafe fixture acts. See [the Phase 2 evidence](evidence/phase2/README.md).


The Phase 5 scrollback TUI renders page/model/source content as escaped, prefixed rows. Its
pending-action control requires the current one-use pending ID; Enter/Esc deny. Input is handled
at arrival, never queued into a future gate. EOF/Ctrl-C cancel through the existing runtime;
reopen keeps the saved envelope and pauses after recapture. The [PTY/browser starter evidence](evidence/phase5/terminal-start/README.md)
covers the initial presentation mechanics; [completion evidence](evidence/phase5/completion/README.md)
adds read-only ask, bounded SSE, long-stream cancellation and immediate browser-loss failure.
Ask cannot widen existing permissions or navigate away from the selected page. It excludes form
values and requires snapshot-bound exact extractive citations. Source display requires a cited
passage, the original unexpired read/origin permissions and an explicit command. SSE partial
content never reaches the terminal or dispatcher; counts are provisional, complete actions are
validated once and credential echoes are checked after joining chunks. Reopening preserves the
saved ability and transport settings. These checks do not establish arbitrary PII filtering,
personal Chrome attachment, held-out model quality or isolation from arbitrary malicious JavaScript.

Phase 6's experimental find-on-page mode uses the same narrowed read-only page scope as ask.
Structured results name offered noncredential controls or passages without activation. Current
snapshot/target checks plus passage recapture refuse stale results. A match validates a reference,
not semantic relevance; an absent-match assertion stays uncertain. No automatic scroll, highlight
or click is enabled. See [PHASE6.md](PHASE6.md) for the controlled acceptance gate and limitations.

Phase 6 upgrades activation to trusted Playwright input with an adapter-owned event-time guard and
pre-navigation acknowledgment. A native checkbox/radio default toggle is checked privately after
dispatch; changing another field during focus still invalidates the action. No native-click retry
follows uncertain dispatch. Text/select keep their atomic native setter fallback, declared in the
trace. Select refuses credentials, duplicate/disabled options, multiple-select and focus-time
changes; option values and selected labels are not exported as form state.

Owned-page history and five bounded task tabs stay within the original origin/read/tool budgets.
An explicit tab-open result determines ownership; a popup cannot consume that admission. Close
requires exact approval. Reopening old runs keeps their original tool list; new tool defaults do
not add capabilities to saved envelopes. Background requests from inactive tabs are still refused.
The event guard does not isolate arbitrary malicious JavaScript or prevent earlier page listeners
from reacting. Known English credential labels/autocomplete tokens remain the classifier; unknown
or non-English disguises and generic private prose retain the documented gaps.

An unverified interactive page-work finish can request bounded human judgment without reloading
and losing edits. Up to two answers can guide remaining work; they cannot replace exact action
approval or renew permissions. Noninteractive finishes still return uncertain. Tests independently
check that a premature finish followed by a human correction produces one correct save, without
repeating a possible commit. Evaluation reports count completion judgments and session hand-backs.

Phase 7's opt-in background readers retain the original origin/read/navigation/expiry checks.
Only exact adapter-created tabs are admitted. Readers disable scripts before navigation and
refuse query-bearing requests, subframes, redirects, secondary navigation and nonstatic resources.
They capture visible passages without form values. Five concurrent tabs, twenty unique attempted
sources and fifteen seconds per reader bound this first slice. Cancellation/revocation closes
reader-owned tabs only. The default action runtime has no reader admission. Synthetic attacks and model-specific completion results are separate evidence; these mechanisms
do not establish universal injection resistance or semantic entailment.
Static reads share the task context's cookies and retain the existing GET, DNS and network limits.
See [PHASE7.md](PHASE7.md) and its source/compiled browser evidence.

Phase 7 discovery fixes one to three trusted queries before reading any source. The only new
query-bearing browser exception is the exact predeclared engine URL on its exact adapter-owned
reader page; source queries, frames, scripts, redirects and writes stay refused. Registered-secret
queries stop before Chrome opens. Forced model search/navigation/activation proposals cannot use
the discovery path. Reopen pauses before fresh reads and retains task expiry, step limits and
persisted source-attempt reservations. Search CAPTCHA stops with a manual hand-back reason; no
solver or provider/engine fallback exists.

Only captured source passages can support research claims or web URL matches. Invalid references
and uncited final-answer additions refuse completion. Exact extraction is distinct from semantic
entailment: qualified/conflicting claims need human review, and undeclared contradictions are not
automatically detected. The history path reads an explicitly selected bounded JSON snapshot,
filters locally and confirms at most three permitted pages. It never sends history metadata to a
model, including with hosted settings. Cancel revokes an active run; deleting/changing the snapshot
refuses subsequent admissions. Forget deletes that local run's notes, not original or external
copies. The integration probe and synthetic recollections establish no live personal-profile or
personal-memory quality claim. See D-025, D-026 and [PHASE7.md](PHASE7.md).

Phase 8 retains blocked subresource requests while distinguishing them from a failed main
document in read-only page/source opening. A denied font, query-versioned asset or telemetry
request cannot invalidate an otherwise readable page; redirects and denied main-document reads
still refuse. Interactive action outcomes retain every request refusal. The controlled live
regression independently checks zero requests at denied asset/telemetry endpoints in source and
compiled modes. Styling/scripts can consequently be absent, and captures remain bounded by the
existing visibility rules. This does not establish arbitrary live-site isolation or correctness.

Stage 3 requires distinct ranked source URLs in addition to valid source-bound references.
A duplicate result refuses completion rather than being silently rewritten into a new model
answer. Controlled source/compiled and real-source checks retain single-result completion while
rejecting repeated URLs with otherwise valid evidence. Source origins, query construction,
model accounting and action permissions remain unchanged. The fixed public search lane stops
at a challenge; a separately declared controlled candidate index with actual public page reads
is assisted retrieval, never evidence of public-search availability or broad relevance.

Stage 6 makes capture report a cut passage as omitted, so a 2,000-character prefix is no longer
presented to the model or research readers as complete text. Text nodes now merge within their
block-level ancestor, which lets one exact citation cover a sentence containing an inline link.
Exact single-passage verification and the 2,000/6,000-character bounds are unchanged. `placeholder`
and `name` attributes label only form fields; credential classification, which already applies only to
form fields, still sees them. Controlled source/compiled regressions and the credential, safety
and work-safety suites cover these changes. A complete accessible-name implementation is not claimed.

Stage 7 keeps cleanup truthful without stalling on a hung driver. Disconnect has a 5-second
bound. After disconnect, the runtime waits up to 45 seconds for the Chrome process to exit and
release the profile, then records which bound failed. Returning at disconnect was rejected
because Chrome was still writing the profile. Preformatted text keeps one passage per node, so
the complete-passage research verifier still matches RFC-style titles; prose merging is unchanged.
