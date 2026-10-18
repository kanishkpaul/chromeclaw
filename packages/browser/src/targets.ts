import { randomUUID } from "node:crypto";
import type { ElementHandle, Frame, JSHandle, Page } from "playwright";
import type { InteractiveElement } from "@chromeclaw/shared";
import { inspectField, type FieldState } from "./credentials";

export interface TargetQuery {
  snapshotId: string;
  target: number;
}
interface DocumentState extends FieldState {
  document: Document;
  observer: MutationObserver;
  dirty: boolean;
  invalidate: () => void;
}

interface BoundTarget {
  element: ElementHandle;
  frame: Frame;
  state: JSHandle<DocumentState>;
  metadata: InteractiveElement;
  fingerprint: string;
  /** The fingerprint without bounds: what a read-only reference names, wherever it moved. */
  identity: string;
}
interface Capture {
  id: string;
  url: string;
  targets: Map<number, BoundTarget>;
  states: JSHandle<DocumentState>[];
  documentId: string;
  omittedTargets: number;
  unreadableFrames: number;
}
const captures = new WeakMap<Page, Capture>();
// The bound is applied to offered, visible nodes, not to the first DOM matches. Omission is
// explicit, and scrolling starts a new capture rather than guessing a selector beyond the list.
const targetLimit = 200;

/** Metadata and activation share one browser turn to avoid a revalidation-to-click race. */
function inspectControl(
  node: Node,
  input?: {
    expected: string;
    state: DocumentState;
    click: boolean;
    key?: string;
  } | void,
) {
  if (!(node instanceof HTMLElement)) return undefined;
  const rect = node.getBoundingClientRect();
  const root = node.getRootNode();
  let visible =
    node.isConnected &&
    rect.width > 0 &&
    rect.height > 0 &&
    !node.closest("[inert]");
  let parent: Element | null = node;
  while (parent) {
    const style = getComputedStyle(parent);
    if (style.visibility !== "visible" || style.opacity === "0")
      visible = false;
    const parentRoot = parent.getRootNode();
    parent =
      parent.parentElement ??
      (parentRoot instanceof ShadowRoot ? parentRoot.host : null);
  }
  const top =
    root instanceof Document || root instanceof ShadowRoot
      ? root.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
      : null;
  const covered = !top || (top !== node && !node.contains(top));
  const editable =
    node instanceof HTMLInputElement ||
    node instanceof HTMLTextAreaElement ||
    node.isContentEditable;
  const disabled =
    node.matches(":disabled,[readonly]") ||
    Boolean(node.closest("[aria-disabled=true]"));
  let role = node.getAttribute("role") ?? "";
  if (!role) {
    if (node instanceof HTMLAnchorElement && node.href) role = "link";
    else if (node instanceof HTMLButtonElement) role = "button";
    else if (node instanceof HTMLSelectElement) role = "combobox";
    else if (node instanceof HTMLTextAreaElement || node.isContentEditable)
      role = "textbox";
    else if (node instanceof HTMLInputElement)
      role = ["button", "submit", "reset"].includes(node.type)
        ? "button"
        : ["checkbox", "radio"].includes(node.type)
          ? node.type
          : node.type === "range"
            ? "slider"
            : node.type === "number"
              ? "spinbutton"
              : node.type === "search"
                ? "searchbox"
                : "textbox";
    else role = node.tagName.toLowerCase();
  }
  const form =
    node instanceof HTMLInputElement || node instanceof HTMLButtonElement
      ? node.form
      : node.closest("form");
  const destination = node instanceof HTMLAnchorElement ? node.href : undefined;
  const formDestination = form
    ? node.getAttribute("formaction")
      ? new URL(node.getAttribute("formaction") ?? "", document.baseURI).href
      : form.action
    : undefined;
  const metadata = {
    role,
    tagName: node.tagName.toLowerCase(),
    isEditable: editable,
    isDisabled: disabled,
    isVisible: visible,
    isOccluded: covered,
    bounds: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    destination,
    formDestination,
    // Attribute changes are observed; properties such as form.action are included explicitly.
    signature: Array.from(node.attributes)
      .filter((attribute) => attribute.name !== "value")
      .map((attribute) => [attribute.name, attribute.value]),
  };
  const fingerprint = JSON.stringify(metadata);
  if (!input) return { metadata, fingerprint, acted: false };
  if (
    !input.state.isCurrent() ||
    fingerprint !== input.expected ||
    !visible ||
    covered ||
    disabled ||
    !node.isConnected
  )
    return undefined;
  if (input.click) node.click();
  // Browser keyboard activation is intentionally expressed through this resolved control.
  // Native activation avoids implicit form submission through whichever element has focus.
  else if (input.key === "Enter" || input.key === "Space") {
    if (role !== "button" && role !== "link") return undefined;
    node.click();
  } else if (input.key) return undefined;
  return { metadata, fingerprint, acted: input.click || Boolean(input.key) };
}

