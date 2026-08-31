"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { addListing, type ActionState } from "../actions";
import { Button, Card, Field, Note, inputClass } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { MAX_PHOTOS, PHOTO_TYPES, shrink } from "@/lib/images";
import type { Category } from "@/lib/types";

function Submit() {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending}>{pending ? "Adding…" : "Add listing"}</Button>;
}

const EMPTY = {
  title: "",
  category_id: "",
  description: "",
  price_from: "",
  price_unit: "onwards",
  availability: "",
  keywords: "",
  additional_info: "",
};

const INFO_MAX = 600;

/**
 * Controlled inputs, deliberately.
 *
 * React 19 resets a form with an action after EVERY submission, success or
 * failure. Left uncontrolled, a rejected listing would empty every field and
 * make the provider retype the lot. Holding the values here means a failure
 * leaves the form as it was, and only a success clears it — which also stops
 * the "did that work?" second press that creates a duplicate.
 */
export default function AddListing({
  categories,
  providerId,
  societyName,
}: {
  categories: Category[];
  /** Needed to build the storage path, which is scoped per provider. */
  providerId: string;
  /** Where this listing will appear. Shown rather than asked: a listing
      belongs to the provider's society, and a provider halfway through the
      form should not have to remember which one they chose at sign-up. */
  societyName?: string | null;
}) {
  const router = useRouter();
  const [state, action] = useActionState<ActionState, FormData>(addListing, {});
  const [v, setV] = useState(EMPTY);

  /* Photos chosen while writing the listing, uploaded once it exists.
     A photo belongs to a listing, and the listing has no id until the form has
     been submitted — so asking for pictures here and uploading them there is
     the only honest order. The alternative was what we had: no photo field at
     all, and a provider told to come back and find the card afterwards, which
     is how listings stay pictureless. */
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [photoNote, setPhotoNote] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!state.ok) return;
    setV(EMPTY);

    const chosen = files;
    setFiles([]);
    if (fileRef.current) fileRef.current.value = "";
    if (!chosen.length || !state.listingId) return;

    let cancelled = false;
    (async () => {
      setUploading(true);
      try {
        const supabase = createClient();
        for (const file of chosen.slice(0, MAX_PHOTOS)) {
          const blob = await shrink(file);
          const path = `${providerId}/${state.listingId}/${crypto.randomUUID()}.jpg`;
          const up = await supabase.storage
            .from("listing-photos")
            .upload(path, blob, { contentType: "image/jpeg", upsert: false });
          if (up.error) throw new Error(up.error.message);

          const ins = await supabase.from("listing_photos").insert({
            listing_id: state.listingId,
            provider_id: providerId,
            storage_path: path,
          });
          // Orphaned bytes help nobody and still count against the quota.
          if (ins.error) {
            await supabase.storage.from("listing-photos").remove([path]);
            throw new Error(ins.error.message);
          }
        }
        if (!cancelled) {
          setPhotoNote(
            `${chosen.length} photo${chosen.length === 1 ? "" : "s"} added — they are read before they appear.`
          );
          router.refresh();
        }
      } catch (err) {
        if (!cancelled)
          setPhotoNote(
            `The listing was added, but the photos did not upload: ${
              err instanceof Error ? err.message : String(err)
            }. Add them from the listing above.`
          );
      } finally {
        if (!cancelled) setUploading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const set =
    (k: keyof typeof EMPTY) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setV((prev) => ({ ...prev, [k]: e.target.value }));

  return (
    <Card className="p-5">
      {societyName && (
        <p className="text-caption text-charcoal-soft m-0 mb-4 pb-3.5 border-b border-sandstone-soft">
          This will be listed in <b className="text-charcoal">{societyName}</b>,
          alongside your other work. To list somewhere else, tell us and we will
          sort it out.
        </p>
      )}
      <form action={action}>
        <Field label="What do you offer?">
          <input
            name="title" required value={v.title} onChange={set("title")}
            className={inputClass} placeholder="Weekend sourdough"
          />
        </Field>

        {/* The icon comes from the category now — see the note in the edit
            form. One less thing to answer. */}
        <Field label="Category">
          <select
            name="category_id" value={v.category_id} onChange={set("category_id")}
            className={inputClass}
          >
            <option value="">Choose one</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
            ))}
          </select>
        </Field>

        <Field label="Describe it">
          <textarea
            name="description" rows={2} value={v.description} onChange={set("description")}
            className={inputClass}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Starting price (₹)">
            <input
              name="price_from" type="number" min={0} value={v.price_from}
              onChange={set("price_from")} className={inputClass} placeholder="320"
            />
          </Field>
          <Field label="Per">
            <input
              name="price_unit" value={v.price_unit} onChange={set("price_unit")}
              className={inputClass}
            />
          </Field>
        </div>

        <Field label="Availability" hint="optional">
          <input
            name="availability" value={v.availability} onChange={set("availability")}
            className={inputClass} placeholder="Fri & Sat pickup"
          />
        </Field>

        {/* The same search-words field the edit form has had all along. It was
            missing here, which meant every new listing started without the one
            thing that makes it findable in another language — and nobody goes
            back to add it later. */}
        <Field label="Search words" hint="optional — nobody sees these">
          <input
            name="keywords" value={v.keywords} onChange={set("keywords")}
            className={inputClass}
            placeholder="dabba, tiffin, ghar ka khana, lunch box"
          />
          <span className="block mt-1.5 text-caption text-charcoal-faint leading-snug">
            Words a neighbour might type that are not in your description —
            other languages, local names, common misspellings. Someone searching
            &ldquo;silai&rdquo; will not find &ldquo;stitching&rdquo; unless you
            put it here. Up to 12, separated by commas.
          </span>
        </Field>

        {/* Asked for here as well as on the listing card. Someone adding a
            tuition slot knows their notice period and their payment terms at
            the moment they are writing the listing — sending them back to a
            second form afterwards is how the field stays empty. */}
        <Field label="Anything else neighbours should know" hint="optional">
          <textarea
            name="additional_info"
            rows={3}
            maxLength={INFO_MAX}
            value={v.additional_info}
            onChange={set("additional_info")}
            className={inputClass}
            placeholder="Two days' notice for large orders. Delivery within the society only. UPI or cash on collection."
          />
          <span className="block mt-1.5 text-caption text-charcoal-faint leading-snug">
            Notice you need, the area you cover, how you take payment, festival
            timings. Not the place for a phone number — yours stays private
            until you accept a request.
          </span>
        </Field>

        <Field label="Photos" hint="optional — up to 4">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={(e) => {
              const picked = Array.from(e.target.files ?? []).filter((f) =>
                PHOTO_TYPES.test(f.type)
              );
              setFiles(picked.slice(0, MAX_PHOTOS));
              setPhotoNote("");
            }}
            className="block w-full text-body file:mr-3 file:rounded-full file:border file:border-sandstone file:bg-surface file:px-4 file:py-2 file:text-body file:font-bold file:text-charcoal-soft hover:file:border-terracotta"
          />
          <span className="block mt-1.5 text-caption text-charcoal-faint leading-snug">
            {files.length > 0
              ? `${files.length} chosen. They upload once the listing is created, and are resized for you.`
              : "A photo of the actual thing sells it better than any description. They are resized for you, so a photo straight off your phone is fine."}
          </span>
        </Field>

        {state.error && <p className="text-body text-terracotta-deep mb-3">{state.error}</p>}
        {state.ok && (
          <div className="mb-3">
            <Note tone="sage">
              {state.ok}{" "}
              {uploading
                ? "Uploading your photos…"
                : photoNote}
            </Note>
          </div>
        )}

        <Submit />
      </form>
    </Card>
  );
}
