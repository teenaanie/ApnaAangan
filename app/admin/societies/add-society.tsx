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

const EMPTY = { name: "", area: "", pincode: "", map_url: "", city: "Pune", lat: "", lng: "" };

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
          <span className="block mt-1.5 text-caption text-charcoal-faint leading-snug">
            In Google Maps, find the society gate, press <b>Share</b> and copy the
            link. Residents use it to judge whether a provider is genuinely near
            them.
          </span>
        </Field>

        {/* Coordinates let sign-up offer this society to someone standing in
            it, instead of asking them to find it in a dropdown — which is the
            step most people skip. Filled in from the map link above when it
            carries them; otherwise right-click the gate in Google Maps and the
            first item on the menu is the pair of numbers. */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Latitude" hint="optional">
            <input
              name="lat" value={v.lat} onChange={set("lat")}
              className={inputClass} placeholder="18.4632" inputMode="decimal"
            />
          </Field>
          <Field label="Longitude" hint="optional">
            <input
              name="lng" value={v.lng} onChange={set("lng")}
              className={inputClass} placeholder="73.9143" inputMode="decimal"
            />
          </Field>
        </div>
        <p className="text-caption text-charcoal-faint -mt-2 mb-4 leading-snug">
          With these, a provider signing up nearby is offered this society
          straight away. Right-click the society gate in Google Maps and the
          first item on the menu is the pair of numbers &mdash; copy it in.
        </p>

        <Field label="City">
          <input
            name="city"
            value={v.city}
            onChange={set("city")}
            className={inputClass}
          />
        </Field>

        {state.error && (
          <p className="text-body text-terracotta-deep mb-3">{state.error}</p>
        )}
        {state.ok && <p className="text-body text-sage-deep mb-3">{state.ok}</p>}

        <Submit />
      </form>
    </Card>
  );
}
