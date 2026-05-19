/**
 * Resize/compress a photo before sending it to a Server Action.
 *
 * Phone camera rolls routinely produce 3–8 MB JPEGs. Next.js rejects
 * Server Action bodies over 1 MB by default, which surfaces on mobile
 * as "An unexpected response was received from the server" before our
 * code ever runs. Downscaling to ~1600px and re-encoding as JPEG
 * keeps quality high enough for Gemini while staying well under limits.
 */
export async function compressImageForUpload(file: File): Promise<File> {
  // Already small — skip work (common for screenshots).
  if (file.size <= 900_000) return file;

  // HEIC/HEIF can't be decoded in all browsers via canvas — send as-is
  // and rely on the raised server bodySizeLimit in next.config.ts.
  const type = file.type.toLowerCase();
  if (
    type.includes("heic") ||
    type.includes("heif") ||
    (!type.startsWith("image/") && !file.name.match(/\.(jpe?g|png|webp)$/i))
  ) {
    return file;
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }

  const maxDim = 1600;
  let { width, height } = bitmap;
  if (width > maxDim || height > maxDim) {
    const scale = maxDim / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", 0.85);
  });
  if (!blob) return file;

  const baseName = file.name.replace(/\.[^.]+$/, "") || "photo";
  return new File([blob], `${baseName}.jpg`, {
    type: "image/jpeg",
    lastModified: file.lastModified,
  });
}
