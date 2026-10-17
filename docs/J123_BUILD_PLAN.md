# Build plan after the bug fixes

J1 is research. J2 is work on a page. J3 is finding from a vague description, on the page (J3a),
in history (J3b), or on the web (J3c). These definitions come from local `new` at `2a8b4c1`.
The implementation base is executable GitHub main at `50355b9`.

This plan is proposed, and every task is pending. It follows [BUG_FIX_PLAN.md](BUG_FIX_PLAN.md).
The archived plan is available through `git show new:docs/BUILD_PLAN.md`; its original phase/task
IDs remain useful references, not evidence that a phase is complete.

## Product and architecture

Ship a personal Chrome side-panel extension that reuses existing signed-in sessions, supports
hosted and local model adapters, shows its work and hands control back for credentials. Keep
the repaired CLI as a harness and diagnostic entry point. Reject a second independent extension
loop: every later recovery or gate fix would otherwise need two implementations.

Extract the repaired pure decisions into `packages/core`, page capture into `packages/page` and
transport into `packages/egress`. The shell supplies Chrome storage, tabs, debugger, clock and
abort operations. Core performs no I/O and reads no ambient time or randomness.

Abilities, tools, model adapters and search backends remain four separate plugin kinds. Each has
its own folder and one registration line. Plugins import contracts, not other plugins. Abilities
request tools or search through injected interfaces and IDs.

The archived architecture puts registries inside core and also says core cannot import internal
packages. Resolve that conflict before implementation: core owns registry types and validation;
the application composition root imports plugin objects into plain registry arrays and injects
them. This keeps the dependency graph inward. Record this choice in `docs/DECISIONS.md` in the
same PR that extracts core. Do not introduce a dynamic loader or runtime plugin marketplace.

Only extension code calls `chrome.*`; only egress calls fetch. Page navigation and page actions
are separately gated browser operations. The architecture test must distinguish a fixture site's
network activity from extension-originated off-machine requests. Deleting a plugin and its one
registration line must leave check/build working. Unfinished registered plugins start disabled.

Use the preserved design kit for panel, options, overlay and harness output. Restore it through
the master update workflow rather than inventing local tokens. Record new dependencies,
permissions and top-level directories as decisions. Request history/bookmark permissions only
when the user enables the history feature; page read access is scoped to the task.

## Delivery sequence

`fix-09 → ext-00 → ext-01 → find-01 (J3a) → work-01 (J2) → research-01 (J1) → find-02/03 (J3b/J3c) → daily-01`

This order gives each next job a tested dependency. J3a proves target grounding before actions;
J2 proves the loop and interruption paths before parallel source reading; J1 provides search,
source reading and evidence checking that J3c can reuse through interfaces.

### ext-00: Prove the Chrome shell and extract the shared core

Archived references: p0-01, p0-03, p0-05 through p0-10, p3-01 and p3-08.

Deliver a small MV3 extension, side panel and extension-loading harness. Move pure runtime
decisions out of the Node agent while retaining its working CLI adapter. Do not carry filesystem,
process environment or Playwright into core. Decide plain Vite versus WXT from the spike, not from
an untested preference. Record the actual minimum Chrome version and permission list.

Measure a two-minute model stream, worker termination/restart, trusted versus synthetic input,
background-tab AX/screenshot/input, local endpoint reachability and Prompt API availability.
Checkpoint each step. A restarted worker pauses and recaptures; it never resumes a stale act.
If long tasks require an offscreen host, make that choice from the measurement.

Done when: the unpacked build loads and the panel opens in a real browser; the CLI and extension
exercise the same core decisions; a removal drill passes; killing the worker pauses the task;
each spike has command/steps and a recorded result. Use bundled Chromium to load the extension
and separately verify the installed Chrome daily-use path. Existing CLI fixture success does
not count as extension evidence.

### ext-01: Read the page and answer with evidence

Archived references: p0-02, p1-01 through p1-11.

Bring the repaired page model, prompt builder, egress and trace into the extension. Start with
OpenAI-compatible hosted/local endpoints and add Anthropic as an independent adapter. Probe Chrome's
built-in model and ship its adapter disabled when unavailable; explain setup rather than silently
falling back. Profiles declare vision, context, structured replies and local/hosted destination.

Add an `ask` ability, passage IDs tied to captured snapshots, clickable citations, options driven
by plugin settings, and a trace view showing permission decisions and actual crossings. Panel
rendering creates DOM from parsed Markdown with raw HTML disabled. Treat both model prose and
source links as untrusted. Define safe link schemes and explicit source opening.

Measure grounding before enabling actions on a model profile. Use the archived proposal of 50
labelled snapshots and 30 challenging sites as sampling targets, not completed coverage. Include
shadow roots, frames, scrims, React forms, virtualized lists and canvas-only content. Report
unreadable regions rather than implying text coverage. A screenshot alone does not prove grounding.

Done when: 20 controlled ask tasks have independent answer checks and resolvable passage citations;
the panel can reveal a citation; provider/settings changes work without UI special cases; traces
contain no synthetic credential markers. Report each configured real model separately. Disabled
or unavailable adapters remain explicit gaps, never substitutes for passing all-model coverage.

### find-01: J3a, find on the page

Archived references: p2-01 through p2-04. Depend on ext-01.

Implement a `find` ability with on-page mode. Given a vague description, rank up to three offered
nodes/passages, give short reasons and reveal/highlight them. Low confidence returns no-match or
asks a clarifying question. It does not click. Bind each result to a snapshot and revalidate before
scrolling/highlighting. Remove overlay state on navigation, cancellation and task end.