function frameOrigin(frame: Frame): string {
  if (["about:srcdoc", "about:blank"].includes(frame.url())) {
    const parent = frame.parentFrame();
    return parent ? frameOrigin(parent) : "null";
  }
  return new URL(frame.url()).origin;
}

async function frameIsVisible(
  frame: Frame,
  point?: { x: number; y: number },
): Promise<boolean> {
  const parent = frame.parentFrame();
  if (!parent) return true;
  const owner = await frame.frameElement();
  try {
    const control = await owner.evaluate(inspectControl);
    if (!control?.metadata.isVisible) return false;
    const offset = await owner.evaluate((node, point) => {
      if (!(node instanceof HTMLElement)) return undefined;
      const rect = node.getBoundingClientRect();
      const x = rect.x + node.clientLeft + (point?.x ?? rect.width / 2);
      const y = rect.y + node.clientTop + (point?.y ?? rect.height / 2);
      const top = document.elementFromPoint(x, y);
      return top === node ? { x, y } : undefined;
    }, point);
    return Boolean(offset && (await frameIsVisible(parent, offset)));
  } finally {
    await owner.dispose();
  }
}

export async function captureTargets(page: Page) {
  const previous = captures.get(page);
  if (previous) {
    await Promise.all(
      [...previous.targets.values()].map((target) => target.element.dispose()),
    );
    await Promise.all(
      previous.states.map(async (state) => {
        await state
          .evaluate((value) => {
            value.observer.disconnect();
            value.document.removeEventListener("input", value.invalidate, true);
            value.document.removeEventListener(
              "change",
              value.invalidate,
              true,
            );
          })
          .catch(() => {
            // Navigation already discarded this document.
          });
        await state.dispose();
      }),
    );
  }
  const capture: Capture = {
    id: randomUUID(),
    url: page.url(),
    documentId: randomUUID(),
    targets: new Map(),
    states: [],
    omittedTargets: 0,
    unreadableFrames: 0,
  };
  captures.set(page, capture);
  const elements: InteractiveElement[] = [];
  for (const [frameIndex, frame] of page.frames().entries()) {
    const sameOrigin =
      frame === page.mainFrame() ||
      frameOrigin(frame) === frameOrigin(page.mainFrame());
    if (!sameOrigin || !(await frameIsVisible(frame))) {
      capture.unreadableFrames += 1;
      continue;
    }
    const state = await frame.evaluateHandle(() => {
      const state = {
        document,
        dirty: false,
        invalidate() {
          state.dirty = true;
        },
        values: new Map<
          HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
          string
        >(),
        isCurrent() {
          if (state.observer.takeRecords().length) state.dirty = true;
          if (state.document !== document || state.dirty) return false;
          for (const [field, original] of state.values) {
            if (!field.isConnected) return false;
            const signature =
              field instanceof HTMLInputElement
                ? JSON.stringify([field.value, field.checked])
                : field instanceof HTMLSelectElement
                  ? JSON.stringify(
                      Array.from(
                        field.selectedOptions,
                        (option) => option.value,
                      ),
                    )
                  : field.value;
            if (signature !== original) return false;
          }
          return true;
        },
        observer: new MutationObserver(() => {
          state.dirty = true;
        }),
      };
      document.addEventListener("input", state.invalidate, true);
      document.addEventListener("change", state.invalidate, true);
      state.observer.observe(document, {
        subtree: true,
        attributes: true,
        childList: true,
        characterData: true,
      });
      // Open shadow trees have independent mutation boundaries.
      const pending: ParentNode[] = [document];
      while (pending.length) {
        const root = pending.shift();
        if (!root) break;
        for (const node of Array.from(root.querySelectorAll("*")))
          if (node.shadowRoot) {
            state.observer.observe(node.shadowRoot, {
              subtree: true,
              attributes: true,
              childList: true,
              characterData: true,
            });
            pending.push(node.shadowRoot);
          }
      }
      return state;
    });
    capture.states.push(state);
    const handles = await frame
      .locator(
        "a[href],button,input,textarea,select,[role=button],[role=link],[role=textbox],[role=searchbox],[role=checkbox],[role=radio],[role=combobox],[role=spinbutton],[role=menuitem],[tabindex]:not([tabindex='-1']),[contenteditable=true]",
      )
      .elementHandles();
    for (const element of handles) {
      const field = await element.evaluate(inspectField, {
        capture: true,
        state,
      });
      const control = await element.evaluate(inspectControl);
      if (
        !control?.metadata.isVisible ||
        control.metadata.isOccluded ||
        control.metadata.isDisabled ||
        !(await frameIsVisible(frame, {
          x: control.metadata.bounds.x + control.metadata.bounds.width / 2,
          y: control.metadata.bounds.y + control.metadata.bounds.height / 2,
        }))
      ) {
        await element.dispose();
        continue;
      }
      if (elements.length >= targetLimit) {
        capture.omittedTargets += 1;
        await element.dispose();
        continue;
      }
      const number = elements.length + 1;
      const metadata = control.metadata;
      const target: InteractiveElement = {
        role: metadata.role,
        tagName: metadata.tagName,
        isVisible: metadata.isVisible,
        isOccluded: metadata.isOccluded,
        isDisabled: metadata.isDisabled,
        isEditable: metadata.isEditable,
        bounds: metadata.bounds,
        destination: metadata.destination,
        formDestination: metadata.formDestination,
        id: String(number),
        number,
        documentId: capture.documentId,
        frameId: String(frameIndex),
        name: field.label || field.text || "",
        text: field.text.slice(0, 160),
        isCredential: field.credential,
        ...(!field.credential && metadata.tagName === "select"
          ? {
              options: await element.evaluate((node) =>
                node instanceof HTMLSelectElement
                  ? Array.from(node.options)
                      .filter(
                        (option) =>
                          !option.disabled &&
                          !(
                            option.parentElement instanceof
                              HTMLOptGroupElement &&
                            option.parentElement.disabled
                          ),
                      )
                      .slice(0, 100)
                      .map((option) => option.label)
                  : [],
              ),
            }
          : {}),
        score: 0,
      };
      elements.push(target);
      capture.targets.set(number, {
        element,
        frame,
        state,
        metadata: target,
        fingerprint: control.fingerprint,
        identity: identityOf(control.metadata),
      });
    }
  }
  return {
    snapshotId: capture.id,
    documentId: capture.documentId,
    interactiveElements: elements,
    omittedTargets: capture.omittedTargets,
    unreadableFrames: capture.unreadableFrames,
  };
}

