import { useState, useEffect, useRef } from "react";
import { Link2, ExternalLink, Trash2, X, Check } from "lucide-react";

interface EditorLinkPopoverProps {
  onInsert: (url: string) => void;
  onClose: () => void;
  /** When editing an existing link */
  editingLink?: { url: string; text: string } | null;
  onUpdate?: (url: string) => void;
  onRemove?: () => void;
}

const EditorLinkPopover = ({
  onInsert,
  onClose,
  editingLink,
  onUpdate,
  onRemove,
}: EditorLinkPopoverProps) => {
  const [url, setUrl] = useState(editingLink?.url || "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  const handleSubmit = () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    const href = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

    if (editingLink && onUpdate) {
      onUpdate(href);
    } else {
      onInsert(href);
    }
    onClose();
  };

  return (
    <div className="absolute left-0 right-0 bottom-full mb-2 md:bottom-auto md:top-full md:mt-2 z-[60] flex justify-center px-4">
      <div
        className="w-full max-w-sm rounded-lg border border-border bg-popover p-3 shadow-lg animate-in fade-in-0 slide-in-from-top-1 duration-150"
        onMouseDown={(e) => e.preventDefault()}
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
            <Link2 className="h-3 w-3" />
            {editingLink ? "edit link" : "insert link"}
          </span>
          <button
            onClick={onClose}
            className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        </div>

        <input
          ref={inputRef}
          type="text"
          placeholder="https://..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring"
        />

        <div className="mt-3 flex items-center justify-between">
          <div className="flex gap-1">
            {editingLink && onRemove && (
              <button
                onClick={() => { onRemove(); onClose(); }}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-3 w-3" /> remove
              </button>
            )}
            {editingLink && url.trim() && (
              <a
                href={/^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground"
              >
                <ExternalLink className="h-3 w-3" /> open
              </a>
            )}
          </div>
          <button
            onClick={handleSubmit}
            disabled={!url.trim()}
            className="flex items-center gap-1 rounded-md bg-foreground px-3 py-1 text-[10px] text-background hover:opacity-90 disabled:opacity-40"
          >
            <Check className="h-3 w-3" />
            {editingLink ? "update" : "add"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditorLinkPopover;
