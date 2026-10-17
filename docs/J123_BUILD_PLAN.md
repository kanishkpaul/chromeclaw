# Build plan after the bug fixes

ChromeClaw lives fully in the terminal as a TUI. J1 is research. J2 is work on a webpage. J3 is
finding from a vague description, on the page (J3a), in history (J3b), or on the web (J3c).
The job definitions come from local `new` at `2a8b4c1`; executable main at `50355b9` is the base.

This plan is proposed and every task is pending. It follows [BUG_FIX_PLAN.md](BUG_FIX_PLAN.md).
The owner's terminal direction on 17 October 2026 replaces this plan's earlier extension path.
The archived `new:docs/BUILD_PLAN.md` supplies ideas and evidence requirements, not a requirement
for a side panel, extension frontend, omnibox, Chrome built-in model or service-worker lifecycle.
See [DECISIONS.md](DECISIONS.md).

## Product and architecture

The TUI owns requests, answers, settings, provider selection, step history, approvals, hand-back,
pause/resume/cancel, sources and trace inspection. Browser pages are the work surface. The user
may interact with Chrome for login or takeover; every ChromeClaw control remains in the terminal.
One-shot CLI commands and clean JSON/JSONL output remain supported alongside interactive sessions.

Keep the existing TypeScript/Playwright implementation and one repaired agent loop. Extract pure
policy/loop decisions, page capture and egress only when their boundaries earn the code. Core has
no I/O or ambient clock/randomness. Browser and terminal adapters supply those dependencies. A
terminal frontend does not justify rewriting the project in Rust or adding another runtime.

Abilities, tools, model adapters and search backends remain four plugin kinds. Each owns its
folder and one registration line. Plugins import contracts, not each other; request tools/readers
through injected interfaces and IDs. The application composes registries and injects them into
core, so core need not import plugins. Record any actual package-boundary change with its PR.

Only egress sends model/search API requests; page navigation and page actions are gated browser
operations. Architecture checks distinguish fixture-site traffic from application egress. A
browser bridge, if later required for history/session access, contains only browser integration;
it adds no second loop or user interface. Do not build it before a measured API gap requires it.
Deleting a plugin and its registration line must leave check/build working. Unfinished plugins
remain disabled by default.

## Frontend sources and implementation standard

Use the master at `/Users/kanishk/Downloads/GitHub/design-kit` (`../design-kit` from this repo) and
preserved `new:design/`. Read the master's `system/DESIGN.md` and `system/TUI.md`, then compare
`new:design/README.md`, `new:design/kit.json` and `new:design/rust/{theme,palettes,identity}.rs`.
Borrow ChromeClaw's Ember skin, identity, terminal grammar and useful assets. Rewrite the
project-owned direction around a TUI. Do not carry forward the archive's side-panel layout.

Install/update through the kit workflow and record provenance in `design/kit.json`. Shared
changes belong in the master. Use a small TypeScript presentation adapter over kit tokens and
identity data if needed; do not hand-maintain another palette or port the entire Rust theme
module. Choose a terminal library only when a concrete interaction needs it, and record the
new dependency. Existing language and dependencies are the starting point.

The interface uses readable tool rows (`┊`), an interactive status line, source references and
approval blocks with explicit action/origin/reason. Approval defaults to deny; Enter alone never
authorizes an act. Respect NO_COLOR, terminal capabilities, light/dark settings and narrow widths.
No banner, animation, color or terminal control sequences in JSON/JSONL. Render page/model text
as data: escape ANSI/control sequences so it cannot spoof approval prompts or operate the terminal.

Follow `new:docs/ENGINEERING.md` for code, comments and commits, subject to the current terminal
direction. Prefer five clear lines over fifty when both satisfy the same contract. Avoid wrapper
layers, speculative abstractions and dependency growth. Keep required validation and safety even
when they cost lines. Comments explain why and contracts; commits are focused, imperative and
state verification and gaps. No attribution trailers. The bug-fix plan makes these review checks
explicit for every task.

## BYOK and local models

Every job supports user-configured BYOK hosted adapters and local model servers through one
reply contract. Start with OpenAI-compatible endpoints, including Ollama, LM Studio and llama.cpp.
Implement distinct adapters where a provider requires a different protocol. The TUI shows model,
endpoint and local/hosted status before execution, and permits explicit provider/model selection.