const identityOf = (metadata: { bounds: unknown }) =>
  JSON.stringify({ ...metadata, bounds: undefined });

/**
 * Whether a read-only reference still names the same captured control: the retained connected
 * node with its name, role, destination and attributes, visible, enabled and uncovered. Unlike
 * resolveTarget it ignores unrelated page mutations and layout movement, so callers must never
 * use it to admit an action; activation keeps whole-snapshot binding (D-015, D-032).
 */
export async function referenceIsCurrent(
  page: Page,
  query: TargetQuery,
): Promise<boolean> {
  const capture = captures.get(page);
  const target =
    capture?.id === query.snapshotId && capture.url === page.url()
      ? capture.targets.get(query.target)
      : undefined;
  if (!target) return false;
  try {
    if (!(await target.element.evaluate((node) => node.isConnected)))
      return false;
    const control = await target.element.evaluate(inspectControl);
    const field = await target.element.evaluate(inspectField);
    if (
      !control?.metadata.isVisible ||
      control.metadata.isOccluded ||
      control.metadata.isDisabled ||
      field.credential ||
      (field.label || field.text || "") !== target.metadata.name ||
      identityOf(control.metadata) !== target.identity
    )
      return false;
    const { x, y, width, height } = control.metadata.bounds;
    return await frameIsVisible(target.frame, {
      x: x + width / 2,
      y: y + height / 2,
    });
  } catch {
    // A discarded document means the reference no longer exists.
    return false;
  }
}

