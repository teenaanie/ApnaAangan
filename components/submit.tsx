"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "./ui";
import { Spinner } from "./icons";

/**
 * A submit button that knows it has been pressed.
 *
 * Every action in this app is a round trip to a database in Mumbai, from a
 * phone on a society's wifi. One to two seconds is normal. For most of the app
 * that second was silent: the button did not move, nothing appeared, and the
 * only honest reading of the screen was "it did not work" — so people pressed
 * again. The database is idempotent about most of it (accepting a lead twice
 * charges once, because the trigger tests old.status), but "the data survives"
 * is not the same as "the person knows what happened".
 *
 * `useFormStatus` reports the pending state of the nearest enclosing form, so
 * this must be rendered INSIDE the <form> it submits — which also means two
 * forms side by side (Approve and Reject) each spin only their own button. It
 * works from a server component: the form and the page stay on the server,
 * only the button is a client component.
 *
 * While pending, the button is disabled. That is the half that actually
 * prevents the double submission; the spinner is the half that explains why.
 */
export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  full,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  /** Shown in place of the label while the action runs. Defaults to the
      label itself, which keeps the button from changing width mid-press. */
  pendingLabel?: ReactNode;
  variant?: "primary" | "ghost" | "sage" | "danger";
  full?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      {...rest}
      type="submit"
      variant={variant}
      full={full}
      className={className}
      disabled={pending || rest.disabled}
      aria-busy={pending || undefined}
      /* A disabled button is drawn at half opacity, which is right for one you
         may not press yet and wrong for one that is working — it dims the very
         spinner that explains the wait. Inline, so it beats the class without
         needing an !important. A button disabled for any other reason keeps
         the faded treatment. */
      style={pending ? { opacity: 0.95, ...rest.style } : rest.style}
    >
      {pending && <Spinner size={15} />}
      {pending ? pendingLabel ?? children : children}
    </Button>
  );
}
