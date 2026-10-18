# Phase 7: research and remaining find modes

Phase 7 adds J1 research, J3c web finding and J3b selected-snapshot history/bookmark lookup to the
existing terminal runtime. The [starter reader report](evidence/phase7/readers/README.md) is retained.
Completion evidence separates scripted engineering fixtures from actual local model results;
hosted inference remains waived. Phase 8 is held-out live testing and bounded daily use, and
Phase 9 is the final README. Neither is implied by controlled results here.

## Commands and scope

Use `run "question" --research` or `run "description" --find-web`, with explicit provider/model
configuration and permitted `--origin` values. `--query "subquestion one" "subquestion two"` fixes
up to three queries before any page read; absent that flag, the task is the single trusted query.
`--search-engine` selects a plain engine endpoint (default `https://html.duckduckgo.com/html/`).
`--sources 1..15` bounds candidate page reads. `--json` and `--jsonl` keep their existing contracts.
Modes are explicit and mutually exclusive with `--ask`/`--find`; writes are always disabled.
If results need origins outside the envelope, inspect their hosts and start a new task with
explicit `--origin` values or TUI `/origins URL ...`. That control affects future tasks only;
source content cannot widen an active or saved run.

The TUI uses these parsed JSON commands, so queries and private scope are visible and reviewable:

```text
/research {"mode":"research","engineUrl":"https://html.duckduckgo.com/html/","queries":["first question","second question"],"maxSources":10}
/find-web {"mode":"web","engineUrl":"https://html.duckduckgo.com/html/","queries":["describe the page"],"maxSources":10}
/find-history {"mode":"history","catalog":"/absolute/path/selected.json","from":"2026-10-01T00:00:00Z","to":"2026-10-18T00:00:00Z","terms":["title term","URL term"]}
```

The terminal shows query plans, source hosts, progress, partial reads and source failures in escaped
rows. `/sources`, `/source N`, `/passage ID` and `/open ID` inspect retained evidence; explicit source
opening keeps original read/origin/expiry permissions. `/pause`, `/cancel`, `/continue` and `/resume`
use the existing lifecycle. Reopen pauses before new source reads and cannot renew permissions or
reset source reservations. Cancellation closes task-owned pages and never claims rollback.

## Search, reading and evidence

The independent engine-tab plugin takes injected readers. Only exact predeclared search URLs can
carry query data. Source instructions and model proposals cannot append private content, change
queries, add origins or act. Search CAPTCHA produces a hand-back failure; there is no engine/model
fallback. [The API comparison](SEARCH_BACKENDS.md) records why no commercial API is enabled yet.

At most five background readers operate concurrently without selecting the foreground page.
Twenty source/search attempts, including failed reservations, bound a task across reopen. Readers
allow a single admitted document and same-origin static assets; disable scripts before navigation;
refuse subframes, source query URLs, secondary navigation, automatic redirects and downloads.
Navigation/capture has a fifteen-second deadline after tab creation, bounded by original task
expiry. Static capture is viewport-only and reports omitted/unreadable regions. Script-dependent
pages may be incomplete; response bytes retain the existing transport limits rather than a new
byte quota. Task-context cookies, GET side effects and DNS rebinding retain documented limitations.

`finish.claims` contains `{text,kind,evidence,qualification?}`, where `kind` is `extract`, `qualified`
or `conflict` and evidence is `{snapshotId,passageId,quote}`. References must resolve to captured
passages. A complete captured passage can establish verbatim extraction, not truth or entailment; `finish.answer` must join their texts
with newline. Qualified/conflicting statements require an explicit qualification and remain
uncertain for human support review. Sources can disagree even when both are quoted correctly;
undeclared contradictions and semantic entailment are not automatically detected. Keyword overlap
is never used as proof. Invalid references refuse completion.

`finish.webFind` returns up to three ranked `{url,reason,evidence}` matches or explicit no-match.
Each match must cite a passage from its own admitted source URL. Search snippets cannot satisfy
that check. Successful resolution establishes the page/reference, not semantic relevance; absence
from the whole web is never claimed. Redirects and unavailable sources are per-source failures.

## Selected history and bookmarks

`run "description" --find-history /path/selected.json --from ISO --to ISO --terms term1 term2`
searches an explicit portable snapshot. It does not attach to a personal profile. The disposable
integration probe found only per-tab CDP navigation history and no global history/bookmark API;
D-026 records the snapshot choice rather than adding an extension or reading live databases.

```json
{"version":1,"entries":[{"url":"https://example.com/notes","title":"Selected notes","visitedAt":"2026-10-10T12:00:00Z","kind":"history"}]}
```

`kind` may also be `bookmark`. The file is limited to 1 MiB and 10,000 records, must be a regular
nonsymlink `.json` file, and must use that explicit schema; arbitrary Chrome exports are not
silently interpreted. Local title/URL matching filters the selected time window and confirms at
most three pages under the original origin envelope. This lexical baseline makes no inference
requests and sends no history metadata to a hosted model. No index is built. Cancel stops an active
search; unavailable/changed snapshots refuse later admissions. `/forget RUN-ID` deletes the run's
retained source notes and trace. It leaves the original snapshot and external copies intact.

The owner authorized twenty synthetic recollections instead of personal-history evaluation.
Report those as seeded retrieval mechanics, never personal recall quality or evidence for an index.

## Verification

`pnpm check` covers types, lint, unit and process tests. `eval:discovery`, `eval:discovery-safety`
and `eval:discovery-terminal` run real browsers and terminal/CLI gates. `eval:discovery-local` needs
an explicit already-running local endpoint/model; no weights are downloaded and no hosted fallback
exists. Reports separate correctness, citation validity, exact support, top-one/top-three, no-match
errors, latency, source failures and model identity. Synthetic/history runs do not measure hosted
or actual-model research quality. Raw evidence and remaining limits belong in the completion report.