/** A URL proposal needs the same page-state binding as a numbered-control proposal. */
export async function snapshotIsCurrent(
  page: Page,
  snapshotId: string,
): Promise<boolean> {
  const capture = captures.get(page);
  if (!capture || capture.id !== snapshotId || capture.url !== page.url())
    return false;
  try {
    for (const state of capture.states) {
      const unchanged = await state.evaluate((value) => value.isCurrent());
      if (!unchanged) return false;
    }
    return true;
  } catch {
    // Navigation discarded the captured documents.
    return false;
  }
}

export async function resolveTarget(
  page: Page,
  query: TargetQuery,
): Promise<BoundTarget | undefined> {
  const capture = captures.get(page);
  if (
    !capture ||
    query.snapshotId !== capture.id ||
    !Number.isInteger(query.target)
  )
    return undefined;
  const target = capture.targets.get(query.target);
  if (!target) return undefined;
  try {
    if (!(await snapshotIsCurrent(page, query.snapshotId))) return undefined;
    const bounds = await target.element.boundingBox();
    if (!bounds) return undefined;
    const point = await target.element.evaluate((node) => {
      if (!(node instanceof Element)) return undefined;
      const rect = node.getBoundingClientRect();
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    });
    if (!point || !(await frameIsVisible(target.frame, point)))
      return undefined;
    const valid = await target.element.evaluate(inspectControl, {
      expected: target.fingerprint,
      state: target.state,
      click: false,
    });
    return valid ? target : undefined;
  } catch {
    // Detached documents are stale proposals, not selector fallbacks.
    return undefined;
  }
}

