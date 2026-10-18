# Find freshness on pages that mutate after load

Status: Kanishk chose option B on 2026-10-18; implemented under D-032. The reproduction now
requires the clock and layout-shift cases to complete and the five cited-change controls to
refuse; [after the change](evidence/find-freshness/after-source.log) it passes 10/10. On the
live page, `find-node` now stops at the separate duplicate-label rule instead of freshness. The
analysis below is retained as written before the decision.

## Problem

Read-only find (`/find URL description`) refuses any result once the page has changed anywhere
since capture. `verifyPageFind` first calls the runtime's freshness callback. That callback
requires `snapshotIsCurrent`, a document-wide MutationObserver plus form-state check (D-015),
and it also requires every recaptured passage to equal the captured set. `targetIsCurrent` calls
`resolveTarget`, which repeats the same document-wide check. A page with a timer, scroll spy,
rotating banner or live clock therefore never yields a find result. Recapturing does not help,
because the page mutates again before validation.

Phase 8 hit this on `https://nodejs.org/api/`. The Day 1 case `find-node` failed with "Find
results are stale" in the scripted lane and the local-model lane, originally and in both Stage 7
retest rounds. A scripted planner reproduces it, so it is not a model miss.

## Reproduction

[`find-freshness.browser.mjs`](../packages/agent/tests/find-freshness.browser.mjs) serves a
loopback page with a People link, a team passage and a clock that only starts after capture.
Nine scripted cases pass from [source](evidence/find-freshness/source.log) and [compiled](evidence/find-freshness/built.log) code:

| Case | Page change after capture | Today | Must stay |
|---|---|---|---|
| static target / passage | none | done | done |
| unrelated clock, cited target | clock text | **stale** | open question |
| unrelated clock, cited passage | clock text | **stale** | open question |
| cited link relabelled | link text | stale | refused |
| cited link retargeted | link href | stale | refused |
| cited link replaced | node swapped for a copy | stale | refused |
| cited link covered | overlay above it | stale | refused |
| cited passage changed | passage text | stale | refused |

Today every refusal comes from the first, document-wide gate. The reproduction alone therefore
does not show whether the per-reference checks would catch the five controls on their own.

## Options

**A. Keep whole-snapshot freshness.** Simplest and most conservative. Find stays unusable on
mutating pages, and the user sees an endless "capture again" hand-back.

**B. Per-reference freshness for find only.** Accept a result when four things hold:
- the page URL is unchanged;
- each cited target is the same retained, connected node, with an unchanged fingerprint (role,
  name, destination, metadata), visible and unoccluded;
- each cited passage recaptures to the same text at the same ID;
- the credential, duplicate-label and confidence checks still pass.

Unrelated mutations are ignored. A throwaway prototype, measured and then reverted, gave this
result ([log](evidence/find-freshness/prototype-option-b.log)): both clock cases completed, and
all five controls still refused, four via the target check and one via the passage check.

**C. Mutation-region scoping.** Keep the MutationObserver, but ignore records outside the cited
nodes' ancestry. This is more code across frames and shadow roots, and unrelated mutations can
still move or cover a target, which needs the same per-reference recheck as B anyway.

**D. Retry until the page settles.** A page with a running timer never settles; rejected.

## Safety analysis

Find never activates, types or navigates. Its result is data shown in the terminal, and the
runtime already refuses act proposals in find mode. Any later activation still goes through the
full document-wide snapshot binding and exact one-use approval, which B does not touch. Ask does
not use this freshness callback. Interactive page work keeps D-015 unchanged.

B's residual risk is context drift. The cited link can stay identical while nearby, uncited
text changes its meaning; for example, a heading above it is rewritten. Relevance is already
model-proposed rather than verified, and the result says so. B also turns some loops that never
complete into results bound to the evidence actually cited. Page content still cannot widen
origins, tools or writes.

## Recommendation

Adopt B for read-only find only. In the same change:
- record it as a decision amending D-015 for find;
- flip the two clock rows in the reproduction to `done` and keep the five controls as must-refuse regressions;
- rerun the find, find-labelled, safety, work-safety and TUI suites;
- live-retest the Day 1 `find-node` case, which then stops counting as held out.

Keep A if any find result is ever allowed to feed an automatic activation without fresh capture.