No bundled hosted credentials, silent provider changes or local-to-cloud fallback. Keep keys out
of prompts, traces and terminal output. Apply the same envelopes, target checks, approvals,
credential refusal and budgets in both modes. Capability profiles control vision, context and
structured-output support; missing capabilities are reported, not guessed. Fully local runs use
no hosted model API, though requested web browsing still contacts the chosen sites/search backend.

Acceptance for each job includes one actual BYOK hosted model and one actual local model, with
reports separated by adapter/model. A scripted mock proves loop plumbing only. Missing real model
access keeps that acceptance check open. Planning does not authorize paid calls or credential use.

## Retain and upgrade safety

Use the old policy and tests as an inventory, not as proof of protection. Preserve the intent of
credential/login hand-back, CAPTCHA/paywall/security-bypass refusal, consequential-action approval,
restricted destinations and inspectable traces. Upgrade mechanisms where audit evidence shows
a failure. Map each old protection to a replacement regression; local execution cannot disable it.
Keep fixes to false positives separate from permission expansion. [BUG_FIX_PLAN.md](BUG_FIX_PLAN.md)
defines the gates and their real-browser checks.

## Delivery sequence

`fix-09 → tui-00 → tui-01 → find-01 (J3a) → work-01 (J2) → research-01 (J1) → find-02/03 (J3b/J3c) → daily-01`

`tui-00` and `tui-01` replace the earlier unimplemented `ext-00` and `ext-01` proposals. Grounding
precedes acting; verified page work precedes multi-source orchestration. J1 supplies shared
search/reader interfaces for J3c without making one ability import another.

### tui-00: Make the terminal the complete control surface

Bring the repaired runtime into an interactive terminal session using the kit sources above.
Support multiline input, streaming replies, step history, provider settings, source/trace views
and explicit approval/answer input. Keep terminal rendering separate from trusted runtime events.
Persist task checkpoints; interruption or reconnect recaptures the browser and pauses before acts.

Measure connecting to a user-authorized browser session versus a ChromeClaw-owned profile. Do not
silently attach to a personal default profile or assume existing sessions are accessible. Handle
browser disconnect, terminal resize, EOF, Ctrl-C, user takeover and long model streams. Record any
browser integration limitation before choosing an auxiliary bridge.

Done when: a PTY recording shows task input, progress, ask/answer, approval/denial, cancellation and
trace inspection in the TUI while a real browser runs the fixture. Narrow width, noninteractive
output, NO_COLOR and JSON/JSONL cases behave correctly. Terminal injection text cannot rewrite a
trusted approval row. An interrupted run cannot execute a stale pending action on restart.

### tui-01: Read a page and answer with evidence

Wire the repaired page model, one prompt builder, egress and provider profiles into the TUI.
Add an `ask` ability with passage IDs bound to captured snapshots. Source selection reveals the
passage in the terminal and can explicitly open the cited page in Chrome. Validate link schemes.
The trace shows proposals, gates, actual crossings and verified results without secrets.

Measure grounding before enabling actions for a profile. The archive's 50 labelled snapshots and
30 challenging sites are sampling targets, not completed coverage. Include frames, shadow roots,
scrims, React forms, virtualized lists and canvas-only content; report unreadable regions.

Done when: 20 controlled ask tasks have independent answer checks and resolvable citations. The
TUI can inspect their passages and safe traces. Run a configured BYOK model and an actual local
model separately. Provider failure does not silently switch endpoints. A screenshot alone does
not establish grounding and missing adapter coverage stays explicit.

### find-01: J3a, find on the page

Depend on tui-01. Rank up to three observed elements/passages from a vague description. Show
numbered results and reasons in the TUI; optional browser scrolling/highlighting only reveals
the result and adds no page-based control UI. Low confidence produces no-match or a clarification.
Bind results to snapshots and revalidate before revealing them. This mode does not click controls.

Done when: a 20-task labelled fixture set reports top-1/top-3 and no-match errors per model.
Duplicate labels, paraphrases, missing/offscreen/covered targets, frames and stale results are
covered. A TUI/browser recording shows the correct labelled element found without act permission.
Calibrate confidence on the development set, then freeze it before held-out evaluation.

### work-01: J2, page work

Depend on find-01 and fix-09. Register click, type, select, press, scroll, navigate, back, wait and
tab tools with honest effects and permission metadata. Use the browser driver's trusted input
path and trace any fallback. Reuse target bindings, credential refusal and action-bound approval.

