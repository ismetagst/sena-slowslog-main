/**
 * HTML Normalization Engine
 * Transforms br-based content into clean paragraph structure.
 * Also strips browser-generated list elements from dash-enter patterns.
 * Idempotent: running on already-normalized content produces the same output.
 */

export const normalizeHtmlContent = (html: string): string => {
  if (!html || !html.trim()) return "";

  const div = document.createElement("div");
  div.innerHTML = html;

  // Step 1: Unwrap any browser-auto-generated <ul>/<ol> that the user didn't intentionally create
  div.querySelectorAll("ul:not([data-list]), ol:not([data-list])").forEach((list) => {
    const items = list.querySelectorAll("li");
    const fragment = document.createDocumentFragment();
    items.forEach((li) => {
      const p = document.createElement("p");
      p.innerHTML = li.innerHTML;
      fragment.appendChild(p);
    });
    list.parentNode?.replaceChild(fragment, list);
  });

  // Step 2: Collect top-level nodes and build paragraph blocks
  const result: string[] = [];
  const nodes = Array.from(div.childNodes);

  let currentInline: string[] = [];

  const flushInline = () => {
    if (currentInline.length === 0) return;
    const joined = currentInline.join("").trim();
    if (joined) {
      result.push(`<p>${joined}</p>`);
    }
    currentInline = [];
  };

  const isBlockTag = (tag: string) =>
    /^(p|div|h[1-6]|blockquote|ul|ol|table|hr|pre|figure|section|article)$/i.test(tag);

  const isBr = (node: Node) =>
    node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName === "BR";

  let consecutiveBr = 0;

  for (const node of nodes) {
    if (isBr(node)) {
      flushInline();
      consecutiveBr++;
      // Double-enter (2+ consecutive BRs) → insert spacer paragraph
      if (consecutiveBr >= 2) {
        result.push(`<p class="spacer"><br></p>`);
      }
      continue;
    }

    consecutiveBr = 0;

    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      const tag = el.tagName.toLowerCase();

      if (isBlockTag(tag)) {
        flushInline();

        if (tag === "div") {
          const inner = normalizeHtmlContent(el.innerHTML);
          if (inner.trim()) result.push(inner);
        } else if (tag === "p") {
          // Check if this is already a spacer paragraph — preserve it
          if (el.classList.contains("spacer")) {
            result.push(`<p class="spacer"><br></p>`);
            continue;
          }

          const innerHtml = el.innerHTML;
          // Check if paragraph is empty (only whitespace or <br>)
          const textOnly = el.textContent?.trim() || "";
          const hasOnlyBr = /^(<br\s*\/?>|\s)*$/i.test(innerHtml);

          if (hasOnlyBr && !textOnly) {
            // Empty paragraph between text blocks is a visual spacer in the editor.
            // Preserve it so write/preview/publish stay identical.
            result.push(`<p class="spacer"><br></p>`);
            continue;
          }

          if (innerHtml.includes("<br")) {
            // Split paragraph at <br> tags
            const parts = innerHtml.split(/<br\s*\/?>/gi);
            let pendingSpacer = false;
            for (const part of parts) {
              const trimmed = part.trim();
              if (trimmed) {
                if (pendingSpacer) {
                  result.push(`<p class="spacer"><br></p>`);
                  pendingSpacer = false;
                }
                result.push(`<p>${trimmed}</p>`);
              } else {
                pendingSpacer = true;
              }
            }

            if (pendingSpacer) {
              result.push(`<p class="spacer"><br></p>`);
            }
          } else {
            const trimmed = el.innerHTML.trim();
            if (trimmed) result.push(`<p>${trimmed}</p>`);
          }
        } else if (tag === "ul" || tag === "ol") {
          result.push(el.outerHTML);
        } else {
          const trimmed = el.innerHTML.trim();
          if (trimmed) result.push(el.outerHTML);
        }
        continue;
      }

      // Inline element
      if (tag === "img") {
        flushInline();
        result.push(el.outerHTML);
        continue;
      }

      currentInline.push(el.outerHTML);
      continue;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || "";
      if (text.trim()) {
        currentInline.push(text);
      } else if (currentInline.length > 0) {
        currentInline.push(" ");
      }
      continue;
    }
  }

  flushInline();

  return result.join("\n");
};

/**
 * Sanitize pasted HTML — strip styles, fonts, colors but preserve structure
 */
export const sanitizePastedHtml = (html: string): string => {
  return html
    .replace(/style="[^"]*"/gi, "")
    .replace(/class="[^"]*"/gi, "")
    .replace(/<font[^>]*>([\s\S]*?)<\/font>/gi, "$1")
    .replace(/\s*size="[^"]*"/gi, "")
    .replace(/\s*face="[^"]*"/gi, "")
    .replace(/\s*color="[^"]*"/gi, "")
    .replace(/<blockquote[^>]*>/gi, "<p>")
    .replace(/<\/blockquote>/gi, "</p>");
};
