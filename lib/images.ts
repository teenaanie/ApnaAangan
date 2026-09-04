/**
 * Resize in the browser before uploading.
 *
 * A photo straight off a phone is 4-8 MB and 4000px wide. Nothing on this site
 * displays it larger than about 800px, so uploading the original wastes the
 * provider's mobile data — which they are paying for, on a page asking them to
 * do us a favour — and fills the storage quota forty times faster than needed.
 * 1600px at quality 0.82 lands around 200-300 KB and is still sharp on a
 * retina screen at the size it is shown.
 *
 * EXIF orientation is handled by createImageBitmap's imageOrientation option,
 * without which portrait photos from many Android phones arrive on their side.
 *
 * Lived inside the photo strip until the add-listing form needed it too, and
 * then the poster reader — which passes a larger edge, because what matters on
 * a poster is the small type along the bottom, not how it looks.
 */
export const MAX_PHOTOS = 4;
const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.82;

export const PHOTO_TYPES = /^image\/(jpeg|png|webp)$/;

export async function shrink(
  file: File,
  opts?: { maxEdge?: number; quality?: number }
): Promise<Blob> {
  const maxEdge = opts?.maxEdge ?? MAX_EDGE;
  const quality = opts?.quality ?? JPEG_QUALITY;

  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not read that image.");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const blob = await new Promise<Blob | null>((res) =>
    canvas.toBlob(res, "image/jpeg", quality)
  );
  if (!blob) throw new Error("Could not read that image.");
  return blob;
}
