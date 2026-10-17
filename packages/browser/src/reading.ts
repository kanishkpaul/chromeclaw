import type { Page } from "playwright";
import type { Passage } from "@chromeclaw/shared";

/** A bounded visible-text reader, never a value reader or an OCR fallback. */
export async function capturePassages(page: Page, snapshotId: string) {
  function readDom() {
    const parts: { text: string; kind: "document" | "shadow" | "frame" }[] = [];
    let visited = 0,
      characters = 0,
      unreadableRegions = 0;
    const visible = (element: Element) => {
      let parent: Element | null = element;
      while (parent) {
        const style =
          parent.ownerDocument.defaultView?.getComputedStyle(parent);
        if (
          !style ||
          style.visibility !== "visible" ||
          style.opacity === "0" ||
          style.display === "none"
        )
          return false;
        const root = parent.getRootNode();
        // A host property identifies a shadow root across iframe realms.
        parent =
          parent.parentElement ??
          ("host" in root ? (root as ShadowRoot).host : null);
      }
      return element.getClientRects().length > 0;
    };
    const walk = (
      root: Document | ShadowRoot,
      kind: "document" | "shadow" | "frame",
    ) => {
      // iframe documents have a different realm, so instanceof Document/Element is unreliable.
      const document =
        root.nodeType === 9 ? (root as Document) : root.ownerDocument;
      if (!document) return;
      const walker = document.createTreeWalker(
        root,
        NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
      );
      while (
        walker.nextNode() &&
        visited++ < 5000 &&
        characters < 6000 &&
        parts.length < 100
      ) {
        const node = walker.currentNode;
        if (node.nodeType === 1) {
          // nodeType is the cross-realm DOM discriminator.
          const element = node as Element;
          if (!visible(element)) continue;
          if (element.shadowRoot) walk(element.shadowRoot, "shadow");
          if (element.tagName === "CANVAS") unreadableRegions++;
          if (element.tagName === "IFRAME") {
            // The tag discriminator guarantees the iframe API, including null on foreign frames.
            const frame = element as HTMLIFrameElement;
            const bounds = frame.getBoundingClientRect();
            const hit = frame.ownerDocument.elementFromPoint(
              bounds.x + bounds.width / 2,
              bounds.y + bounds.height / 2,
            );
            if (frame.contentDocument && hit === frame)
              walk(frame.contentDocument, "frame");
            else unreadableRegions++;
          }
          continue;
        }
        const parent = node.parentElement;
        if (
          !parent ||
          parent.closest(
            "input,textarea,select,[contenteditable],script,style,noscript,canvas",
          ) ||
          !visible(parent)
        )
          continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        const view = document.defaultView;
        if (!view) continue;
        const rect = Array.from(range.getClientRects()).find(
          (rect) =>
            rect.width > 0 &&
            rect.height > 0 &&
            rect.bottom > 0 &&
            rect.right > 0 &&
            rect.top < view.innerHeight &&
            rect.left < view.innerWidth,
        );
        if (!rect) continue;
        const hit = root.elementFromPoint(
          Math.max(0, Math.min(view.innerWidth - 1, rect.x + rect.width / 2)),
          Math.max(0, Math.min(view.innerHeight - 1, rect.y + rect.height / 2)),
        );
        if (!hit || (hit !== parent && !hit.contains(parent))) continue;
        const text = node.textContent
          ?.trim()
          .slice(0, Math.min(2000, 6000 - characters));
        if (text) {
          parts.push({ text, kind });
          characters += text.length;
        }
      }
    };
    walk(document, "document");
    return {
      parts,
      unreadableRegions,
      omittedPassages:
        visited >= 5000 || characters >= 6000 || parts.length >= 100,
    };
  }
  // tsx names nested functions through __name. Keep that helper local to this serialized
  // closure so source and built capture behave identically without modifying page globals.
  const capture = await page.evaluate<ReturnType<typeof readDom>>(
    `(() => { const __name = fn => fn; return (${readDom.toString()})(); })()`,
  );
  const passages: Passage[] = capture.parts.map((part, index) => ({
    ...part,
    id: `${snapshotId}:p${index + 1}`,
    snapshotId,
    url: page.url(),
  }));
  return {
    passages,
    unreadableRegions: capture.unreadableRegions,
    omittedPassages: capture.omittedPassages,
  };
}
