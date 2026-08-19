"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Field, Note, inputClass } from "@/components/ui";

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
  if (/rate limit/i.test(raw))
    return {
      message: "Supabase's built-in email sender has hit its hourly limit.",
      hint:
        "That limit is a handful of messages an hour and applies to sign-up confirmations. " +
        "Two fixes: turn OFF Authentication → Providers → Email → 'Confirm email' while you're " +
        "testing, or add your own SMTP under Project Settings → Auth → SMTP. " +
        "With confirmation off, accounts work instantly and no email is sent at all.",
    };
  if (/invalid login credentials/i.test(raw))
    return {
      message: "That email and password don't match an account.",
      hint: "If you haven't created one yet, switch to Create account below.",
    };
  if (/already registered|already exists/i.test(raw))
    return {
      message: "There's already an account with that email.",
      hint: "Switch to Sign in.",
    };
  if (/email not confirmed/i.test(raw))
    return {
      message: "This account still needs its email confirmed.",
      hint:
        "Either click the link Supabase emailed you, or turn off " +
        "Authentication → Providers → Email → 'Confirm email' in Supabase while you're testing.",
    };
  if (/password/i.test(raw) && /least|short/i.test(raw))
    return { message: raw, hint: "Six characters or more." };
  if (/failed to fetch|networkerror|load failed/i.test(raw))
    return {
      message: `Couldn't reach Supabase at ${SUPABASE_URL}`,
      hint: "Check NEXT_PUBLIC_SUPABASE_URL in .env.local, and restart the dev server after changing it.",
    };
  return { message: raw, hint: "" };
}

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/provider";

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [hint, setHint] = useState("");
  const [notice, setNotice] = useState("");

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
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name } },
        });
        if (error) {
          const x = explain(error.message);
          setError(x.message);
          setHint(x.hint);
        } else if (data.user && (data.user.identities?.length ?? 0) === 0) {
          // Supabase returns a decoy user with no identities when the email is
          // already registered, so as not to reveal who has an account. Nothing
          // is created, and without this check it looks like silent success.
          setError("There is already an account with this email.");
          setHint(
            "Switch to Sign in above. If you never set a password — because this email was used " +
              "for a magic link earlier — the quickest fix is to delete the user in Supabase " +
              "(Authentication → Users → find the email → Delete user) and create the account again here."
          );
        } else if (!data.session) {
          setNotice(
            "Account created, but Supabase wants the email confirmed before you can sign in. " +
              "Click the link it sent you — or turn OFF Authentication → Providers → Email → " +
              "'Confirm email' in Supabase while you're testing, then create the account again."
          );
        } else {
          router.push(next);
          router.refresh();
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

  return (
    <>
      <div className="flex gap-1 p-1 bg-cream-deep rounded-full mb-5 border border-sandstone-soft">
        {(["signin", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setError("");
              setHint("");
            }}
            className={`flex-1 rounded-full py-2 text-[13px] font-semibold transition ${
              mode === m ? "bg-terracotta text-white" : "text-charcoal-soft hover:text-charcoal"
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

        <Field label="Password" hint={mode === "signup" ? "six characters or more" : undefined}>
          <input
            type="password"
            required
            minLength={6}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            className={inputClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>

        <Button type="submit" full disabled={busy}>
          {busy
            ? mode === "signup"
              ? "Creating…"
              : "Signing in…"
            : mode === "signup"
            ? "Create account"
            : "Sign in"}
        </Button>

        {error && (
          <div className="mt-4">
            <p className="text-[13px] font-semibold text-terracotta-deep mb-2">{error}</p>
            {hint && (
              <p className="text-[12px] text-charcoal-soft leading-relaxed">{hint}</p>
            )}
          </div>
        )}
      </form>

      <div className="mt-5">
        <Note>
          <b>Only providers and admins need an account.</b> Residents browse and send
          booking requests without signing in at all.
        </Note>
      </div>
    </>
  );
}
