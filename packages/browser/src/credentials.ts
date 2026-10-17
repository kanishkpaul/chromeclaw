export interface FieldInspection {
  credential: boolean;
  label: string;
  text: string;
  written: boolean;
  refusal?: string;
}

/** Runs in the element's document. Credential values are never read, including for labels. */
export function inspectField(element: Node, value?: string | void): FieldInspection {
  if (!(element instanceof Element)) return { credential: false, label: "", text: "", written: false, refusal: "The target is not an element." };
  const nativeInput = element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement;
  const editable = nativeInput || (element instanceof HTMLElement && element.isContentEditable);
  const root = element.getRootNode();
  const references: Element[] = [];
  for (const id of (element.getAttribute("aria-labelledby") ?? "").split(/\s+/)) {
    const node = root instanceof Document || root instanceof ShadowRoot ? root.getElementById(id) : null;
    if (node) references.push(node);
  }
  const labels = nativeInput ? Array.from(element.labels ?? []) : [];
  const texts: string[] = [];
  // A recursive local function gains a tsx naming helper that cannot travel into Playwright's
  // document. Walk each label without closures, and skip control descendants before reading text.
  for (const textRoot of [element, ...references, ...labels]) {
    const walker = textRoot.ownerDocument.createTreeWalker(textRoot, NodeFilter.SHOW_TEXT);
    const parts: string[] = [];
    while (walker.nextNode()) {
      if (!walker.currentNode.parentElement?.closest("input,textarea,select,[contenteditable],script,style,noscript")) {
        parts.push(walker.currentNode.textContent ?? "");
      }
    }
    texts.push(parts.join(" ").trim());
  }
  const label = element.getAttribute("aria-label") || texts.slice(1, 1 + references.length).join(" ").trim() ||
    texts.slice(1 + references.length).join(" ").trim() ||
    element.getAttribute("placeholder") || element.getAttribute("name") || "";
  const tokens = (element.getAttribute("autocomplete") ?? "").toLowerCase().split(/\s+/);
  const credential = editable && (
    element.getAttribute("type")?.toLowerCase() === "password" ||
    tokens.some((token) => ["current-password", "new-password", "one-time-code"].includes(token)) ||
    /\b(?:password|passwd|passphrase|passcode|otp|one[\s-]?time[\s-]?(?:password|code)|cvv2?|cvc2?|(?:security|verification|authenticator|backup|recovery|sign[\s-]?in)\s*code|2fa|two[\s-]?factor|pin(?!\s*code))\b/i.test(label)
  );
  const inspection: FieldInspection = { credential, label: label.trim(), text: editable ? "" : texts[0] ?? "", written: false };
  if (value === undefined) return inspection;
  if (!element.isConnected || !editable) return { ...inspection, refusal: "The target is detached or is not an editable field." };
  if (credential) return { ...inspection, refusal: "Credential entry is refused. Enter it yourself in Chrome." };
  const rect = element.getBoundingClientRect();
  if (!rect.width || !rect.height || element.closest("[inert]")) return { ...inspection, refusal: "The field is not visible or is inert." };
  let ancestor: Element | null = element;
  while (ancestor) {
    const style = getComputedStyle(ancestor);
    if (style.visibility !== "visible" || style.opacity === "0") return { ...inspection, refusal: "The field is hidden." };
    const ancestorRoot = ancestor.getRootNode();
    ancestor = ancestor.parentElement ?? (ancestorRoot instanceof ShadowRoot ? ancestorRoot.host : null);
  }
  const top = root instanceof Document || root instanceof ShadowRoot ? root.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2) : null;
  if (!top || (top !== element && !element.contains(top))) return { ...inspection, refusal: "The field is covered or outside the viewport." };

  // The check and native setter share one document turn, so focus handlers cannot turn a safe
  // field into a password field between admission and writing. React also sees its native setter.
  if (nativeInput) {
    if (element.disabled || element.readOnly) return { ...inspection, refusal: "The field is disabled or read-only." };
    const prototype = element instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
    if (!setter) return { ...inspection, refusal: "The native field setter is unavailable." };
    try {
      setter.call(element, value);
    } catch {
      // Browser validation errors may echo the supplied value, so return a safe refusal.
      return { ...inspection, refusal: "The native field rejected this value." };
    }
  } else {
    element.textContent = value;
  }
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
  return { ...inspection, written: true };
}
