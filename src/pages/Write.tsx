import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Eye, ImageIcon, Loader2, Strikethrough, List, Link2, Quote } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSaveStory, useStoryForEdit } from "@/hooks/useStories";
import { usePublishCooldown } from "@/hooks/usePublishCooldown";
import { useEditorImages } from "@/hooks/useEditorImages";
import EditorImageOverlay from "@/components/EditorImageOverlay";
import EditorLinkPopover from "@/components/EditorLinkPopover";
import { compressImage } from "@/lib/image-compress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import KaomojiPicker from "@/components/KaomojiPicker";
import { normalizeHtmlContent, sanitizePastedHtml } from "@/lib/html-normalize";
import { editorSpacingClasses, editorSpacingClassesImportant } from "@/lib/editor-content-classes";
import { sanitizeStoryHtml } from "@/lib/sanitize-html";
import { useToolbarSettings } from "@/hooks/useToolbarSettings";
import { useICMembership } from "@/hooks/useICMembership";

const MIN_PUBLISH_WORDS = 200;

const AUTO_SAVE_INTERVAL = 30_000; // 30 seconds
const MOBILE_TOOLBAR_HEIGHT = 44;
const MOBILE_FLOATING_TOOLBAR_GAP = 12;

const Write = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("edit");
  const { user, isFounder, isAdmin } = useAuth();
  const saveMutation = useSaveStory();
  const { data: existingStory } = useStoryForEdit(editId || undefined);
  const { data: cooldown } = usePublishCooldown();
  const { data: toolbar } = useToolbarSettings();
  const { data: membership } = useICMembership(user?.id);
  const isInnerCircle = !!membership;
  const canUseImage =
    !!toolbar?.image && (!toolbar.image_ic_only || isInnerCircle || isFounder || isAdmin);

  const fromParam = searchParams.get("from") || "/";
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);
  const [wordCount, setWordCount] = useState(0);
  const [preview, setPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [linkPopoverOpen, setLinkPopoverOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<{ el: HTMLAnchorElement; url: string; text: string } | null>(null);
  const savedSelectionRef = useRef<Range | null>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>("");
  const currentIdRef = useRef<string | null>(editId);
  const { activeImg, hoveredImg, removeImage, clearStates, overlayRef } = useEditorImages(contentRef);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // On mobile, keep the toolbar floating and centered above the visible viewport/keyboard
  useEffect(() => {
    const toolbar = toolbarRef.current;
    const vv = window.visualViewport;

    if (!toolbar || !vv) return;

    let frame = 0;

    const resetToolbarPosition = () => {
      toolbar.style.position = "";
      toolbar.style.left = "";
      toolbar.style.right = "";
      toolbar.style.bottom = "";
      toolbar.style.top = "";
      toolbar.style.width = "";
      toolbar.style.maxWidth = "";
      toolbar.style.height = "";
      toolbar.style.minHeight = "";
      toolbar.style.maxHeight = "";
      toolbar.style.margin = "";
      toolbar.style.padding = "";
      toolbar.style.transform = "";
    };

    const adjustToolbar = () => {
      if (window.innerWidth >= 768) {
        resetToolbarPosition();
        return;
      }

      const keyboardHeight = Math.max(0, window.innerHeight - vv.offsetTop - vv.height);

      toolbar.style.position = "fixed";
      toolbar.style.left = "50%";
      toolbar.style.right = "auto";
      toolbar.style.top = "auto";
      toolbar.style.bottom = `${keyboardHeight + MOBILE_FLOATING_TOOLBAR_GAP}px`;
      toolbar.style.width = "min(calc(100vw - 24px), 28rem)";
      toolbar.style.maxWidth = "calc(100vw - 24px)";
      toolbar.style.height = `${MOBILE_TOOLBAR_HEIGHT}px`;
      toolbar.style.minHeight = `${MOBILE_TOOLBAR_HEIGHT}px`;
      toolbar.style.maxHeight = `${MOBILE_TOOLBAR_HEIGHT}px`;
      toolbar.style.margin = "0";
      toolbar.style.padding = "0";
      toolbar.style.transform = "translateX(-50%)";
    };

    const scheduleAdjustToolbar = () => {
      cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(adjustToolbar);
    };

    scheduleAdjustToolbar();
    vv.addEventListener("resize", scheduleAdjustToolbar);
    vv.addEventListener("scroll", scheduleAdjustToolbar);

    return () => {
      cancelAnimationFrame(frame);
      vv.removeEventListener("resize", scheduleAdjustToolbar);
      vv.removeEventListener("scroll", scheduleAdjustToolbar);
      resetToolbarPosition();
    };
  }, []);

  const syncSpacerBlocks = useCallback(() => {
    if (!contentRef.current) return;

    const selection = window.getSelection();
    const activeNode = selection?.anchorNode;
    const activeElement = activeNode
      ? activeNode.nodeType === Node.ELEMENT_NODE
        ? (activeNode as Element)
        : activeNode.parentElement
      : null;
    const activeBlock = activeElement?.closest("p, div");

    contentRef.current.querySelectorAll("p, div").forEach((block) => {
      const el = block as HTMLElement;
      const isEmpty = !el.textContent?.trim() && !el.querySelector("img");

      if (!isEmpty) {
        el.classList.remove("spacer");
        return;
      }

      if (activeBlock && el === activeBlock) {
        el.classList.remove("spacer");
      } else {
        el.classList.add("spacer");
      }
    });
  }, []);

  useEffect(() => {
    if (existingStory && contentRef.current) {
      setTitle(existingStory.title);
      setSubtitle(existingStory.subtitle || "");
      contentRef.current.innerHTML = normalizeHtmlContent(existingStory.content || "");
      syncSpacerBlocks();
      updateWordCount();
      // Track initial content to avoid unnecessary saves
      lastSavedRef.current = JSON.stringify({
        title: existingStory.title,
        subtitle: existingStory.subtitle || "",
        content: existingStory.content || "",
      });
    }
  }, [existingStory, syncSpacerBlocks]);

  useEffect(() => {
    if (!user) navigate("/auth");
  }, [user]);

  useEffect(() => {
    try {
      document.execCommand("defaultParagraphSeparator", false, "p");
    } catch {
      // no-op: older browsers may ignore this command
    }
  }, []);

  // Sync currentIdRef when editId changes
  useEffect(() => {
    if (editId) currentIdRef.current = editId;
  }, [editId]);

  const autoSaveDraft = useCallback(async () => {
    if (!user || !contentRef.current) return;
    const content = normalizeHtmlContent(contentRef.current.innerHTML || "");
    if (!title.trim() && !content.trim()) return;

    const current = JSON.stringify({ title, subtitle, content });
    if (current === lastSavedRef.current) return; // No changes

    // If editing a published story, keep it published (don't revert to draft)
    const keepPublished = !!editId && existingStory && !existingStory.is_draft;

    setAutoSaveStatus("saving");
    try {
      const result = await saveMutation.mutateAsync({
        id: currentIdRef.current || undefined,
        title: title || "untitled",
        subtitle,
        content,
        is_draft: keepPublished ? false : true,
      });
      // Track the saved ID so subsequent auto-saves update instead of insert
      if (result?.id && !currentIdRef.current) {
        currentIdRef.current = result.id;
        window.history.replaceState(null, "", `/write?edit=${result.id}&from=${encodeURIComponent(fromParam)}`);
      }
      lastSavedRef.current = current;
      setAutoSaveStatus("saved");
      setTimeout(() => setAutoSaveStatus("idle"), 2000);
    } catch {
      setAutoSaveStatus("idle");
    }
  }, [title, subtitle, user, saveMutation, editId, existingStory]);

  // Auto-save as draft every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      autoSaveDraft();
    }, AUTO_SAVE_INTERVAL);
    return () => clearInterval(interval);
  }, [autoSaveDraft]);

  const updateWordCount = useCallback(() => {
    const text = contentRef.current?.innerText || "";
    setWordCount(text.trim().split(/\s+/).filter(Boolean).length);
  }, []);

  const execCommand = (command: string) => {
    document.execCommand(command, false);
    contentRef.current?.focus();
  };

  const openLinkPopover = () => {
    // Save current selection so we can restore it after popover closes
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedSelectionRef.current = sel.getRangeAt(0).cloneRange();
    }

    // Check if cursor is inside an existing link
    const anchorNode = sel?.anchorNode;
    const anchorEl = anchorNode
      ? anchorNode.nodeType === Node.ELEMENT_NODE
        ? (anchorNode as Element)
        : anchorNode.parentElement
      : null;
    const existingLink = anchorEl?.closest("a") as HTMLAnchorElement | null;

    if (existingLink && contentRef.current?.contains(existingLink)) {
      setEditingLink({
        el: existingLink,
        url: existingLink.href,
        text: existingLink.textContent || "",
      });
    } else {
      // Use selected text as display text
      const selectedText = sel?.toString().trim() || "";
      setEditingLink(null);
      // Store selected text for the popover
      savedSelectionRef.current = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).cloneRange() : null;
    }
    setLinkPopoverOpen(true);
  };

  const handleInsertLink = (href: string) => {
    // Restore saved selection FIRST, then focus
    const sel = window.getSelection();
    if (savedSelectionRef.current && sel) {
      sel.removeAllRanges();
      sel.addRange(savedSelectionRef.current);
    }
    contentRef.current?.focus();

    // Re-check selection after focus
    const currentSel = window.getSelection();
    const selectedText = currentSel?.toString().trim() || "";

    if (selectedText && currentSel && currentSel.rangeCount > 0) {
      // Wrap selected text with link
      const range = currentSel.getRangeAt(0);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      range.surroundContents(anchor);
      // Move cursor after the link
      range.setStartAfter(anchor);
      range.collapse(true);
      currentSel.removeAllRanges();
      currentSel.addRange(range);
    } else {
      // No selection — insert the URL as clickable text
      document.execCommand(
        "insertHTML",
        false,
        `<a href="${href}" target="_blank" rel="noopener noreferrer">${href}</a>`
      );
    }
    savedSelectionRef.current = null;
  };

  const handleUpdateLink = (href: string) => {
    if (!editingLink) return;
    editingLink.el.href = href;
    editingLink.el.setAttribute("target", "_blank");
    editingLink.el.setAttribute("rel", "noopener noreferrer");
    setEditingLink(null);
    contentRef.current?.focus();
  };

  const handleRemoveLink = () => {
    if (!editingLink) return;
    const textNode = document.createTextNode(editingLink.el.textContent || "");
    editingLink.el.parentNode?.replaceChild(textNode, editingLink.el);
    setEditingLink(null);
    contentRef.current?.focus();
  };

  const isTogglingList = useRef(false);

  const toggleBulletList = () => {
    isTogglingList.current = true;
    document.execCommand("insertUnorderedList", false);
    // Mark the list so normalization preserves it
    if (contentRef.current) {
      contentRef.current.querySelectorAll("ul:not([data-list])").forEach((ul) => {
        ul.setAttribute("data-list", "true");
      });
    }
    contentRef.current?.focus();
    // Reset flag after a tick so onInput doesn't strip our list
    requestAnimationFrame(() => { isTogglingList.current = false; });
  };

  const toggleBlockquote = () => {
    const editor = contentRef.current;
    if (!editor) return;
    editor.focus();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    const anchorNode = selection.anchorNode;
    const anchorEl =
      anchorNode?.nodeType === Node.ELEMENT_NODE
        ? (anchorNode as Element)
        : anchorNode?.parentElement || null;

    // If already inside a blockquote → unwrap
    const existing = anchorEl?.closest("blockquote");
    if (existing && editor.contains(existing)) {
      const parent = existing.parentNode;
      if (parent) {
        while (existing.firstChild) parent.insertBefore(existing.firstChild, existing);
        parent.removeChild(existing);
      }
      return;
    }

    // Find the closest block-level container (p/div) to wrap
    const block = anchorEl?.closest("p, div, h1, h2, h3, h4, h5, h6") as HTMLElement | null;
    const target = block && editor.contains(block) && block !== editor ? block : null;

    const bq = document.createElement("blockquote");

    if (target) {
      target.parentNode?.insertBefore(bq, target);
      bq.appendChild(target);
    } else {
      // No block: wrap selected text or insert empty quote paragraph
      const p = document.createElement("p");
      const selectedText = range.toString();
      p.textContent = selectedText || "";
      if (!selectedText) p.innerHTML = "<br>";
      bq.appendChild(p);
      range.deleteContents();
      range.insertNode(bq);
    }

    // Place caret at end of blockquote
    const newRange = document.createRange();
    newRange.selectNodeContents(bq);
    newRange.collapse(false);
    selection.removeAllRanges();
    selection.addRange(newRange);
  };

  const bypassCooldown = isFounder || isAdmin;
  const isEditingPublished = !!editId && existingStory && !existingStory.is_draft;
  const canPublish = bypassCooldown || isEditingPublished || cooldown?.canPublish !== false;

  const publishLabel = () => {
    if (bypassCooldown || isEditingPublished || !cooldown || cooldown.canPublish) return "publish";
    if (cooldown.daysLeft > 0) return `${cooldown.daysLeft}d ${cooldown.hoursLeft}h`;
    return `${cooldown.hoursLeft}h`;
  };

  const handleSave = async (isDraft: boolean) => {
    const rawContent = contentRef.current?.innerHTML || "";
    const content = normalizeHtmlContent(rawContent);
    if (!title.trim()) {
      toast.error("title is required");
      return;
    }
    if (!isDraft && wordCount < MIN_PUBLISH_WORDS) {
      toast.error(`minimum ${MIN_PUBLISH_WORDS} words to publish (you have ${wordCount}) (◞‸◟)`);
      return;
    }
    if (!isDraft && !canPublish) {
      toast.error(`you can publish again in ${cooldown?.daysLeft}d ${cooldown?.hoursLeft}h (◞‸◟)`);
      return;
    }
    try {
      const result = await saveMutation.mutateAsync({
        id: currentIdRef.current || editId || undefined,
        title,
        subtitle,
        content,
        is_draft: isDraft,
      });
      if (result?.id) currentIdRef.current = result.id;
      lastSavedRef.current = JSON.stringify({ title, subtitle, content });
      toast.success(isDraft ? "draft saved (◕‿◕)" : "published! (ﾉ◕ヮ◕)ﾉ*:・ﾟ✧");
      const storyId = currentIdRef.current || result?.id;
      navigate(isDraft ? "/settings" : `/story/${storyId}`);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const insertKaomoji = (_k: string) => {
    // Kaomoji picker now copies to clipboard; user pastes manually
    // This callback is kept as fallback for clipboard API failure
    contentRef.current?.focus();
    document.execCommand("insertText", false, _k);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith("image/")) {
      toast.error("only image files are allowed");
      return;
    }

    setUploading(true);
    try {
      const compressed = await compressImage(file, { quality: 0.9, format: "image/jpeg" });
      const ext = "jpg";
      const path = `${user.id}/${Date.now()}.${ext}`;

      const { error } = await supabase.storage
        .from("story-images")
        .upload(path, compressed, { contentType: "image/jpeg" });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from("story-images")
        .getPublicUrl(path);

      contentRef.current?.focus();
      document.execCommand(
        "insertHTML",
        false,
        `<img src="${urlData.publicUrl}" alt="story image" style="max-width:100%;border-radius:8px;margin:1rem 0" />`
      );
      updateWordCount();
      toast.success("image uploaded (◕‿◕)");
    } catch (err: any) {
      toast.error(err.message || "upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const readTime = Math.max(1, Math.ceil(wordCount / 200));

  if (preview) {
    return (
      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-3">
            <button onClick={() => { setPreview(false); requestAnimationFrame(() => { if (contentRef.current) contentRef.current.innerHTML = previewHtml; }); }} className="text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="inline h-4 w-4" /> edit
            </button>
            <span className="text-xs text-muted-foreground">preview</span>
          </div>
        </header>
        <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
          <h1 className="font-serif text-3xl font-medium tracking-tight">{title || "untitled"}</h1>
          {subtitle && <p className="mt-2 text-muted-foreground">{subtitle}</p>}
          <div className="my-6 h-px w-12 bg-border" />
          <div
            className={`prose prose-neutral max-w-none text-lg leading-relaxed ${editorSpacingClassesImportant}`}
            dangerouslySetInnerHTML={{ __html: sanitizeStoryHtml(previewHtml) }}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-3">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> back
          </button>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-muted-foreground">
              {autoSaveStatus === "saving" ? "saving..." : autoSaveStatus === "saved" ? "saved ✓" : `${wordCount} words · ${readTime} min`}
            </span>
            <button
              onClick={() => { setPreviewHtml(normalizeHtmlContent(contentRef.current?.innerHTML || "")); setPreview(true); }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              <Eye className="inline h-3.5 w-3.5" /> preview
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={saveMutation.isPending}
              className="rounded-md bg-muted px-3 py-1 text-xs text-muted-foreground hover:bg-secondary"
            >
              draft
            </button>
            <button
              onClick={() => handleSave(false)}
              disabled={saveMutation.isPending || !canPublish}
              className="rounded-md bg-foreground px-3 py-1 text-xs text-background hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              title={!canPublish ? `you can publish again in ${cooldown?.daysLeft}d ${cooldown?.hoursLeft}h` : ""}
            >
              {publishLabel()}
            </button>
          </div>
        </div>
      </header>

      {/* Toolbar - floating centered on mobile, sticky on desktop */}
      <div ref={toolbarRef} className="fixed bottom-3 left-1/2 z-40 m-0 h-11 w-[min(calc(100vw-24px),28rem)] max-w-[calc(100vw-24px)] -translate-x-1/2 overflow-visible rounded-full border border-border/60 bg-background/95 p-0 shadow-lg backdrop-blur-sm transition-[bottom] duration-150 md:sticky md:top-[53px] md:left-auto md:w-auto md:max-w-none md:translate-x-0 md:rounded-none md:border-x-0 md:border-t-0 md:border-b md:border-border/50 md:shadow-none">
        <div className="flex h-full items-center gap-1.5 overflow-x-auto px-3 text-muted-foreground sm:gap-2 md:mx-auto md:max-w-2xl md:px-6">
          {toolbar?.bold && (
            <button onClick={() => execCommand("bold")} className="h-7 w-7 rounded text-xs font-bold hover:text-foreground" title="Bold">B</button>
          )}
          {toolbar?.italic && (
            <button onClick={() => execCommand("italic")} className="h-7 w-7 rounded text-xs italic hover:text-foreground" title="Italic">I</button>
          )}
          {toolbar?.underline && (
            <button onClick={() => execCommand("underline")} className="h-7 w-7 rounded text-xs underline hover:text-foreground" title="Underline">U</button>
          )}
          {toolbar?.strikethrough && (
            <button onClick={() => execCommand("strikeThrough")} className="h-7 w-7 rounded hover:text-foreground flex items-center justify-center" title="Strikethrough">
              <Strikethrough className="h-3.5 w-3.5" />
            </button>
          )}
          {toolbar?.bullet_list && (
            <button onClick={toggleBulletList} className="h-7 w-7 rounded hover:text-foreground flex items-center justify-center" title="Bulleted list">
              <List className="h-3.5 w-3.5" />
            </button>
          )}
          {toolbar?.blockquote && (
            <button onClick={toggleBlockquote} className="h-7 w-7 rounded hover:text-foreground flex items-center justify-center" title="Quote (kutipan)">
              <Quote className="h-3.5 w-3.5" />
            </button>
          )}
          {toolbar?.link && (
            <>
              <div className="h-4 w-px bg-border" />
              <button onClick={openLinkPopover} className="h-7 w-7 rounded hover:text-foreground flex items-center justify-center" title="Insert link">
                <Link2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
          {toolbar?.kaomoji && (
            <>
              <div className="h-4 w-px bg-border" />
              <KaomojiPicker onSelect={insertKaomoji}>
                <button className="h-7 rounded px-2 text-[10px] hover:text-foreground">(◕‿◕)</button>
              </KaomojiPicker>
            </>
          )}
          {canUseImage && (
            <>
              <div className="h-4 w-px bg-border" />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="h-7 w-7 rounded hover:text-foreground flex items-center justify-center"
                title="Insert image"
              >
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </>
          )}
        </div>
        {linkPopoverOpen && (
          <div className="relative">
            <EditorLinkPopover
              onInsert={handleInsertLink}
              onClose={() => { setLinkPopoverOpen(false); setEditingLink(null); }}
              editingLink={editingLink ? { url: editingLink.url, text: editingLink.text } : null}
              onUpdate={handleUpdateLink}
              onRemove={handleRemoveLink}
            />
          </div>
        )}
      </div>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-8 pb-28 md:pb-8">
        <input
          type="text"
          placeholder="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full bg-transparent font-serif text-3xl font-medium tracking-tight placeholder:text-muted-foreground/30 focus:outline-none"
        />
        <input
          type="text"
          placeholder="subtitle..."
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
          className="mt-2 w-full bg-transparent text-sm text-muted-foreground placeholder:text-muted-foreground/30 focus:outline-none"
        />

        <div className="my-6 h-px w-12 bg-border" />

        <div
          ref={contentRef}
          contentEditable
          suppressContentEditableWarning
          onClick={(e) => {
            const target = e.target as HTMLElement;
            const link = target.closest("a") as HTMLAnchorElement | null;
            if (link && contentRef.current?.contains(link)) {
              e.preventDefault();
              setEditingLink({ el: link, url: link.href, text: link.textContent || "" });
              setLinkPopoverOpen(true);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              const selection = window.getSelection();
              const anchorNode = selection?.anchorNode;
              const anchorElement = anchorNode
                ? anchorNode.nodeType === Node.ELEMENT_NODE
                  ? (anchorNode as Element)
                  : anchorNode.parentElement
                : null;

              // Don't intercept Enter inside a list
              if (anchorElement?.closest("li")) return;

              e.preventDefault();

              const block = anchorElement?.closest("p, div");
              const isRootBlock = !block || block === contentRef.current;
              const isEmptyBlock =
                !!block &&
                !isRootBlock &&
                !block.textContent?.trim() &&
                !block.querySelector("img");

              if (isEmptyBlock && block) {
                const spacer = document.createElement("p");
                spacer.className = "spacer";
                spacer.innerHTML = "<br>";
                block.replaceWith(spacer);

                const newP = document.createElement("p");
                newP.innerHTML = "<br>";
                spacer.insertAdjacentElement("afterend", newP);

                const range = document.createRange();
                range.selectNodeContents(newP);
                range.collapse(true);
                selection?.removeAllRanges();
                selection?.addRange(range);
              } else {
                document.execCommand("insertParagraph");
              }

              requestAnimationFrame(syncSpacerBlocks);
            }
          }}
          onInput={() => {
            updateWordCount();
            // Prevent browser auto-creating lists from "- " or "1. " patterns
            // Skip if we just intentionally toggled a list
            if (contentRef.current && !isTogglingList.current) {
              contentRef.current.querySelectorAll("ul:not([data-list]), ol:not([data-list])").forEach((list) => {
                // Browser just auto-created this list — unwrap it
                const items = list.querySelectorAll("li");
                const fragment = document.createDocumentFragment();
                items.forEach((li) => {
                  const p = document.createElement("p");
                  p.innerHTML = li.innerHTML || "<br>";
                  fragment.appendChild(p);
                });
                list.parentNode?.replaceChild(fragment, list);
              });
            }

            syncSpacerBlocks();
          }}
          onPaste={(e) => {
            e.preventDefault();
            const html = e.clipboardData.getData("text/html");
            const text = e.clipboardData.getData("text/plain");
            if (html) {
              const cleaned = sanitizePastedHtml(html);
              document.execCommand("insertHTML", false, cleaned);
            } else {
              document.execCommand("insertText", false, text);
            }
            updateWordCount();
            requestAnimationFrame(syncSpacerBlocks);
          }}
          data-placeholder="begin writing..."
          className={`min-h-[300px] text-lg leading-relaxed focus:outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/30 [&_*]:!text-[length:inherit] [&_*]:!font-[inherit] [&_a]:!text-foreground [&_a]:underline [&_a]:underline-offset-2 [&_a]:decoration-foreground/30 [&_a]:hover:decoration-foreground/60 ${editorSpacingClasses}`}
        />
        <EditorImageOverlay
          activeImg={activeImg}
          onDelete={removeImage}
          overlayRef={overlayRef}
        />
      </main>
    </div>
  );
};

export default Write;