export async function activateTarget(
  page: Page,
  query: TargetQuery,
  key?: string,
): Promise<"acted" | "toggled" | "stale" | "uncertain"> {
  const target = await resolveTarget(page, query);
  if (!target) return "stale";
  // Replaying the same approval cannot act twice, even if the page does not change.
  captures.get(page)?.targets.delete(query.target);
  let guard;
  let acknowledgmentTimer: ReturnType<typeof setTimeout> | undefined;
  try {
    // The handle is rechecked at each trusted input event, not only before Playwright moves the
    // mouse. Focus handlers and layout drift can invalidate an otherwise approved target.
    guard = await target.element.evaluateHandle<
      {
        ack: Promise<"acted" | "uncertain" | "stale">;
        toggleChanged: () => boolean;
        stop: () => "acted" | "uncertain" | "stale";
      },
      { expected: string; state: JSHandle<DocumentState>; code: string }
    >(
      (node, input) => {
        // Only the adapter's own inspector/guard source is compiled. Page/model text is data.
        return new Function("node", "input", input.code)(node, input);
      },
      {
        expected: target.fingerprint,
        state: target.state,
        code: `const __name = fn => fn;
        const inspect = (${inspectControl.toString()});
        const view = node.ownerDocument.defaultView;
        let admitted = false, finished = false, blocked = false, acknowledge;
        const ack = new Promise(resolve => { acknowledge = resolve; });
        const events = ["pointerdown", "mousedown", "pointerup", "mouseup", "click", "keydown", "keyup"];
        const check = event => {
          if (finished) return;
          // Chrome toggles native checkboxes/radios before delivering click. Permit only that
          // expected default change after already admitted pointer/key events; recheck all peers.
          const defaults = [];
          if (event.type === "click" && admitted && node instanceof HTMLInputElement && ["checkbox", "radio"].includes(node.type)) {
            for (const [field, original] of input.state.values) {
              if (!(field instanceof HTMLInputElement) || (field !== node && !(node.type === "radio" && field.type === "radio" && field.form === node.form && field.name === node.name))) continue;
              const [value, checked] = JSON.parse(original);
              const expected = field === node ? node.type === "checkbox" ? !checked : true : false;
              if (field.value === value && field.checked === expected) {
                defaults.push([field, original]);
                input.state.values.set(field, JSON.stringify([field.value, field.checked]));
              }
            }
          }
          const valid = inspect(node, { expected: input.expected, state: input.state, click: false });
          for (const [field, original] of defaults) input.state.values.set(field, original);
          if (!event.isTrusted || !event.composedPath().includes(node) || !valid) {
            blocked = true; event.preventDefault(); event.stopImmediatePropagation(); acknowledge(admitted ? "uncertain" : "stale");
          } else { admitted = true; if (event.type === "click") { finished = true; acknowledge(blocked ? "uncertain" : "acted"); } }
        };
        for (const name of events) view.addEventListener(name, check, true);
        return { ack, toggleChanged() {
          if (!(node instanceof HTMLInputElement) || !node.isConnected || !["checkbox", "radio"].includes(node.type)) return false;
          const original = input.state.values.get(node);
          if (!original) return false;
          const [value, checked] = JSON.parse(original);
          return node.value === value && node.checked !== checked;
        }, stop() {
          for (const name of events) view.removeEventListener(name, check, true);
          return finished && !blocked ? "acted" : admitted ? "uncertain" : "stale";
        } };`,
      },
    );
    // Await the guard before dispatch: a successful form navigation discards its document.
    const acknowledgment = guard.evaluate((guard) => guard.ack);
    void acknowledgment.catch(() => undefined);
    if (key) await target.element.press(key, { timeout: 3000 });
    else await target.element.click({ timeout: 3000 });
    // A custom widget or Space on a link may emit keys without a click. Never wait forever
    // for that acknowledgment or replay it through native DOM activation.
    const noAcknowledgment = new Promise<"uncertain">((resolve) => {
      acknowledgmentTimer = setTimeout(() => resolve("uncertain"), 3000);
      acknowledgmentTimer.unref();
    });
    const outcome = await Promise.race([acknowledgment, noAcknowledgment]);
    const toggled =
      outcome === "acted" &&
      (await guard
        .evaluate((guard) => guard.toggleChanged())
        .catch(() => false));
    if (toggled) return "toggled";
    return outcome === "acted"
      ? "acted"
      : outcome === "stale"
        ? "stale"
        : "uncertain";
  } catch {
    // A dispatched pointer/key may already have effects even if acknowledgment is lost.
    // Do not replay through a native click fallback after a navigation or driver failure.
    return "uncertain";
  } finally {
    if (acknowledgmentTimer) clearTimeout(acknowledgmentTimer);
    if (guard) {
      await guard
        .evaluate((guard) => guard.stop())
        .catch(() => {
          // Navigation can discard the event guard with its document.
        });
      await guard.dispose();
    }
    await target.element.dispose();
  }
}
