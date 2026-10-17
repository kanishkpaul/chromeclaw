# Phase 3 runtime contract

Phase 3 covers fix-04, fix-05, fix-06 and fix-08. Its evidence uses synthetic browser fixtures and
an isolated HTTP server, not a paid provider or an actual local model. Real model acceptance
remains Phase 4. The full terminal TUI remains Phase 5; live testing and the final README remain
Phases 8 and 9.

## Prompt and application transport

Every built-in HTTP planner uses `buildPlannerPrompt`. Page content, targets, prior model/action
content and retained extractions have explicit provenance fences. Angle brackets and model role
control tokens cannot close those fences. Fixed permissions stay outside untrusted data. Article,
target, task, history and extraction budgets are separate; source snapshots and extracted facts
survive navigation. Fencing is formatting defense. Runtime permissions remain the authority.

The system message derives its field list from the actual Zod action union. JSON mode is not a
schema guarantee, so replies parse locally. One enclosing JSON fence is accepted. Prose around an
object, unknown properties and legacy action aliases refuse. One failed model-reply parse may
replan; a second fails. This follows the [official JSON mode guidance](https://developers.openai.com/api/docs/guides/structured-outputs#json-mode).

`packages/egress` owns the only application `fetch`. Each request has an approved origin, no URL
credentials/query/hash, a 128,000-byte request limit, a 1,000,000-byte response limit and a 15-second
total deadline by default. Tests use shorter explicit deadlines. Redirects refuse. There are at
most three attempts for 429/502/503/504, with Retry-After bounded to two seconds and the same total
deadline. Body streaming and audit recording also observe abort/deadline. Error bodies and keys
do not appear in diagnostic results. A configured key in a request body/URL or echoed response
refuses. There is no silent transport/provider fallback.

A synced crossing event precedes every send. It contains destination, byte count, payload hash
and attempt. Cost is `null`, with `accounting: not-estimated`; unknown cost is not invented as zero.
Built-in non-mock planners remain disabled under the zero-cost envelope until Phase 4 provides
accounting/configuration. Injected planners are trusted application code. All injected HTTP
planners in this evidence point to loopback fixtures, with synthetic credentials.

## Human control

`BrowserAgentRuntime` owns one active run. It exposes `respond`, `pause`, `cancel` and `reopen`.
Replies require the active run ID, pending ID and kind. The first valid response wins, including
when an external denial races an adapter callback. Duplicate responses cannot execute twice.

- `ask_user` enters `awaiting-answer` without another planner call. A bound answer enters trusted
  user history and planning continues. Known credential questions and credential-driver refusal
  hand back to Chrome. Their raw answer is discarded; only a manual-completion acknowledgment is
  retained. The agent still cannot write credentials.
- Consequential activation enters `awaiting-approval`. Approval rechecks original permissions,
  snapshot state and the retained target. Denial stops without acting; stale approval recaptures.
- `pause` is checked before another proposal or act. Reopening a saved run retains its original
  permissions and expiry, discards old authority, recaptures and pauses before planning. It does
  not revive an old selector, handle or approval. Expired runs need a new explicit task budget.
- `cancel` reaches HTTP waits, timers and browser operations. Closing the context interrupts
  in-flight driver work. The trace says whether an act was already in flight; it does not claim
  that cancellation undid a request or browser effect.

Without interactive mode or a callback, pending input returns as a suspended run. It has a
`run_suspended` record and no completion timestamp, not a successful `run_completed` record.
The CLI provides `run --interactive`, `/pause`, explicit `yes` for one approval, and SIGINT to stop.
`--allow-commit` permits asking; it does not approve an act. `resume <id> --interactive` recaptures
and asks before planning. Noninteractive `--json` has no banner or ANSI output. Exit statuses are
0 verified completion, 1 failure/refusal, 2 pending/paused, 3 uncertain and 130 stopped. These are
basic CLI controls, not the Phase 5 TUI.

## Outcomes and bounded recovery

After an act, a new observation is recorded. Ordinary field writes compare their actual resulting
value inside Chrome, without returning it. A rejected/no-change write recaptures and replans;
three identical unsuccessful proposals stop. There is no automatic repeat of a possible commit.
An activation without an observable acknowledgment is uncertain and stops before another act.
A navigation exception after dispatch also records possible effects rather than claiming undo.

`finish` is a proposal. A trusted application `verify` predicate can check an independent server
or page state. Without one, only an exact extractive answer with valid captured source quotes
can pass. Every citation must resolve; one valid citation cannot hide an invalid reference.
Other answers require user judgment and return `uncertain`. Extractive grounding checks source
occurrence, not semantic entailment or general task quality. J1/J2/J3 acceptance remains in their
later job phases. The six-step form fixture uses its independent server state, never a model's
completion claim.

## Traces and privacy

Version 1 JSONL records configuration, observation, proposal, gate, dispatch, result, human state,
response, crossing, errors and final/suspended state separately. Observations have IDs; step
records refer to them instead of repeating a mutable run. Reconstruction joins those references.
Each line is validated and synced. IDs cannot traverse paths, and final-file symlinks refuse.
Complete records survive an interrupted writer. A corrupt tail yields a warning; invalid middle
records, I/O failures and missing files are distinct. Startup and cleanup failures are recorded
where storage permits. A cleanup failure cannot erase the primary failure. If storage fails, the
returned run says that its trace/final state could not be stored.

Typed action values and their thought text are withheld. Automatically registered aliases of at
least four characters, explicit sensitive strings and URL parameters are filtered in content
before traces, callbacks and HTTP prompts. Trusted IDs, permissions and configuration identities
remain intact. Credential hand-back replies are replaced before persistence and subsequent
planning. This is not arbitrary PII classification, encoded-secret detection or image/canvas
scrubbing. User/page prose can contain undeclared private data. Credential metadata and the
Phase 2 browser-network/DNS limits remain in [SAFETY.md](SAFETY.md).

The new reader validates version 1 records. Legacy unversioned JSONL is preserved on disk and in
historical evidence, but is not silently converted into resumable authority. Unsupported legacy
records report an invalid/unsupported format instead of being treated as missing. No key is
needed to inspect the committed synthetic evidence.
