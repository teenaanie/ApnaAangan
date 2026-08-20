/**
 * Click-to-chat links. No API, no account, no cost.
 *
 * wa.me opens WhatsApp with the recipient and the message pre-filled, and the
 * person still presses send themselves. That last part is why it needs no
 * business verification: it is a shortcut for a human, not an automated
 * message. Sending WhatsApp messages *automatically* is a different thing
 * entirely — see the notes in the deployment guide.
 */

/** India country code. Numbers are stored as 10 digits. */
const CC = "91";

export function waNumber(phone: string): string {
  const digits = (phone || "").replace(/\D/g, "");
  if (digits.length === 10) return CC + digits;
  // Already carries a country code, or is something unusual — pass it through
  // rather than mangling it.
  return digits.replace(/^0+/, "");
}

export function waLink(phone: string, text: string): string {
  return `https://wa.me/${waNumber(phone)}?text=${encodeURIComponent(text)}`;
}

/** What a provider says to a resident whose request they just accepted. */
export function waGreeting(
  lead: { resident_name: string; message: string; requested_time: string | null; ref: string },
  providerName?: string
): string {
  const who = providerName ? ` This is ${providerName}.` : "";
  const when = lead.requested_time ? ` You mentioned ${lead.requested_time}.` : "";
  return (
    `Hello ${lead.resident_name}, I got your request on Aangan (${lead.ref}).${who}\n\n` +
    `You asked for: ${lead.message}${when}\n\n` +
    `Happy to help — shall we sort out the details?`
  );
}

/** What an administrator sends to nudge a provider who has not responded. */
export function waProviderNudge(a: {
  providerName: string;
  ref: string;
  residentName: string;
  message: string;
  url: string;
}): string {
  return (
    `Hello ${a.providerName}, you have a new request on Aangan.\n\n` +
    `${a.residentName} asked for: ${a.message}\n` +
    `Reference: ${a.ref}\n\n` +
    `Accept or decline it here: ${a.url}\n\n` +
    `You are only charged if you accept, and declining is free.`
  );
}
