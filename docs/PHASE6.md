# Phase 6: grounding and page work

Phase 6 implements its controlled engineering gate. J3a finds current-page candidates; J2 works on
bounded webpages through the terminal. Hosted inference stays waived and unverified. The
[starter evidence](evidence/phase6/find-start/README.md) remains historical; the [completion report](evidence/phase6/completion/README.md)
records runs, failures, fixes and model-specific outcomes separately. Passing the twenty scripted
terminal workflows establishes runtime mechanics; local-model misses remain measured limitations.

## Find on this page

Use `/find URL description` in the TUI, or `run "description" --find URL --json` / `--jsonl`
with explicit provider/model/origins. Plain input does not silently switch modes. Ask and find are
mutually exclusive. Their common page scope disables writes, irreversible actions, scrolling,
tab/history access and navigation away from the selected permitted plain HTTP(S) URL.

Finish carries `pageFind: {outcome:"matches", confidence, matches:[...]}` with one to three ranked
`{snapshotId,target,reason}` or `{snapshotId,passageId,reason}` references. Results must resolve to
current offered visible noncredential controls/passages. Snapshot state, live handles and a fresh
passage read must agree before display. A caller's verifier cannot bypass this contract. The TUI
shows numbered results with captured names/text and reasons through its existing escaped rows.
No browser highlighting, scrolling or activation shortcut is added.

The confidence cutoff is 0.98, chosen after six development cases exposed a confident wrong
ambiguous result at 0.95. It is a small development filter, not probability calibration or proof
of relevance. Confident ambiguity also occurred at 1.0: indistinguishable labels therefore need
an explicit first/second/third ordinal in trusted user input or a trusted answer. Other duplicate
context interpretation hands back. A missing/low score, stale result, unsupported format or
no-match assertion never establishes success. One bounded format repair is allowed; model misses
stay in the report. No-match remains uncertain because absence cannot be proven from a proposal.
Keep the cutoff frozen before Phase 8 held-out testing.

The 20 labelled cases include 15 positive targets/passages and five absent/ambiguous cases, with
six development cases identified explicitly. Report top-1/top-3, false no-match and negative errors
separately per actual model. This is controlled development evaluation, not held-out accuracy.
Capture remains bounded and viewport-only: offscreen, covered, canvas and unavailable frame content
cannot become invented matches. Reopen preserves mode, powers and a fresh-capture pause.

## Work on webpages

Start an ordinary terminal task with the required origins and explicit write/commit flags, e.g.:

```sh
node apps/cli/dist/index.js tui --provider local --model YOUR_MODEL \
  --base-url http://127.0.0.1:8080/v1 --origin https://example.com \
  --write --allow-commit
```

The tool registry has nine independent plugin folders: click, type, select, press, scroll,
navigate, back, wait and tab. Tab supports explicit open/switch/close actions. Each has one
registration line and declared effects/input path; no tool imports another. Legacy search,
extraction and screenshots remain explicit runtime exceptions. No final ability/model/search
registry or pure-core migration is claimed. Removing select plus its registration line passes
`pnpm check`; the source and registry are restored byte-for-byte afterward.

- Click/press use retained handles and trusted Playwright input. An event-time guard checks
  identity, geometry and form state, including focus-time changes. Acknowledgment resolves before
  navigation destroys the document. Never replay uncertain input through native click.
- Text/contenteditable and select keep the atomic native DOM setter fallback, declared in traces.
  Select requires a unique enabled offered label and a single native select. Values remain inside
  Chrome; credential classification and focus-time checks apply to selects too. Neither repeated
  typing nor selecting an already correct value replays input/change handlers. Three identical
  no-op edit proposals stop recovery.
- Native checkbox/radio preactivation is distinguished from unexpected drift. The expected
  target/group toggle is allowed, other form values still invalidate the gesture, and a private
  post-action check can acknowledge the toggle without exporting checked state.
- Scroll sends trusted input and waits a bounded interval for viewport movement before capture.
  It does not claim that a boundary or nested container moved.
- Back names the offered owned-page history destination. History is read only with the back tool
  enabled and disallowed/query/fragment destinations are omitted. Read-only ask/find get no history
  or tab metadata. This is not personal browser history access.
- At most five task-owned tabs exist. Only the exact `Page` returned by explicit open joins the
  run; racing popups cannot consume admission. Switch/close name an observed tab and snapshot.
  Closing needs exact approval and cannot close the last task tab. Network guards still admit
  active-page requests only; concurrent background research remains Phase 7 work.

Scope is frozen before reads. Credentials and access barriers hand back. Enter on a numbered
submit button reaches the same exact one-use gate as click; a field cannot submit implicitly.
Typed values and selection labels are withheld in action traces. Optional `act_started` metadata
records effect and trusted/native-fallback input, while the current reader still accepts old logs.
Reopening a saved run does not add newly available tools to its original envelope.

## Outcomes, history and human control

A successful activation is input acknowledgment, not proof that the whole task completed. Compact
history retains up to 24 steps with snapshot-bound target names, because a number reused after
Next can refer to Save. Values remain private. Normal completion still requires exact captured
answer evidence or a trusted application predicate; fixture scoring uses independent server state.

For interactive page work, an unverified finish can request human judgment while keeping the
current page and edits. Up to two corrections can guide remaining work; the count survives reopen.
Answers never approve an action or widen powers. Noninteractive completion stays uncertain. Reports
count these interventions separately from exact approvals and manual session restoration; assisted
completion is not autonomous completion. Pause, cancel, takeover, disconnect and terminal loss keep
the existing durable lifecycle contracts.

The 20-task work set checks exact saved values and exactly one submission through a real terminal.
It includes a six-step form, ordinary/native/React controls, duplicates, drift, a modal, scrolling,
back/tabs, session restoration, consequential action, hidden/image instructions, OTP/disguised
credential bait, URL exfiltration bait and deceptive controls. Forced adversarial planners separately
exercise refusal gates. Shared adapter fixtures cover 429 retries and lifecycle loss; those are
transport/control regressions, not actual provider rate limiting or held-out model quality.

## Limits and remaining phases

No new production dependency, top-level directory, personal-profile permission or browser frontend
is added. Native setter compatibility, generic/non-English credential disguises, arbitrary PII,
malicious-JavaScript isolation, complex widgets, signed-in sites and whole-page visual grounding
remain limited. The guards cannot isolate earlier page-installed event listeners. See D-023 and
[SAFETY.md](SAFETY.md) for the retained boundaries.

Phase 7 remains research and the other find modes. Phase 8 is live/held-out testing and seven days
of bounded personal use; Phase 9 is the final evidence-backed README. Their acceptance is not
implied by controlled fixtures or a single local model.
