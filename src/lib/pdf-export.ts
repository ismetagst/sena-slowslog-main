import jsPDF from "jspdf";

interface ArticleForPDF {
  title: string;
  subtitle?: string | null;
  content?: string | null;
  published_at?: string | null;
  author_name?: string;
}

interface TextBlock {
  text: string;
  type: "paragraph" | "heading" | "blockquote" | "list-item" | "break";
  level?: number; // heading level
}

const sanitizeHtml = (html: string): string =>
  html
    .replace(/&nbsp;/gi, " ")
    .replace(/\u00A0/g, " ")
    .replace(/style="[^"]*"/gi, "")
    .replace(/class="[^"]*"/gi, "")
    .replace(/<font[^>]*>([\s\S]*?)<\/font>/gi, "$1")
    .replace(/\s*size="[^"]*"/gi, "")
    .replace(/\s*face="[^"]*"/gi, "")
    .replace(/\s*color="[^"]*"/gi, "")
    .replace(/<blockquote[^>]*>/gi, "<p>")
    .replace(/<\/blockquote>/gi, "</p>")
    // Strip inline formatting tags to ensure uniform text
    .replace(/<\/?(b|strong|i|em|u|s|strike|del|ins|mark|small|big|sub|sup|span|a)[^>]*>/gi, "");

const parseHtmlToBlocks = (html: string): TextBlock[] => {
  const div = document.createElement("div");
  div.innerHTML = sanitizeHtml(html);
  const blocks: TextBlock[] = [];

  const getText = (el: Element): string =>
    (el.textContent || "").replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();

  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = (node.textContent || "").replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();
      if (t) blocks.push({ text: t, type: "paragraph" });
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as Element;
    const tag = el.tagName.toLowerCase();

    // Line breaks
    if (tag === "br") {
      blocks.push({ text: "", type: "break" });
      return;
    }

    // Headings
    if (/^h[1-6]$/.test(tag)) {
      const t = getText(el);
      if (t) blocks.push({ text: t, type: "heading", level: parseInt(tag[1]) });
      return;
    }

    // Blockquote
    if (tag === "blockquote") {
      const t = getText(el);
      if (t) blocks.push({ text: t, type: "blockquote" });
      return;
    }

    // List items
    if (tag === "li") {
      const t = getText(el);
      if (t) blocks.push({ text: t, type: "list-item" });
      return;
    }

    // Paragraph / div — treat as block
    if (tag === "p" || tag === "div") {
      // Check for inner structure (nested blocks)
      const hasBlockChild = Array.from(el.children).some((c) =>
        /^(p|div|h[1-6]|blockquote|ul|ol|li|br)$/i.test(c.tagName)
      );

      if (hasBlockChild) {
        // Process children individually
        el.childNodes.forEach(walk);
      } else {
        // Handle <br> inside paragraph: split into multiple lines
        const innerHtml = el.innerHTML;
        if (innerHtml.includes("<br")) {
          const parts = innerHtml.split(/<br\s*\/?>/gi);
          for (const part of parts) {
            const tmp = document.createElement("span");
            tmp.innerHTML = part;
            const t = (tmp.textContent || "").replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();
            if (t) {
              blocks.push({ text: t, type: "paragraph" });
            } else {
              blocks.push({ text: "", type: "break" });
            }
          }
        } else {
          const t = getText(el);
          if (t) blocks.push({ text: t, type: "paragraph" });
          else blocks.push({ text: "", type: "break" });
        }
      }
      return;
    }

    // Lists — walk children
    if (tag === "ul" || tag === "ol") {
      el.childNodes.forEach(walk);
      return;
    }

    // Fallback: walk children
    el.childNodes.forEach(walk);
  };

  div.childNodes.forEach(walk);
  return blocks;
};

