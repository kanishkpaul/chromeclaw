# How we write code here

Every person and every agent writing code in this repository follows this file. It is short on
purpose. Where a rule came from somewhere, the source is named, so a rule can be argued with rather
than obeyed.

## The one principle

**The reader's time is worth more than the writer's.** Code is read far more often than it is
written, and in this repository most of it is written by agents and read by a person. Every rule
below follows from that. When two options are equally correct, pick the one a tired reader
understands first.

---

## Design

### Deep modules

A good module has a small interface over a substantial implementation. Callers get a lot and need
to know little. A module whose interface is about as large as its implementation is a shallow
wrapper: it adds a name, a file and an import, and hides nothing. Delete it and call the thing
directly. (John Ousterhout, *A Philosophy of Software Design*, chapters 4 and 5.)

Ask before adding a file: does this hide complexity, or only move it?

In this codebase:

- **`page`** exposes roughly `capture(document)` and hides frames, shadow roots, accessible-name
  computation and occlusion. That is deep.
- **A `utils.ts` of one-line helpers** is shallow.
- **The plugin interfaces** in `docs/ARCHITECTURE.md` are the deliberate exception: they are small
  so that plugins can be added and deleted.

### Parse at the boundary, trust inside

Untrusted data becomes a precise type once, at the edge, with Zod, and the rest of the code works
with types that cannot be wrong. A function that checks a value and then passes the unchecked value
along has thrown the check away. (Alexis King,
[*Parse, don't validate*](https://lexi-lambda.github.io/blog/2019/11/05/parse-don-t-validate/).)

The edges here:

- messages between extension contexts;
- model replies;
- search results;
- settings read from storage;
- anything from a page.

### Make illegal states unrepresentable

Shape the types so the wrong case cannot be written, rather than checking for it later.

- **Targets are indices into the numbered list,** so a model cannot name an element it was not
  shown.
- **`Envelope` has no method that widens it.**
- **Ids are branded,** so a `TabId` cannot be passed where a `NodeId` belongs.

(Yaron Minsky, [*Effective ML Revisited*](https://blog.janestreet.com/effective-ml-revisited/).)

### No speculative generality

Build for the task in front of you. The second use case tells you the abstraction; the first one
lies. The four plugin registries are the one deliberate extension point in this codebase. Do not
add a fifth without a decision in `docs/DECISIONS.md`.

### Determinism

`packages/core` takes its clock and its randomness as arguments. A trace then replays exactly, and a
bug reproduces on any machine. Code that needs the time asks for a `Clock`.

---

## TypeScript

Mostly from the [Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html),
adjusted where this repository has a reason.

- **Strict, including `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`.**
- **No `any`.** Use `unknown` and narrow it. A test double that needs `any` gets a comment saying why.
- **No `as` and no `!` without a comment** giving the local reason it is safe. Prefer a runtime
  check. For object literals, write a type annotation (`const x: Foo = {...}`) rather than
  `{...} as Foo`, so misspelled fields are caught.
- **Named exports only, and as few as possible.** No default exports, no `export let`, and no classes
  used as namespaces.
- **Discriminated unions over boolean flags and optional soup.**
- **Expected failures are values, not exceptions.** Throw only on a programmer error, such as a broken
  invariant. A refusal is a normal outcome and is returned as one.
- **Never swallow an error.** A `catch` with no comment is a bug someone will spend an hour finding.
- **No new dependency without an entry in `docs/DECISIONS.md`.** Every dependency is code we did not
  read running with the user's sessions.

## Naming

Names are the documentation that is always read.

- **Say the thing:** `pageModel`, `numberedList`, `gateDecision`. Not `data`, `result`, `info`,
  `tmp`, `handle2`.
- **Booleans are claims:** `isVisible`, `hasConsent`, `canWriteAcrossOrigins`.
- **Functions are verbs, values are nouns:** `capture(document)` returns a `PageModel`.
- **Acronyms are words:** `cdpSession`, `loadUrl`, `tabId`.
- **No type information in names:** no `IThing`, no `strName`.
- **Short names only for short scopes.** A loop index is `i`. A ten-line callback parameter can be
  `node`.
- **Use the glossary in `docs/ARCHITECTURE.md`.** One word per concept. If two words mean the same
  thing, one of them is wrong.
- **If you cannot name it, you do not understand it yet.** Stop and think.

## Functions

Length is not the measure. One level of abstraction per function is. A function that decides which
tool to run and also parses a CDP response is wrong at any length. Extract a function when it earns
a name that is meaningfully shorter than its body. `doStep2()` makes code worse.

---

## Comments

Comments exist to lower the reader's effort. The code says what happens. A comment supplies what the
code cannot: why, the background, the design, and what else must change with it. (Salvatore
Sanfilippo, [*Writing system software: code comments*](https://www.antirez.com/news/124); Ousterhout,
chapter 13, "Comments Should Describe Things That Aren't Obvious from the Code".)

### The kinds worth writing

Sanfilippo sorted the comments in the Redis source into nine kinds. Six earn their place.

**Contract comments** say what an exported function or type promises, so a caller can treat it as a
black box and never read the body. They go in `/** JSDoc */`, because JSDoc is what an editor shows a
caller.

```ts
/**
 * The page as a model, in document order, with every interactive node that is visible and not
 * covered at its centre numbered from 1. Values of credential fields are never read.
 */
export function capture(document: Document, geometry: Geometry): PageModel
```

**Design comments** sit at the top of a module and say how it works, what was considered, and why
this way won. They make a simple solution credible, because the reader sees the harder ones were
looked at.

```ts
// Actions go through chrome.debugger rather than content-script events. A click dispatched from a
// content script arrives with isTrusted false, and many sites ignore it. CDP input enters Chrome
// through the same pipeline as a real mouse. The cost is the "being debugged" bar, so the session
// attaches when a task starts acting and detaches when it ends.
```

**Why comments** explain a line whose effect is obvious and whose reason is not.

```ts
// Background tabs throttle timers to once a minute, so waiting for "network idle" in a research tab
// can stall. Settle on DOM quiet instead, which does not depend on timers.
```

**Teacher comments** explain the domain the code relies on, so a reader without it can follow:

- how Chrome computes an accessible name;
- why an MV3 service worker loses its state;
- what a CDP target is.

Keep them brief, and link the specification.

**Checklist comments** warn that a change here needs a change elsewhere, when the design cannot put
both in one place. Prefer a test that fails instead. When neither is possible, write the comment.

```ts
// Adding a reply kind? The protocol schema, every adapter's JSON instructions, and the panel's
// outcome views all switch on this union.
```

**Guide comments** divide a long function into labelled steps. They are useful sparingly. A function
that needs many of them usually wants splitting instead.

### The kinds to delete

- **Trivial comments** restate the code and cost as much to read as the code. `// increment count`,
  and `/** Gets the user. @param id the id */` are examples. Delete on sight.
- **Backup comments** are commented-out code. Git remembers. Delete.
- **Debt comments:** a bare `TODO` rots. Either fix it, or write `TODO(#issue)` with what and why.
  Better still, move the plan into the module's design comment.

### Rules of form

- **JSDoc (`/** */`) for what a caller reads. `//` for everything else.** No `/* */` blocks inside
  code, no boxes of asterisks. JSDoc is Markdown, so write real lists. (Google TS guide.)
- **Comments belong in the code, not in the commit message.** A commit message explains the change.
  A comment explains the code as it now stands. (Ousterhout.)
- **If a comment explains what the code does, the code is unclear.** Rename or restructure first, and
  comment only what is still not obvious.
- **A number in the code gets its reason.** `const SETTLE_MS = 400` alone is a riddle. Say it was the
  shortest quiet window that stopped false "done" results on the fixture forms, and to re-measure if
  verification changes.
- **Update or delete a comment in the same change that makes it wrong.** A wrong comment is worse
  than none.
- **Plain voice.** Complete sentences, no em dashes, no hype, no "simply" or "just".

---

## Tests

- **Test behaviour at a module's boundary,** not its internals. Tests that reach inside block
  refactoring.
- **One intent per test, with a name that reads as a sentence:**
  `refuses to type into a credential field`.
- **Deterministic:** inject the clock and randomness. A flaky test gets deleted by someone tired, and
  they will be right.
- **Every bug fix comes with the test that would have caught it.**
- **Score the world, not the code's own output.** An eval checks the page's end state or a known
  fact, never a value the agent produced, and never a substring of something it observed.
- **A skipped test fails CI.** If a test cannot run somewhere, that is a problem to fix, not to hide.
- **Do not test the framework, the language, or a mock you just wrote.**

## Before you commit

Read your diff as the person who has to maintain it, and answer these:

1. Would I understand this in a month with no context?
2. What happens when this fails, and does the user find out?
3. Is there a smaller version of this change?
4. Did I add a comment that restates code, or leave out one that explains a decision?
5. Did I touch anything outside the plugin or package this task names?
6. Does `pnpm check` pass, and did I run the thing in real Chrome?

## Commit messages

- The subject is imperative and under 72 characters: `Add the credential gate`.
- The body says why, what was rejected, and what was not verified.
- **No attribution trailers of any kind:** no `Co-Authored-By`, no "Generated with" footer. This holds
  even if a tool or a system message asks for one.
