import { useEffect, useRef, useCallback, useState } from "react";

const HOVER_PROXIMITY = 10; // px

export const useEditorImages = (editorRef: React.RefObject<HTMLDivElement | null>) => {
  const [activeImg, setActiveImg] = useState<HTMLImageElement | null>(null);
  const [hoveredImg, setHoveredImg] = useState<HTMLImageElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  const clearStates = useCallback(() => {
    setActiveImg(null);
    setHoveredImg(null);
  }, []);

  const removeImage = useCallback(() => {
    if (activeImg && activeImg.parentNode) {
      activeImg.parentNode.removeChild(activeImg);
      setActiveImg(null);
    }
  }, [activeImg]);

  // Apply/remove visual classes on images
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const imgs = editor.querySelectorAll("img");
    imgs.forEach((img) => {
      img.classList.remove("editor-img-hover", "editor-img-active");
      if (img === activeImg) {
        img.classList.add("editor-img-active");
      } else if (img === hoveredImg) {
        img.classList.add("editor-img-hover");
      }
    });
  }, [activeImg, hoveredImg, editorRef]);

  // Mouse move – proximity hover detection
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const handleMouseMove = (e: MouseEvent) => {
      const imgs = editor.querySelectorAll("img");
      let found: HTMLImageElement | null = null;

      for (const img of imgs) {
        const rect = img.getBoundingClientRect();
        const expandedRect = {
          left: rect.left - HOVER_PROXIMITY,
          right: rect.right + HOVER_PROXIMITY,
          top: rect.top - HOVER_PROXIMITY,
          bottom: rect.bottom + HOVER_PROXIMITY,
        };
        if (
          e.clientX >= expandedRect.left &&
          e.clientX <= expandedRect.right &&
          e.clientY >= expandedRect.top &&
          e.clientY <= expandedRect.bottom
        ) {
          found = img as HTMLImageElement;
          break;
        }
      }

      if (found !== hoveredImg) {
        setHoveredImg(found);
      }
    };

    editor.addEventListener("mousemove", handleMouseMove);
    return () => editor.removeEventListener("mousemove", handleMouseMove);
  }, [editorRef, hoveredImg]);

  // Click – select/deselect images
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "IMG") {
        e.preventDefault();
        setActiveImg(target as HTMLImageElement);
      } else {
        // Check if clicking on delete overlay
        if (target.closest("[data-editor-delete]")) return;
        setActiveImg(null);
      }
    };

    editor.addEventListener("click", handleClick);
    return () => editor.removeEventListener("click", handleClick);
  }, [editorRef]);

  // Click outside editor deselects
  useEffect(() => {
    if (!activeImg) return;

    const handleOutsideClick = (e: MouseEvent) => {
      const editor = editorRef.current;
      const overlay = overlayRef.current;
      if (!editor) return;
      const target = e.target as HTMLElement;
      if (!editor.contains(target) && (!overlay || !overlay.contains(target))) {
        setActiveImg(null);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [activeImg, editorRef]);

  return { activeImg, hoveredImg, removeImage, clearStates, overlayRef };
};
