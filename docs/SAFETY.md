# Safety status and retained protections

Phase 2 adds independent credential guards at capture and driver boundaries. The broader runtime
still uses legacy regex policy, free-form selectors and no fixed task envelope. Do not use this
intermediate state as unattended control of signed-in sites. The credential suite is specific
regression evidence, not proof of general agent safety.

| Existing intent | Current mechanism and gap | Replacement and evidence |
|---|---|---|
| Hand back for credentials/login | p2-01 suppresses field values and refuses credential writes, focus-time changes and keyboard bypasses; refusal still terminates the run | Remaining Phase 2 target bindings; Phase 3 fresh-capture continuation |
| Refuse CAPTCHA, paywall and security bypass | Task/page/action regexes can both overblock and miss context | Phase 2 task scope and gate regressions; hand-back stays mandatory |
| Confirm sending, purchases and destructive changes | Keyword scan cannot read the actual resolved control | Phase 2 observed-control and irreversible-action gates, including keyboard submission |
| Restrict browser/file/local destinations | URL regexes are incomplete and there is no task-origin envelope | Phase 2 parsed scheme/origin/redirect checks and fixed permissions |
| Inspectable run trace | Typed action values/reasons are withheld; arbitrary user/page prose is not a PII scrubber, and context/durability gaps remain | Phase 3 safe structured events, egress and durable reads |
| Treat model/page text as data | Prompts interpolate text without confinement | Phase 2 fixed powers and Phase 3 one fenced prompt builder and egress |

Preserve these protection goals as their mechanisms change. Each replacement must name the old
behavior, its false-positive cases, the bypass fixture and the new enforcement point. Hosted and
local models use identical gates. A provider or page cannot approve an action, grant origins or
turn off credential refusal. Existing tests are retained or replaced with stronger regressions;
a label in this table is not evidence that the protection currently works.


Credential checks use type/password, parsed autocomplete tokens and label signals. No credential
setting grants an override. Raw AX field values are not read into the observation. Screenshots
on known credential/framed pages are withheld; other screenshots mask form controls. This is not
canvas/image secret detection. Ordinary editing uses a native setter with input/change events;
React/live-site behavior is not established by the fixture alone. Native AX comparison, semantic
roles, stale-target bindings, origin/commit gates and hand-back/resume still have open gates.

A generic text field with no credential type, autocomplete or recognizable label cannot be
identified as a credential sink from metadata alone. Field values are still omitted from capture,
but this is not a proof against deliberately mislabelled custom widgets. Fresh target admission
and adversarial fixtures remain open Phase 2 work; the full phase is not marked complete.
