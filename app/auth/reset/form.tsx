"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Field, Note, inputClass } from "@/components/ui";
import { Spinner } from "@/components/icons";

/**
 * Set a new password.
 *
 * Arriving here means /auth/callback has already exchanged the emailed token
 * for a session — that session is the only proof this person owns the address,
 * so the first thing to do is check it exists. Without that check the page
 * would render a hopeful form for anyone who happened to type the URL, and
 * only fail on save.
 */
export default function ResetForm() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await createClient().auth.getSession();
        if (!cancelled) setHasSession(Boolean(data.session));
      } catch {
        if (!cancelled) setHasSession(false);
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await createClient().auth.updateUser({ password });
      if (error) setError(error.message);
      else setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (checking) {
    return <p className="text-charcoal-soft text-body">Checking your link…</p>;
  }

  if (!hasSession) {
    return (
      <Note tone="mustard">
        <b>This link has expired or has already been used.</b> Reset links work
        once and last an hour.{" "}
        <Link href="/auth/forgot" className="font-bold underline underline-offset-2">
          Ask for a fresh one
        </Link>
        .
      </Note>
    );
  }

  if (done) {
    return (
      <>
        <Note>
          <b>Password changed.</b> You are signed in already — there is nothing
          else to do.
        </Note>
        <div className="mt-5">
          <Button full onClick={() => router.push("/provider")}>
            Go to my dashboard
          </Button>
        </div>
      </>
    );
  }

  return (
    <form onSubmit={submit}>
      <Field label="New password" hint="six characters or more">
        <input
          type="password"
          required
          minLength={6}
          autoFocus
          autoComplete="new-password"
          className={inputClass}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>

      <Field label="Type it again">
        <input
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          className={inputClass}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </Field>

      <Button type="submit" full disabled={busy} style={busy ? { opacity: 0.95 } : undefined}>
        {busy && <Spinner size={15} />}
        {busy ? "Saving…" : "Set my new password"}
      </Button>

      {error && (
        <p className="text-body font-bold text-terracotta-deep mt-4">{error}</p>
      )}
    </form>
  );
}
