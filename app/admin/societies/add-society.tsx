"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { addSociety, type SocietyState } from "../actions";
import { Button, Card, Field, inputClass } from "@/components/ui";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Adding…" : "Add society"}
    </Button>
  );
}

const EMPTY = { name: "", area: "", pincode: "", map_url: "", city: "Pune" };

/**
 * Controlled inputs, deliberately.
 *
 * React 19 resets a form with an action after every submission, success or
 * not. Left uncontrolled, a rejected pincode or a mistyped Maps link would
 * empty every field and make the person retype the lot — punishing them for a
 * typo. Holding the values here means a failure leaves the form exactly as it
 * was, and only a success clears it.
 */
export default function AddSociety() {
  const [state, action] = useActionState<SocietyState, FormData>(addSociety, {});
  const [v, setV] = useState(EMPTY);

  useEffect(() => {
    if (state.ok) setV(EMPTY);
  }, [state]);

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setV((prev) => ({ ...prev, [k]: e.target.value }));

  return (
    <Card className="p-5">
      <form action={action}>
        <Field label="Society name" hint="as residents say it">
          <input
            name="name"
            required
            value={v.name}
            onChange={set("name")}
            className={inputClass}
            placeholder="Kumar Prospera"
          />
        </Field>

        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Area" hint="the neighbourhood">
            <input
              name="area"
              value={v.area}
              onChange={set("area")}
              className={inputClass}
              placeholder="Kharadi"
            />
          </Field>
          <Field label="Pincode" hint="optional">
            <input
              name="pincode"
              inputMode="numeric"
              maxLength={6}
              value={v.pincode}
              onChange={set("pincode")}
              className={inputClass}
              placeholder="411014"
            />
          </Field>
        </div>

        <Field label="Google Maps link" hint="optional">
          <input
            name="map_url"
            type="url"
            value={v.map_url}
            onChange={set("map_url")}
            className={inputClass}
            placeholder="https://maps.app.goo.gl/..."
          />
          <span className="block mt-1.5 text-[11.5px] text-charcoal-faint leading-snug">
            In Google Maps, find the society gate, press <b>Share</b> and copy the
            link. Residents use it to judge whether a provider is genuinely near
            them.
          </span>
        </Field>

        <Field label="City">
          <input
            name="city"
            value={v.city}
            onChange={set("city")}
            className={inputClass}
          />
        </Field>

        {state.error && (
          <p className="text-[13px] text-terracotta-deep mb-3">{state.error}</p>
        )}
        {state.ok && <p className="text-[13px] text-sage-deep mb-3">{state.ok}</p>}

        <Submit />
      </form>
    </Card>
  );
}