The TUI shows the proposal, steps, budgets and pause/resume/cancel controls. Credentials and CAPTCHA
hand control to the person in Chrome, then Continue triggers fresh capture. Scope permissions
before page reads. Keyboard/form submission reaches the same gate as clicking a submit button.

Done when: a six-step form and 20 fixture tasks reach independently checked states through the
terminal. Run selector drift, duplicate targets, session expiry, a modal, 429 and an irreversible
step. Attack fixtures cover hidden/image instructions, OTP theft, URL exfiltration, deceptive
controls and disguised credentials, with zero unsafe acts per enabled adapter. Browser/terminal
loss, takeover and cancellation have traces. Report unknown/non-English label gaps plainly.

### research-01: J1, research

Depend on work-01 and tui-01. Add engine-tab search, then compare API candidates before choosing
an API backend. Every API request uses egress. Search CAPTCHA hands back. Queries derive from
user intent and the trusted plan; source text cannot append private page/history data to a query.

Plan subquestions, search, deduplicate URLs and read bounded background tabs. Show source hosts,
notes, progress and budgets in the TUI while the user continues browsing. Own and clean up only
the tabs created by the run. Use a browser tab group only if the chosen driver supports it;
terminal tab tracking is sufficient. Per-source failure and cancellation stop their work.

Synthesize claims with source/passage references. Distinguish citation resolution from evidence
support: keyword overlap is diagnostic, not entailment. Reject invalid references, report
contradictions and qualify unsupported claims. Reading sources never grants write permission.

Done when: a fixture question has a trace from search through supported claims; budget stops and
five concurrent reader tabs have recorded results. A 20-question set reports answer correctness,
citation validity and support per BYOK/local model. Live held-out questions stay separate and
classify site/model/agent failure. Poisoned sources cause zero unsafe acts. Sources and passages
are reviewable from the terminal.

### find-02: J3b, find in my history

Depend on tui-01 and use shared reader interfaces. First prove bounded history/bookmark access
with the selected browser integration. If a minimal browser bridge is required, record that gap,
its permission scope and transport before building it. All requests and approvals remain in the
TUI. Do not scrape a live personal profile database or add a browser frontend as a shortcut.

Search explicit time windows and title/URL terms, filter locally, and send only approved candidate
metadata to a hosted model. Open a bounded shortlist to confirm the target. Show the searched
scope and support forgetting retained notes. Measure 20 personal recollections before deciding
whether an opt-in local text/embedding index earns its storage and maintenance cost.

Done when: seeded history tasks recover known URLs in the top three, unselected private pages
remain unread, and revoking access stops the search. Report per-query misses separately. If an
index is justified, measure its incremental gain, deletion and quotas, and verify it stays local.

### find-03: J3c, find on the web

Depend on research-01. Use injected search/readers in the find ability to return a verified target
URL and a reason it matches. Search snippets are candidates, not proof. Handle redirects,
duplicates, unavailable targets and explicit no-match. Route from TUI requests or one-shot CLI
flags; the chosen mode and permission scope are visible before execution.

Done when: labelled vague queries return known canonical URLs and refuse absent targets. All
three find modes work through TUI and machine-readable CLI with identical permission construction.
Report top-1/top-3 and no-match errors separately for BYOK/local model profiles. Routing cannot
silently convert a read request into a write task.

### daily-01: Make the three jobs dependable

Use the TUI for a week of bounded personal tasks. Each failure becomes an eval before its fix.
Add adapters, cross-tab ask or routing complexity only when recorded needs justify them. Generate
model reports from the acceptance reports, separating fixtures, perturbations, attacks and live
held-out tasks. Report cold/warm latency, steps, tokens/cost, interventions and refusal errors.

Done when: seven days of traces are reviewed, every observed failure has a regression, docs match
the actual commands and enabled plugins, and the TUI remains usable under long output and resize.
Existing safety regressions still pass. Mock scores never stand in for model quality.

## First implementation cut

Start with fix-00, credential suppression and target-bound gates, then complete the bug-fix release.
The next feature work is the terminal frontend and J3a, not an extension shell. Keep each delivery
small enough to review, with the shortest clear implementation that meets its acceptance checks.
No code, model compatibility or job completion is claimed by this planning update.
