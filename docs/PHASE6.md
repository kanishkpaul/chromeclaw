# Phase 6: grounding and page work

Phase 6 is in progress. This first `find-01` slice implements an explicit, experimental,
read-only find-on-page route. It does not complete J3a's model-quality gate or J2 page work.
Hosted model testing remains waived and unverified.
The [starter evidence](evidence/phase6/find-start/README.md) records controlled checks and limits.

## Implemented contract

From the TUI, use `/find URL description`; for machine output, use
`run "description" --find URL --json` (or `--jsonl`) with explicit provider/model/origins.
No automatic routing changes a plain task into this ability. Ask and find flags are mutually
exclusive. Only the selected permitted HTTP(S) URL without query/fragment data can be opened.

The runtime intersects the user's tools with the existing read-only page subset and disables
writes and irreversible actions before opening Chrome. Find cannot click, type, press, scroll,
follow another page or grant itself permissions. Ordinary page-work commands retain their existing
explicit write/approval contract. Both modes share composition-level page-scope restrictions;
neither ability imports the other.

A finish proposal has `pageFind` with either `outcome: "matches"` and one to three ranked
`{snapshotId,target,reason}` / `{snapshotId,passageId,reason}` references, or
`outcome: "no-match"` and a reason. Targets must be visible, offered, enabled and noncredential.
Duplicate or invented references refuse. The current snapshot, live target handles and recaptured
visible passages must still agree before ranked results are displayed. Reopen keeps the saved
mode and permissions, recaptures and pauses before another model call. Cancellation during
validation cannot become a completed result.

The TUI prints numbered matches, captured labels/text and reasons through its existing escaped
rows. It adds no browser controls, highlighting, scrolling or action shortcuts. JSON retains the
structured result inside the finish step. Trace inspection remains the existing `/trace` route.
A `done` find result establishes current reference validity only: relevance is model-proposed,
not independently verified. No-match stays `uncertain` because absence cannot be independently
established from a model's assertion. Ambiguous descriptions can hand back through `ask_user`.
There is no calibrated confidence threshold yet. Capture is bounded and viewport-only; this is
not a whole-page, offscreen or canvas search.

## Remaining Phase 6 gates

- Finish `find-01`'s 20 independently labelled tasks, top-1/top-3 and no-match error reporting;
  include paraphrases, duplicate labels, frames, shadow trees, covered/offscreen targets and drift.
- Measure actual local-model ranking, calibrate on development data and freeze before held-out
  evaluation. Report hosted coverage as waived, never as a pass.
- Implement `work-01`'s explicit tool contracts/registration and supported effects, including the
  select/back/tab gaps. Retain one runtime and the existing target/approval/credential gates.
- Independently score the six-step form and 20 J2 tasks through the terminal. Include perturbations,
  attacks, session expiry, modal/429/irreversible steps and lifecycle failures per enabled adapter.
- Attach model-specific reports. Scripted contract checks establish no model-quality score.

Phases 8 and 9 remain live testing and final README presentation. No new production dependency,
permission, top-level directory, frontend or final plugin registry is introduced by this slice.
