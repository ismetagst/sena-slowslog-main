import { useEffect, useState, useCallback } from "react";
import { Trash2 } from "lucide-react";

interface Props {
  activeImg: HTMLImageElement | null;
  onDelete: () => void;
  overlayRef: React.RefObject<HTMLDivElement | null>;
}

const EditorImageOverlay = ({ activeImg, onDelete, overlayRef }: Props) => {
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const updatePos = useCallback(() => {
    if (!activeImg) return;
    const rect = activeImg.getBoundingClientRect();
    setPos({ top: rect.top + window.scrollY, left: rect.right - 16 });
  }, [activeImg]);

  useEffect(() => {
    updatePos();
    window.addEventListener("scroll", updatePos, true);
    window.addEventListener("resize", updatePos);
    return () => {
      window.removeEventListener("scroll", updatePos, true);
      window.removeEventListener("resize", updatePos);
    };
  }, [updatePos]);

  if (!activeImg) return null;

  const rect = activeImg.getBoundingClientRect();

  return (
    <div
      ref={overlayRef}
      data-editor-delete
      className="fixed z-[100]"
      style={{
        top: rect.top - 12,
        left: rect.right - 12,
      }}
    >
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDelete();
        }}
        className="flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-white shadow-md hover:bg-red-700 transition-colors"
        title="Remove image"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
};

export default EditorImageOverlay;
