# Phase 6 find starter evidence

This slice starts `find-01`; it does not complete Phase 6. The implemented contract and remaining
acceptance criteria are in [PHASE6.md](../../../PHASE6.md). All browser tasks use isolated synthetic
sites and profiles. No hosted/local inference or paid requests were performed in this slice.

| Check | Result | Evidence |
|---|---|---|
| `pnpm check` | 66 tests / 17 files; build, strict types, lint pass | `check-verified.log` |
| Find contracts, source | 14 checks pass; zero unsafe submissions | `find-source/` |
| Find contracts, compiled | 14 checks pass; zero unsafe submissions | `find-built/` |
| Inherited ask, source | 20 reading tasks + 5 additional checks pass | `ask-source/` |
| Inherited ask, compiled | 20 reading tasks + 5 additional checks pass | `ask-built/` |
| Inherited safety | 35 source + 35 compiled groups pass | `safety-source.log`, `safety-built.log` |
| Compiled TUI in a real PTY/Chrome | 13 groups pass; exactly one correct Kolkata save | `terminal/` |

Find cases exercise targets, passages, mixed ranks, duplicate labels/references, invented targets,
credential refusal, stale passages, no-match uncertainty, clarification, blocked click/type/scroll/
navigation and saved-mode reopen. A trusted custom verifier cannot bypass find's own validation.
Hidden and offscreen controls are absent from the offered list. This is scripted contract coverage;
it has no top-1/top-3 model-quality denominator and is not the planned 20-task labelled J3a set.

The PTY recording includes `/find`, a numbered result with captured passage text/reason, and a
completed reference-valid result under read-only permissions. Its other twelve groups recheck
approval/denial, state, source inspection, stream cancellation, browser loss, reopen, resize and
terminal injection. `terminal/*.cast` and `*.txt` retain the actual terminal output. Raw JSONL and
reports are included for find, ask and terminal runs. Safety logs contain that suite's assertion
report; its old JSONL inventory is not duplicated here. Screenshot paths in traces are local
runtime artifacts and images are not part of this archive.

## Development failure retained

The first final compiled find run failed while starting Chrome for the no-match case after eight
checks. `development-failure/` and `find-final-built.log` retain its report, failed trace and
assertion. The runtime withheld startup diagnostic details, so a root cause is not established.
An unchanged rerun after the other fixture suites completed passed all fourteen checks; see
`find-rerun-built.log` and `find-built/`. No assertions, expected states or safety gates were relaxed.
Earlier typechecking also caught a mutable observation captured in async validation callbacks;
the implementation now captures a stable local observation before constructing those callbacks.

## Reproduce

```sh
pnpm check
pnpm eval:find
pnpm exec tsx --tsconfig tsconfig.base.json packages/agent/tests/find.browser.mjs --built
pnpm eval:ask
pnpm exec tsx --tsconfig tsconfig.base.json packages/agent/tests/ask.browser.mjs --built
pnpm eval:safety
pnpm exec tsx --tsconfig tsconfig.base.json packages/browser/tests/safety.browser.mjs
pnpm eval:tui
```

The source SHA-256 manifest pins the tested implementation and new fixture inputs. Evidence-local
attributes preserve raw logs, traces and casts byte-for-byte. The suites use installed Chrome on
this Mac and the existing Chromium fallback elsewhere; Node 24.18.0, pnpm 10.23.0, Python 3.
CI now runs source/compiled find and the extended TUI suite; local success alone does not establish
that the hosted workflow has run.

Unverified: actual-model ranking/calibration, held-out sites, J2 select/back/tab and its 20-task
acceptance, signed-in readiness, non-English label coverage, optional browser reveal and final
plugin registries. No-match is uncertain, freshness is a point-in-time check and relevance remains
model-proposed. Hosted inference stays waived; Phases 8 and 9 remain live testing and final README.
