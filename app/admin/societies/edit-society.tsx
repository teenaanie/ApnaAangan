"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { renameSociety, type SocietyState } from "../actions";
import { Button, inputClass } from "@/components/ui";

type Society = {
  id: string;
  name: string;
  area: string | null;
  pincode: string | null;
  map_url: string | null;
};

function Save() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save"}
    </Button>
  );
}

/**
 * Collapsed until asked for — the same rule as a listing.
 *
 * A page of societies each showing four open input boxes is a page of things
 * that look half-edited, and it is not obvious which one a stray keystroke
 * lands in. One Edit button per row, one form open at a time.
 */
export default function EditSociety({ society }: { society: Society }) {
  const [state, action] = useActionState<SocietyState, FormData>(renameSociety, {});
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({
    name: society.name,
    area: society.area ?? "",
    pincode: society.pincode ?? "",
    map_url: society.map_url ?? "",
  });

  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state]);

  // Pick up what was actually stored after a save, so re-opening shows truth.
  useEffect(() => {
    setV({
      name: society.name,
      area: society.area ?? "",
      pincode: society.pincode ?? "",
      map_url: society.map_url ?? "",
    });
  }, [society.name, society.area, society.pincode, society.map_url]);

  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setV((prev) => ({ ...prev, [k]: e.target.value }));

  if (!open) {
    return (
      <div className="mt-3 pt-3 border-t border-sandstone-soft flex flex-wrap items-center gap-3">
        <Button type="button" variant="ghost" onClick={() => setOpen(true)}>
          Edit
        </Button>
        {state.ok && <span className="text-[12px] text-sage-deep">{state.ok}</span>}
      </div>
    );
  }

  return (
    <form
      action={action}
      className="mt-3 pt-3 border-t border-sandstone-soft flex flex-wrap items-end gap-2"
    >
      <input type="hidden" name="id" value={society.id} />

      <label className="block flex-1 min-w-[150px]">
        <span className="block text-[11px] font-bold mb-1">Name</span>
        <input
          name="name" required value={v.name} onChange={set("name")}
          className={`${inputClass} py-1.5`}
        />
      </label>

      <label className="block flex-1 min-w-[130px]">
        <span className="block text-[11px] font-bold mb-1">Area</span>
        <input
          name="area" value={v.area} onChange={set("area")}
          className={`${inputClass} py-1.5`}
        />
      </label>

      <label className="block w-[100px]">
        <span className="block text-[11px] font-bold mb-1">Pincode</span>
        <input
          name="pincode" inputMode="numeric" maxLength={6}
          value={v.pincode} onChange={set("pincode")}
          className={`${inputClass} py-1.5`}
        />
      </label>

      <label className="block w-full">
        <span className="block text-[11px] font-bold mb-1">Google Maps link</span>
        <input
          name="map_url" type="url" value={v.map_url} onChange={set("map_url")}
          className={`${inputClass} py-1.5`}
          placeholder="https://maps.app.goo.gl/..."
        />
      </label>

      {state.error && (
        <p className="w-full text-[12px] text-terracotta-deep m-0">{state.error}</p>
      )}

      <div className="flex gap-2">
        <Save />
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
