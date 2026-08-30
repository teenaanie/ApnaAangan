"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Badge, Button, Note } from "@/components/ui";
import { Check, Pencil } from "@/components/icons";

export type ListingPhoto = {
  id: string;
  storage_path: string;
  status: "pending" | "approved" | "rejected";
};

const MAX_PHOTOS = 4;
const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.82;

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
 */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
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
    canvas.toBlob(res, "image/jpeg", JPEG_QUALITY)
  );
  if (!blob) throw new Error("Could not read that image.");
  return blob;
}

export default function Photos({
  listingId,
  providerId,
  photos,
  publicBase,
}: {
  listingId: string;
  providerId: string;
  photos: ListingPhoto[];
  /** Public URL prefix for the bucket, so a path becomes an <img src>. */
  publicBase: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const live = photos.filter((p) => p.status !== "rejected");
  const full = live.length >= MAX_PHOTOS;

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setError("");
    setBusy(true);

    try {
      const supabase = createClient();
      const room = MAX_PHOTOS - live.length;
      if (files.length > room) {
        setError(
          `Room for ${room} more photo${room === 1 ? "" : "s"} on this listing.`
        );
      }

      for (const file of files.slice(0, room)) {
        if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
          setError("Photos need to be JPEG, PNG or WebP.");
          continue;
        }
        const blob = await shrink(file);
        const path = `${providerId}/${listingId}/${crypto.randomUUID()}.jpg`;

        const up = await supabase.storage
          .from("listing-photos")
          .upload(path, blob, { contentType: "image/jpeg", upsert: false });
        if (up.error) {
          setError(up.error.message);
          continue;
        }

        // The row is what makes it a photo of this listing; the file alone is
        // just bytes in a bucket. If this fails the file is orphaned, so it is
        // removed rather than left to occupy the quota forever.
        const ins = await supabase
          .from("listing_photos")
          .insert({ listing_id: listingId, provider_id: providerId, storage_path: path });
        if (ins.error) {
          await supabase.storage.from("listing-photos").remove([path]);
          setError(ins.error.message);
        }
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function remove(photo: ListingPhoto) {
    setBusy(true);
    setError("");
    try {
      const supabase = createClient();
      await supabase.from("listing_photos").delete().eq("id", photo.id);
      await supabase.storage.from("listing-photos").remove([photo.storage_path]);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {live.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-3">
          {live.map((p) => (
            <figure key={p.id} className="m-0 relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`${publicBase}/${p.storage_path}`}
                alt=""
                className="w-full aspect-square object-cover rounded-xl border border-sandstone-soft"
              />
              <figcaption className="mt-1.5 flex items-center justify-between gap-2">
                {p.status === "approved" ? (
                  <Badge tone="sage">
                    <Check size={12} />
                    Live
                  </Badge>
                ) : (
                  <Badge tone="mustard">Being checked</Badge>
                )}
                <button
                  type="button"
                  onClick={() => remove(p)}
                  disabled={busy}
                  className="text-caption font-bold text-charcoal-soft hover:text-terracotta-deep disabled:opacity-50"
                >
                  Remove
                </button>
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        hidden
        onChange={onPick}
      />

      <div className="flex flex-wrap items-center gap-2.5">
        <Button
          type="button"
          variant="ghost"
          disabled={busy || full}
          onClick={() => fileRef.current?.click()}
        >
          <Pencil size={15} />
          {busy ? "Uploading…" : live.length === 0 ? "Add photos" : "Add another"}
        </Button>
        <span className="text-caption text-charcoal-faint">
          {full
            ? `${MAX_PHOTOS} is the limit — remove one to add another.`
            : `${live.length} of ${MAX_PHOTOS}. They are resized for you, so a photo straight off your phone is fine.`}
        </span>
      </div>

      {error && (
        <p className="text-body font-bold text-terracotta-deep mt-3">{error}</p>
      )}

      {live.some((p) => p.status === "pending") && (
        <div className="mt-3">
          <Note tone="mustard">
            New photos are read before they appear, usually within a day. What is
            already live stays up in the meantime.
          </Note>
        </div>
      )}
    </div>
  );
}
