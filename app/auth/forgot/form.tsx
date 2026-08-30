"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button, Field, Note, inputClass } from "@/components/ui";

/**
 * Ask for a reset link.
 *
 * Two things are deliberate here.
 *
 * The confirmation never says whether the address has an account. "If that
 * address has an account, a link is on its way" is the same sentence either
 * way, so this form cannot be used to find out who is registered.
 *
 * The redirect goes through /auth/callback rather than straight to /auth/reset.
 * The callback is what exchanges the emailed token for a session; without it
 * the reset page would load with nobody signed in and no way to save.
 */
export default function ForgotForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=/auth/reset`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      // A missing account is not an error worth showing — see above.
      if (error && !/user not found/i.test(error.message)) {
        setError(
          /rate limit/i.test(error.message)
            ? "Too many reset emails have gone out in the last hour. Try again shortly."
            : error.message
        );
      } else {
        setSent(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <>
        <Note>
          <b>If {email} has an account, a link is on its way.</b> Open it on this
          device and you can set a new password. The link works once and expires
          after an hour.
        </Note>
        <p className="text-caption text-charcoal-soft mt-4 leading-relaxed">
          Nothing arrived? Check the spam folder first. If it is genuinely not
          there, the address may not have an account — try{" "}
          <Link href="/auth/login" className="font-bold text-terracotta-deep underline underline-offset-2">
            signing in
          </Link>{" "}
          or creating one.
        </p>
      </>
    );
  }

  return (
    <form onSubmit={submit}>
      <Field label="Email address" hint="the one you signed up with">
        <input
          type="email"
          required
          autoComplete="email"
          autoFocus
          className={inputClass}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </Field>

      <Button type="submit" full disabled={busy}>
        {busy ? "Sending…" : "Email me a reset link"}
      </Button>

      {error && (
        <p className="text-body font-bold text-terracotta-deep mt-4">{error}</p>
      )}

      <p className="text-caption text-charcoal-soft mt-5">
        Remembered it?{" "}
        <Link href="/auth/login" className="font-bold text-terracotta-deep underline underline-offset-2">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
