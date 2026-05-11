import DOMPurify from "dompurify";

/**
 * Sanitize story HTML for safe rendering.
 * Strips scripts, event handlers, javascript: URLs, and unknown tags.
 */
export const sanitizeStoryHtml = (html: string): string => {
  if (!html) return "";
  const cleaned = html
    .replace(/style="[^"]*"/gi, "")
    .replace(/class="(?!spacer)[^"]*"/gi, "")
    .replace(/<font[^>]*>([\s\S]*?)<\/font>/gi, "$1")
    .replace(/\s*size="[^"]*"/gi, "")
    .replace(/\s*face="[^"]*"/gi, "")
    .replace(/\s*color="[^"]*"/gi, "");

  return DOMPurify.sanitize(cleaned, {
    ALLOWED_TAGS: [
      "p", "br", "b", "strong", "i", "em", "u", "s", "a", "ul", "ol", "li",
      "img", "blockquote", "h1", "h2", "h3", "h4", "h5", "h6", "span", "div",
      "hr", "code", "pre",
    ],
    ALLOWED_ATTR: ["href", "src", "alt", "target", "rel", "class", "data-list"],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  });
};
