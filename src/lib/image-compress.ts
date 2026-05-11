const MAX_WIDTH = 1400;
const MAX_HEIGHT = 1400;
const DEFAULT_QUALITY = 0.8;

interface CompressOptions {
  quality?: number;
  format?: "image/webp" | "image/jpeg";
}

export const compressImage = (
  file: File,
  options?: CompressOptions
): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const quality = options?.quality ?? DEFAULT_QUALITY;
    const format = options?.format ?? "image/webp";
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;

      if (width > MAX_WIDTH) {
        height = (height * MAX_WIDTH) / width;
        width = MAX_WIDTH;
      }
      if (height > MAX_HEIGHT) {
        width = (width * MAX_HEIGHT) / height;
        height = MAX_HEIGHT;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Compression failed"))),
        format,
        quality
      );
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = url;
  });
