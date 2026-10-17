# Selective Blindfold reuse

Reviewed upstream `ArneshBanerjee/blindfold` at
[`2f04984`](https://github.com/ArneshBanerjee/blindfold/tree/2f04984d66fec2aa854665a40bf2c8044de31758).
The source was cloned into `/private/tmp/chromeclaw-blindfold-20261017`; the user's modified local
clone was left untouched. The older fork was not needed to recover these components.

Kanishk explicitly authorized inspiration and selective code reuse on 17 October 2026. That
direction supersedes the archived ChromeClaw D-008 blanket no-copy policy for this work. No production behavior was copied during the Phase 0 audit. Phase 1 adapts the report
ordering/count conventions and CI bootstrap; details are in D-013 and its evidence. Record the decision when the first port lands. No root LICENSE
file was found in the inspected upstream tree; do not label upstream code MIT merely because
ChromeClaw is MIT. Preserve applicable notices and document the rights basis of the selected files.

## Pieces to adapt

Paths below are relative to the pinned upstream tree. The suggested destinations are prospective
ChromeClaw modules, not files created by this audit. Read the listed tests with the source when
porting; this audit did not execute Blindfold's test suite.

| Piece | Upstream source and tests | Use in ChromeClaw | Adaptation needed |
|---|---|---|---|
| Credential flags and withheld values | `browser/src/content/extract.ts`, `core/src/credentials/index.ts`; `browser/tests/extract.test.ts`, `core/tests/credentials.test.ts` | fix-01 capture and driver admission; later `packages/page` and a core gate | Keep type/autocomplete metadata. Parse token lists rather than comparing the whole autocomplete string. Extend coverage to keyboard/paste/submit and screenshots. Strip Blindfold vault/contract dependencies |
| Numbered visible candidates | `core/src/pagemodel/index.ts`; `core/tests/pagemodel.test.ts` | fix-02 targets, J3a and J2 | Keep index-to-node mapping. Add snapshot/document/frame binding and pre-act revalidation; `atIndex` alone looks up whichever model it is given and does not establish freshness |
| DOM capture, naming and geometry | `browser/src/content/extract.ts`, `name.ts`, `roles.ts`, `geometry.ts`; `browser/tests/extract.test.ts` | `packages/page` | Extract the coherent capture helpers without importing overlay/indicator modules. Implement and measure shadow/frame coverage. A null hit test currently allows the node; choose and test explicit fail-closed action behavior when hit testing is unavailable |
| Prompt confinement | `core/src/confine/index.ts`; `core/tests/confine.test.ts` | fix-04 one prompt builder | Port escaping, neutralized closing tags and control-token tests. Keep tag/attribute names owned by code. Route all page-derived fields through it; do not describe a formatting fence as sufficient injection defense |
| Frozen task envelope | `core/src/envelope/index.ts`; `core/tests/envelope.test.ts` | fix-03 fixed tools, origins and budgets | Remove Blindfold IDs/contracts. Inject clock and cancellation. Enforce expiry at the actual execute boundary. Separate always-allowed reporting from permission-bearing acts |
| Control-label irreversibility | `core/src/irreversible/index.ts`; `core/tests/irreversible.test.ts` | fix-03 gate reading target metadata | Preserve field-versus-control distinction and dismissal exceptions. Make tool metadata the entry point, include keyboard submit, and keep English/unknown-label limitations visible |
| Approval binding | `core/src/action-approval/index.ts`; `core/tests/action-approval.test.ts` | fix-05 approve one action and relevant state | Use the binding/replay/expiry test cases. A local terminal application need not inherit signatures, protocol identities or a server. Make state checks mandatory when the approval requires them |
| Cancellation notification | `core/src/killswitch/index.ts`; `core/tests/killswitch.test.ts` | fix-05 state and abort propagation | Prefer AbortSignal at I/O boundaries. Keep synchronous trip checks. Racing a promise does not cancel an already issued browser operation; test actual cancellation and truthful reporting |
| Request-before-send crossing record | `browser/src/egress/index.ts`, `disclose.ts`, `off-machine.ts` | fix-04 `packages/egress` | Port ordering and dependency injection, not attestation, delegation, face redaction or a server deployment. Log safe metadata, never authorization headers or resolved secrets |
| Strict replies and numbered lookup | `server/src/model.ts`; `server/tests/model.test.ts` | provider-independent protocol and adapter parser | Reuse one fenced-block unwrap and checked index resolution. Remove pinned models and server routing. Put schema instructions and local parsing in agreement |
| Step result union and verification seam | `core/src/agent/step.ts`, `task.ts` | fix-06 pure decision/result contracts | Reuse explicit outcomes and injected dependencies. Do not inherit the entire loop, automatic rollback or pacing layers. Verify expectations against the real page before claiming recovery |

## Limits discovered while reading

`core/src/agent/step.ts` returns `mismatch_rolled_back` after `checkAndRollback` supplies a
rollback action; that step does not itself execute the rollback. ChromeClaw must not copy that
status as proof that the browser was restored.

`server/src/model.ts` drops invalid citation indices while resolving references. Its existence
does not establish that a claim is supported. ChromeClaw should reject invalid references and
measure support separately, using text passages as well as controls for research answers.

`core/src/executor/index.ts` composes several gates but is not a drop-in enforcement boundary:
its local kind/origin checks do not themselves check envelope expiry through `envelope.permits`.
Audit the full call path before reusing it. ChromeClaw should keep one admission path with
pre-execution revalidation, not assume that a module named gate provides every invariant.

The extractor's browser helpers depend on Blindfold contracts and overlay identities. Copying one
file without its semantic helpers would lose accessible names and credential handling. Conversely,
copying its whole browser package would bring unrelated UI and egress assumptions into ChromeClaw.

## What stays out

Do not import Blindfold as a runtime package or copy its entire core. The personal project does
not currently need surrogate vaults, remote attestation, payment infrastructure, peer protocols,
personal-memory/indexing systems, face/vision classifiers, server routing or skill marketplaces.
J1 needs source passages and task budgets before any of those systems.

## Porting procedure

1. Pick one piece for the current fix task, pin the upstream commit and list its dependency slice.
2. Adapt types to ChromeClaw's contracts and inject I/O. Keep plugins independent.
3. Bring the relevant behavior tests, remove irrelevant assumptions and add ChromeClaw's regression.
4. Register and wire the feature in the same PR; leave it disabled if its acceptance gate is open.
5. Run `pnpm check`, then the real-browser fixture that exercises the integrated path. Attach the
   trace and state assertion. Describe unverified cases and remaining upstream limitations.

The decision is selective reuse under the owner's instruction. The rejected alternative is a
framework transplant: it would expand maintenance before proving J1, J2 or J3.
