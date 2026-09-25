"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Field, Note, inputClass } from "@/components/ui";
import { Spinner } from "@/components/icons";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** A Supabase project URL looks like https://<ref>.supabase.co — nothing else. */
function urlProblem(url: string | undefined): string | null {
  if (!url) return "NEXT_PUBLIC_SUPABASE_URL is not set in .env.local.";
  if (url.includes("supabase.com/dashboard"))
    return "That is the dashboard address, not the project URL. Use https://<your-ref>.supabase.co";
  if (/\/(rest|auth|storage|realtime|functions)\/v\d/i.test(url))
    return "Drop the /rest/v1 from the end — the base URL must stop at .supabase.co.";
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i.test(url.replace(/\/+$/, "")))
    return "It should look like https://abcdefghijklm.supabase.co — no trailing slash, no path.";
  return null;
}

/** Supabase errors are terse. Say what to actually do about them. */
function explain(raw: string): { message: string; hint: string } {
  // These are read by home bakers and tuition teachers, not by whoever runs
  // the project. Anything that says "go into Supabase and change a setting" is
  // an instruction the reader cannot follow and should never have seen — the
  // same mistake as the operator copy that once reached the public empty
  // state. Fixes for the operator live in the deployment notes.
  if (/rate limit/i.test(raw))
    return {
      message: "Too many emails have gone out in the last hour.",
      hint: "Wait a few minutes and try again, or tell us and we will sort it out.",
    };
  if (/invalid login credentials/i.test(raw))
    return {
      message: "That email and password don't match an account.",
      hint: "If you haven't created one yet, switch to Create account below.",
    };
  if (/email not confirmed/i.test(raw))
    return {
      message: "This account has not been confirmed yet.",
      hint: "Open the link in the email we sent you. Use the button below to send it again.",
    };
  if (/password/i.test(raw) && /least|short/i.test(raw))
    return { message: raw, hint: "Six characters or more." };
  if (/failed to fetch|networkerror|load failed/i.test(raw))
    return {
      message: "Could not reach the server.",
      hint: "Check your connection and try again.",
    };
  // A magic-link click bounces through /auth/callback, which redirects here
  // with ?error=<reason> on any failure. The two real-world causes: the link
  // is opened in a different browser/app than the one that requested it (the
  // most common case on a phone — mail apps often open links in their own
  // in-app browser, which doesn't have the cookie the original request set),
  // or the link has simply gone stale.
  if (/flow state|code verifier|invalid request/i.test(raw))
    return {
      message: "That link only works in the browser you asked for it in.",
      hint: "If you opened it from a mail app on your phone, try again in Chrome or the same browser you signed up in — or just request a fresh one below.",
    };
  if (/expired|otp_expired/i.test(raw))
    return {
      message: "That link has expired.",
      hint: "Links only last a little while — request a new one below.",
    };
  if (/no_token/i.test(raw))
    return {
      message: "That link didn't work.",
      hint: "Request a new one below.",
    };
  return { message: raw, hint: "" };
}

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/provider";
  // /auth/callback redirects here with ?error=<reason> when a magic-link
  // click fails — read it once on load so the failure is actually visible,
  // instead of the link just silently bouncing back to a blank form.
  const callbackError = params.get("error");
  const initialExplained = callbackError ? explain(decodeURIComponent(callbackError)) : null;

  const [mode, setMode] = useState<"signin" | "signup">(callbackError ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialExplained?.message ?? "");
  const [hint, setHint] = useState(initialExplained?.hint ?? "");
  const [notice, setNotice] = useState("");
  /** The address a confirmation was sent to, once one has been. */
  const [awaiting, setAwaiting] = useState("");
  const [resent, setResent] = useState(false);

  async function resend() {
    const supabase = createClient();
    // Passwordless signup never confirms separately from signing in — "send
    // it again" is just asking for another magic link, the same call as the
    // original request.
    const { error } = await supabase.auth.signInWithOtp({
      email: awaiting || email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      const x = explain(error.message);
      setError(x.message);
      setHint(x.hint);
    } else {
      setResent(true);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setHint("");
    setNotice("");

    const problem = urlProblem(SUPABASE_URL);
    if (problem || !SUPABASE_KEY) {
      setError(problem ?? "NEXT_PUBLIC_SUPABASE_ANON_KEY is not set in .env.local.");
      setHint(`Currently reading: ${SUPABASE_URL ?? "(nothing)"}`);
      return;
    }

    setBusy(true);
    const supabase = createClient();

    try {
      if (mode === "signup") {
        // Passwordless: one email, one click. It both confirms the address
        // and signs them in — there is no separate "now log in" step, and
        // nothing to invent or forget. If the address already has a
        // password-based account, Supabase quietly signs that account in
        // instead of erroring, which is the right fallback rather than a
        // "which email did I use" dead end.
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            shouldCreateUser: true,
            data: { full_name: name },
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
          },
        });
        if (error) {
          const x = explain(error.message);
          setError(x.message);
          setHint(x.hint);
        } else {
          setAwaiting(email);
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          const x = explain(error.message);
          setError(x.message);
          setHint(x.hint);
        } else {
          router.push(next);
          router.refresh();
        }
      }
    } catch (err) {
      const x = explain(err instanceof Error ? err.message : String(err));
      setError(x.message);
      setHint(x.hint);
    } finally {
      setBusy(false);
    }
  }

  if (notice) return <Note>{notice}</Note>;

  if (awaiting) {
    return (
      <>
        <Note tone="sage">
          <b>Check your email.</b> We have sent a link to{" "}
          <b>{awaiting}</b>. Open it and your account is ready — it is how we
          know the address is really yours, which is what lets a listing set up
          for you become yours.
        </Note>

        <p className="text-body text-charcoal-soft mt-4 leading-relaxed">
          It usually arrives within a minute. If it is not there, look in spam —
          and check the address above is spelled right.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button type="button" variant="ghost" onClick={resend} disabled={resent}>
            {resent ? "Sent again" : "Send it again"}
          </Button>
          <button
            type="button"
            onClick={() => {
              setAwaiting("");
              setResent(false);
              setMode("signup");
            }}
            className="text-body font-bold text-charcoal-soft hover:text-terracotta-deep"
          >
            Use a different address
          </button>
        </div>

        {error && (
          <p className="text-body text-terracotta-deep mt-4">{error}</p>
        )}
      </>
    );
  }

  return (
    <>
      <div className="flex gap-1 p-1 bg-sandstone-soft rounded-full mb-5 border border-sandstone-soft">
        {(["signin", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setError("");
              setHint("");
            }}
            className={`flex-1 rounded-full py-2 text-body font-bold transition ${
              // Mustard, not terracotta: the guideline gives "active states" to
              // Dark Mustard, and it is the same treatment the filter chips use.
              mode === m ? "bg-mustard text-white" : "text-charcoal-soft hover:text-charcoal"
            }`}
          >
            {m === "signin" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      <form onSubmit={submit}>
        {mode === "signup" && (
          <Field label="Your name">
            <input
              required
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Meera R"
            />
          </Field>
        )}

        <Field label="Email address">
          <input
            type="email"
            required
            autoComplete="email"
            className={inputClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </Field>

        {/* No password on signup — one email, one click is the whole account. */}
        {mode === "signin" && (
          <Field label="Password">
            <input
              type="password"
              required
              minLength={6}
              autoComplete="current-password"
              className={inputClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
        )}

        <Button type="submit" full disabled={busy} style={busy ? { opacity: 0.95 } : undefined}>
          {busy && <Spinner size={15} />}
          {busy
            ? mode === "signup"
              ? "Sending…"
              : "Signing in…"
            : mode === "signup"
            ? "Send me a link"
            : "Sign in"}
        </Button>

        {/* Only offered on sign-in. Someone creating an account has no password
            to forget, and the link there would just be a second thing to read. */}
        {mode === "signin" && (
          <p className="text-caption text-charcoal-soft mt-4 text-center">
            <Link
              href="/auth/forgot"
              className="font-bold text-terracotta-deep underline underline-offset-2"
            >
              Forgotten your password?
            </Link>
          </p>
        )}

        {error && (
          <div className="mt-4">
            <p className="text-body font-bold text-terracotta-deep mb-2">{error}</p>
            {hint && (
              <p className="text-caption text-charcoal-soft leading-relaxed">{hint}</p>
            )}
            {/* Someone who never opened the link is stuck until they get
                another one, and asking them to hunt for a week-old email is
                not an answer. */}
            {/not been confirmed/i.test(error) && (
              <div className="mt-3">
                <Button type="button" variant="ghost" onClick={resend} disabled={resent}>
                  {resent ? "Sent — check your email" : "Send the confirmation again"}
                </Button>
              </div>
            )}
          </div>
        )}
      </form>

      <div className="mt-5">
        <Note>
          <b>Only people who list their work need an account.</b> Residents
          browse and send booking requests without signing in at all.
        </Note>
      </div>
    </>
  );
}
