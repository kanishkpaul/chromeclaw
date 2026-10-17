# Safety status and retained protections

The current runtime still uses the legacy regex policy. Phase 1 fixes measurement, not the unsafe
behavior identified in `docs/MAIN_AUDIT.md`. Do not use this baseline as unattended control of
signed-in sites. Passing the credential-labelled refusal fixture does not prove general safety.

| Existing intent | Current mechanism and gap | Replacement and evidence |
|---|---|---|
| Hand back for credentials/login | Text-pattern confirm terminates the run; generic password fields can be read/typed | Phase 2 credential metadata/read-write refusal, Phase 3 fresh-capture continuation |
| Refuse CAPTCHA, paywall and security bypass | Task/page/action regexes can both overblock and miss context | Phase 2 task scope and gate regressions; hand-back stays mandatory |
| Confirm sending, purchases and destructive changes | Keyword scan cannot read the actual resolved control | Phase 2 observed-control and irreversible-action gates, including keyboard submission |
| Restrict browser/file/local destinations | URL regexes are incomplete and there is no task-origin envelope | Phase 2 parsed scheme/origin/redirect checks and fixed permissions |
| Inspectable run trace | JSONL exists but can contain secrets and lose action/result context | Phase 2 suppression, Phase 3 safe structured events and durable reads |
| Treat model/page text as data | Prompts interpolate text without confinement | Phase 2 fixed powers and Phase 3 one fenced prompt builder and egress |

Preserve these protection goals as their mechanisms change. Each replacement must name the old
behavior, its false-positive cases, the bypass fixture and the new enforcement point. Hosted and
local models use identical gates. A provider or page cannot approve an action, grant origins or
turn off credential refusal. Existing tests are retained or replaced with stronger regressions;
a label in this table is not evidence that the protection currently works.
