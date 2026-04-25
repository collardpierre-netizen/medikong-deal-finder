/**
 * Normalize a product image to a consistent square (1:1) canvas
 * with white background, max NxN, and WebP encoding.
 *
 * Goal: produce a uniform gallery — every photo same ratio, same canvas,
 * letterboxed instead of cropped (so we never amputate a product).
 */

export interface NormalizeOptions {
  /** Output canvas size in pixels (square). Default 1200. */
  size?: number;
  /** Background color used to letterbox. Default white. */
  background?: string;
  /** Output mime: "image/webp" (default) or "image/jpeg". */
  mime?: "image/webp" | "image/jpeg";
  /** Encoding quality 0-1. Default 0.88. */
  quality?: number;
  /** If true, crop center to square (cover). If false, letterbox (contain). Default false. */
  crop?: boolean;
}

/** Decode a File (or Blob) into an HTMLImageElement using object URL. */
function decodeImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image decode failed"));
    };
    img.src = url;
  });
}

/**
 * Render the image into a square canvas, contained or covered, padded with `background`.
 * Returns a normalized File with the original base name and the chosen extension.
 */
export async function normalizeImageFile(
  file: File,
  opts: NormalizeOptions = {}
): Promise<File> {
  const {
    size = 1200,
    background = "#ffffff",
    mime = "image/webp",
    quality = 0.88,
    crop = false,
  } = opts;

  const img = await decodeImage(file);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  // Fill background (used as letterbox padding)
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, size, size);

  const srcW = img.naturalWidth;
  const srcH = img.naturalHeight;
  if (!srcW || !srcH) throw new Error("Invalid image dimensions");

  let sx = 0,
    sy = 0,
    sw = srcW,
    sh = srcH;
  let dx = 0,
    dy = 0,
    dw = size,
    dh = size;

  if (crop) {
    // Cover: crop the center to fit a square
    const side = Math.min(srcW, srcH);
    sx = (srcW - side) / 2;
    sy = (srcH - side) / 2;
    sw = side;
    sh = side;
  } else {
    // Contain: letterbox, preserve full subject
    const ratio = Math.min(size / srcW, size / srcH);
    dw = Math.round(srcW * ratio);
    dh = Math.round(srcH * ratio);
    dx = Math.round((size - dw) / 2);
    dy = Math.round((size - dh) / 2);
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);

  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Canvas encode failed"))),
      mime,
      quality
    )
  );

  const ext = mime === "image/webp" ? "webp" : "jpg";
  const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
  return new File([blob], `${baseName}.${ext}`, { type: mime, lastModified: Date.now() });
}
