import { Resend } from "resend";

const key = process.env.RESEND_API_KEY;
const from = process.env.RESEND_FROM || "Aangan <onboarding@resend.dev>";
const resend = key ? new Resend(key) : null;

/**
 * Sends a notification. Without RESEND_API_KEY it logs instead of failing, so
 * local development and the first deploy work with no email setup at all.
 */
export async function sendMail(opts: { to: string; subject: string; html: string }) {
  if (!resend) {
    console.log(`[email:stub] to=${opts.to} subject=${opts.subject}`);
    return { stubbed: true as const };
  }
  try {
    await resend.emails.send({ from, ...opts });
    return { stubbed: false as const };
  } catch (err) {
    console.error("[email:error]", err);
    return { stubbed: false as const, error: true as const };
  }
}

/**
 * The new-request notification.
 *
 * It deliberately does NOT contain the resident's phone number. An earlier
 * version did, which quietly broke the promise made on the booking form —
 * "no phone numbers are exchanged until they accept". The number was being
 * handed over the instant the request was sent, accept or not. It now appears
 * only on the dashboard, after accepting.
 */
export function leadEmail(a: {
  providerName: string; ref: string; message: string;
  residentName: string; when: string | null; url: string; fee: string; free: boolean;
}) {
  return `
  <div style="font-family:system-ui,sans-serif;max-width:520px;color:#333433">
    <p style="color:#7a4900;font-size:18px;margin:0 0 4px"><b>New booking request</b></p>
    <p style="margin:0 0 18px;color:#8b8c88;font-size:13px">${a.ref} · Aangan</p>
    <p>Hello ${a.providerName},</p>
    <p><b>${a.residentName}</b> has asked for:</p>
    <blockquote style="margin:0 0 16px;padding:12px 14px;background:#f8f1e3;border-left:3px solid #c86840;border-radius:6px">
      ${a.message}
    </blockquote>
    ${a.when ? `<p style="margin:0 0 16px"><b>Requested for:</b> ${a.when}</p>` : ""}
    <p style="margin:0 0 20px;font-size:14px">
      ${a.free
        ? "Accepting this one is <b>free</b> — it comes out of your free allowance."
        : `Accepting costs <b>${a.fee}</b>. Declining is free.`}
    </p>
    <p style="margin:0 0 22px">
      <a href="${a.url}" style="background:#c86840;color:#fff;padding:11px 20px;border-radius:999px;text-decoration:none;display:inline-block">
        Accept or decline
      </a>
    </p>
    <p style="color:#8b8c88;font-size:12px;line-height:1.6">
      You will see ${a.residentName}&rsquo;s phone number as soon as you accept,
      and can message them on WhatsApp with one tap. Nothing is shared before
      that. You are only charged for requests you accept.
    </p>
  </div>`;
}