Use a closed shadow-root overlay styled by the shared kit. It must not obscure the target or be
included as page content in later capture. Keyboard access and screen-reader feedback matter on
this surface; color alone cannot identify the selected candidate.

Done when: a 20-task labelled fixture set reports top-1/top-3 and no-match behavior per profile;
duplicate labels, paraphrases, absent targets, offscreen targets, overlays, frames and stale results
have explicit tests. A real-browser demo shows a vague request finding the labelled element with
no act permission. Propose the confidence threshold from calibration, then freeze it before held-out use.

### work-01: J2, page work

Archived references: p3-01 through p3-11. Depend on find-01 and fix-09's verified loop.

Register independent click, type, select, press, scroll, navigate, back, wait and tab-management
tools with accurate effect, irreversibility, cross-origin and permission metadata. Attach debugger
only when trusted input is needed and detach on completion/cancel. Keep driver fallback explicit
and trace it. Reuse numbered target bindings, credentials refusal and action-bound approvals.

The panel shows current proposal, steps, budgets, Allow/Deny, Stop and hand-back/Continue. A real
user interaction pauses autonomous control. Scope the permissions before reading any task pages.
Page text cannot expand them. Submission through keyboard and form APIs must reach the same gate
as pressing a submit button.

Done when: a six-step form and 20 fixture tasks reach independently verified page states. Run all
six perturbations from fix-06. Attack fixtures include hidden text, image instructions, OTP theft,
URL exfiltration, a deceptive overlay and disguised credential fields. Record zero unsafe acts for
every enabled adapter. Worker death, panel closure, user takeover and mid-request cancellation have
traces. Unsupported/non-English commit-label cases are reported as gaps, not solved by English regexes.

### research-01: J1, research

Archived references: p4-01 through p4-09. Depend on work-01 and ext-01.

Build `engine-tab` as the first search backend and compare it with API candidates before choosing
one API backend. All API calls use egress. Search-engine CAPTCHA is a hand-back. Search queries
come from user intent and the trusted research plan; a source cannot append a query carrying
private page/history data. Proposed expansion beyond the envelope pauses for user direction.

The research ability plans subquestions, searches, deduplicates canonical URLs, opens bounded
background tabs in a ChromeClaw-owned group, extracts passages, records notes and synthesizes
claims with source/passage references. Use per-source timeout and concurrency limits. Closing the
group stops its tasks. Read operations do not gain write privileges by being part of research.

Make citation validity and evidence support separate checks. A passage ID existing proves only
that a citation resolves. Keyword overlap is a weak diagnostic, not proof of entailment. Evaluate
support against labelled claim/passage pairs, record contradictions and qualify unsupported claims.
Do not silently drop an invalid cited ID or present it as a grounded answer.

Done when: a multi-source fixture question has a trace from search through supported claims; every
citation resolves to the captured passage; the source/time/cost budget stops a run; five concurrent
reader tabs have measured throttling behavior. A 20-question set reports answer correctness,
citation validity and citation support separately. Held-out live questions are separate from
fixtures and tagged site-changed/model/agent failure. Poisoned sources cause zero unsafe acts.

### find-02: J3b, find in my history

Archived references: p5-01 through p5-03, p5-05 and p5-07. Depend on ext-01; use J1's reader interface.

Add history/bookmark tool plugins with optional permissions, explicit time windows, title/URL
search and local candidate filtering. Send only the approved candidate metadata to a hosted model.
Do not send the whole history because one request says "that page last week". Record the crossing.

Rerank candidates and open only a bounded shortlist to verify the target. Show which records
were searched and allow forgetting stored notes. A local index is conditional: first run 20 real
recollections and measure title/URL retrieval. Add page-text indexing and embeddings only if those
misses justify the storage, consent, model download and deletion work.

Done when: seeded-profile tasks recover the known URL in the top three, never read unselected
private pages, and revoking permission stops access. Report the 20 personal recollections as a
small sample with per-query misses. If indexing is added, measure incremental gain and verify
deletion, quota handling and that index/embeddings stay on the device.

### find-03: J3c, find on the web and shared entry points

Archived references: p5-04, p5-06 and p5-07. Depend on research-01; do not import its ability plugin.

Extend the `find` ability with web mode using injected search/reader services. The outcome is a
verified target URL and a reason it matches the description. Search snippets alone are candidates,
not proof. Handle redirects, duplicates, unavailable targets and explicit no-match.

Wire panel, context menu and omnibox `cc` through the shell. Show the selected ability before a
permission-bearing task starts. A router cannot silently turn a page question into a write task.

Done when: a labelled vague-query set returns known canonical URLs and refuses the absent targets;
all three find modes work through each entry point; permission/envelope construction is identical
across entry points; adapter-specific top-1/top-3 and no-match errors are recorded.

### daily-01: Make the three jobs dependable

Archived references: p6-01 through p6-05.

Run a week of personal use with bounded tasks. Each failure becomes a fixture/eval before its fix.
Add cross-tab ask, additional adapters or router refinement only when a recorded need supports it.
Keep a per-profile model report generated from the same reports used for acceptance. Track cold
and warm latency separately, steps, token/cost estimates, interventions, refusal errors and unsafe
acts. Keep the safety target at zero; derive capability baselines from measurements.

Done when: seven days of traces are reviewed, each observed failure has a regression case, current
docs match actual commands and enabled plugins, and the published report distinguishes fixtures,
perturbations, attacks and live held-out runs. No single mock score stands in for model quality.

## First implementation cut

Start with `fix-00`, followed by credential suppression and target-bound gates. Finish and measure
the bug-fix release before opening extension feature work. No dates or model-quality thresholds
are promised before the baseline. The deliverable of this audit is the plan and evidence, not a
claim that any of these jobs has shipped.
