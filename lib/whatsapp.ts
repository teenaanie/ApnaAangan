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

/**
 * What an administrator sends a resident whose request went nowhere.
 *
 * Nobody else can send this. A provider never sees a resident's number until
 * they accept — that promise is on the booking form and is enforced by the
 * database, not by good manners. An administrator can see it, and this is the
 * one case where using it is the kind thing: a request that was declined, or
 * that nobody answered for two days, otherwise ends in silence and the
 * resident is left assuming the whole directory is dead.
 *
 * It says what happened, apologises without grovelling, and offers the next
 * step. It does not tell the resident who declined them or why — that is the
 * provider's business, and a directory that reports on its own providers is
 * not one anyone would join.
 */
export function waResidentFollowUp(a: {
  residentName: string;
  ref: string;
  message: string;
  declined: boolean;
  url: string;
  /** The lister's own words, if they gave any. Passed on as theirs. */
  reason?: string | null;
}): string {
  const what = a.declined
    ? "they are not able to take it on right now"
    : "we have not heard back from them";
  // Their words, marked as theirs. "Fully booked on Saturday" is worth far
  // more to the resident than a decline on its own — it is the difference
  // between asking again next week and giving up on the directory.
  const because = a.declined && a.reason ? ` They said: “${a.reason}”` : "";
  return (
    `Hello ${a.residentName}, this is Apna Aangan about your request ${a.ref}.\n\n` +
    `You asked for: ${a.message}\n\n` +
    `Unfortunately ${what}.${because} Sorry to keep you waiting.\n\n` +
    `There may be someone else nearby who can help — have a look here: ${a.url}\n\n` +
    `If you would like us to find someone for you, just reply to this message.`
  );
}

/** What an administrator sends a provider who declined, or left it unanswered. */
export function waProviderFollowUp(a: {
  providerName: string;
  ref: string;
  residentName: string;
  message: string;
  declined: boolean;
  url: string;
}): string {
  if (a.declined) {
    return (
      `Hello ${a.providerName}, this is Apna Aangan.\n\n` +
      `You declined ${a.residentName}'s request (${a.ref}) for: ${a.message}\n\n` +
      `That is completely fine — declining is free and always will be. We are ` +
      `only checking whether anything is getting in your way: timing, the kind ` +
      `of work, or the way requests reach you. Anything you tell us helps.`
    );
  }
  return (
    `Hello ${a.providerName}, this is Apna Aangan.\n\n` +
    `${a.residentName}'s request (${a.ref}) is still waiting for an answer: ${a.message}\n\n` +
    `Declining is free and takes one tap — an answer either way is much better ` +
    `for them than silence: ${a.url}\n\n` +
    `If requests are not reaching you properly, tell us and we will sort it out.`
  );
}