export const exportArticlesToPDF = (articles: ArticleForPDF[]) => {
  const now = new Date();
  const y4 = now.getFullYear();
  const m2 = String(now.getMonth() + 1).padStart(2, "0");
  const d2 = String(now.getDate()).padStart(2, "0");
  const filename = `backup-${y4}${m2}${d2}`;

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const mg = 25;
  const mw = pw - mg * 2;
  let pageNum = 1;

  const lineH = 5.5;
  const paraGap = 5;
  let lastColor: [number, number, number] = [45, 45, 45];

  const setColor = (r: number, g: number, b: number) => {
    lastColor = [r, g, b];
    doc.setTextColor(r, g, b);
  };

  const addFooter = () => {
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(170, 170, 170);
    doc.text(`${pageNum}`, pw / 2, ph - 10, { align: "center" });
  };

  const nextPage = (): number => {
    const savedSize = doc.getFontSize();
    const savedFont = doc.getFont();
    const savedColor = lastColor;

    addFooter();
    doc.addPage();
    pageNum++;

    // Restore previous text styling
    doc.setFontSize(savedSize);
    doc.setFont(savedFont.fontName, savedFont.fontStyle);
    doc.setTextColor(savedColor[0], savedColor[1], savedColor[2]);
    return mg;
  };

  const ensureSpace = (y: number, need: number): number => {
    if (y + need > ph - 18) return nextPage();
    return y;
  };

  articles.forEach((article, idx) => {
    if (idx > 0) {
      addFooter();
      doc.addPage();
      pageNum++;
    }

    let y = mg;

    // ── Accent bar ──
    doc.setFillColor(40, 40, 40);
    doc.rect(mg, y, 32, 0.8, "F");
    y += 10;

    // ── Title ──
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    setColor(25, 25, 25);
    const titleLines: string[] = doc.splitTextToSize(article.title || "Untitled", mw);
    for (const line of titleLines) {
      y = ensureSpace(y, 10);
      doc.text(line, mg, y);
      y += 10;
    }
    y += 1;

    // ── Subtitle ──
    if (article.subtitle) {
      doc.setFontSize(14);
      doc.setFont("helvetica", "italic");
      setColor(90, 90, 90);
      const subLines: string[] = doc.splitTextToSize(article.subtitle, mw);
      for (const line of subLines) {
        y = ensureSpace(y, 7);
        doc.text(line, mg, y);
        y += 7;
      }
      y += 3;
    }

    // ── Meta ──
    const metaParts = [
      article.author_name ? `by ${article.author_name}` : null,
      article.published_at
        ? new Date(article.published_at).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })
        : null,
    ].filter(Boolean);

    if (metaParts.length) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      setColor(140, 140, 140);
      doc.text(metaParts.join("  ·  "), mg, y);
      y += 8;
    }

    // ── Separator ──
    doc.setDrawColor(210, 210, 210);
    doc.setLineWidth(0.3);
    doc.line(mg, y, pw - mg, y);
    y += 10;

    // ── Content blocks ──
    const blocks = parseHtmlToBlocks(article.content || "");

    for (const block of blocks) {
      // Empty break = paragraph spacing
      if (block.type === "break") {
        y += paraGap * 0.6;
        continue;
      }

      if (block.type === "heading") {
        y += 3;
        const sz = block.level && block.level <= 2 ? 16 : block.level === 3 ? 13 : 11.5;
        doc.setFontSize(sz);
        doc.setFont("helvetica", "bold");
        setColor(30, 30, 30);
        const lines: string[] = doc.splitTextToSize(block.text, mw);
        for (const line of lines) {
          y = ensureSpace(y, 8);
          doc.text(line, mg, y);
          y += 7.5;
        }
        y += 3;
        continue;
      }

      if (block.type === "blockquote") {
        doc.setFontSize(10.5);
        doc.setFont("helvetica", "italic");
        setColor(100, 100, 100);
        const qIndent = 6;
        const lines: string[] = doc.splitTextToSize(block.text, mw - qIndent);
        // Draw left bar
        const barStart = y - 2;
        for (const line of lines) {
          y = ensureSpace(y, lineH);
          doc.text(line, mg + qIndent, y);
          y += lineH;
        }
        doc.setDrawColor(180, 180, 180);
        doc.setLineWidth(0.6);
        doc.line(mg + 2, barStart, mg + 2, y - 2);
        y += paraGap;
        continue;
      }

      if (block.type === "list-item") {
        doc.setFontSize(10.5);
        doc.setFont("helvetica", "normal");
        setColor(45, 45, 45);
        const bullet = "•  ";
        const indent = doc.getTextWidth(bullet);
        const lines: string[] = doc.splitTextToSize(block.text, mw - indent);
        y = ensureSpace(y, lineH);
        doc.text(bullet, mg, y);
        for (let i = 0; i < lines.length; i++) {
          if (i > 0) y = ensureSpace(y, lineH);
          doc.text(lines[i], mg + indent, y);
          y += lineH;
        }
        y += 1;
        continue;
      }

      // ── Regular paragraph ──
      doc.setFontSize(10.5);
      doc.setFont("helvetica", "normal");
      setColor(45, 45, 45);
      const lines: string[] = doc.splitTextToSize(block.text, mw);
      for (const line of lines) {
        y = ensureSpace(y, lineH);
        doc.text(line, mg, y);
        y += lineH;
      }
      y += paraGap;
    }

    addFooter();
  });

  // Export stamp on page 1
  doc.setPage(1);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(180, 180, 180);
  doc.text(
    `Exported ${now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}  ·  ${articles.length} article(s)`,
    mg,
    ph - 15
  );

  doc.save(`${filename}.pdf`);
};
