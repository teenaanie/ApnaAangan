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

export function leadEmail(a: {
  providerName: string; ref: string; message: string;
  residentName: string; residentPhone: string; when: string | null; url: string;
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
    ${a.when ? `<p style="margin:0 0 12px"><b>Requested for:</b> ${a.when}</p>` : ""}
    <p style="margin:0 0 18px"><b>Their number:</b> ${a.residentPhone}</p>
    <p style="margin:0 0 22px">
      <a href="${a.url}" style="background:#c86840;color:#fff;padding:11px 20px;border-radius:999px;text-decoration:none;display:inline-block">
        Accept or decline
      </a>
    </p>
    <p style="color:#8b8c88;font-size:12px;line-height:1.6">
      You are only charged for requests you accept, and your first 10 are free.
      Declining costs nothing.
    </p>
  </div>`;
}
