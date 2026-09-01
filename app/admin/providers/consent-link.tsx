"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { waConsentInvite, waLink } from "@/lib/whatsapp";
import { WhatsApp } from "@/components/icons";

/**
 * The link, and the two ways to get it to them.
 *
 * WhatsApp first and pre-written, because the administrator is going to be
 * doing this on a phone, standing in a lobby, and "compose a message
 * explaining what this link is" is the step where it stops happening. wa.me
 * opens the chat with the message ready and a human still presses send.
 *
 * The plain link is underneath for the person who is on a laptop, or whose
 * number was typed wrong, or who wants to paste it into a society group.
 */
export default function ConsentLink({
  url,
  phone,
  name,
  what,
  society,
  from,
}: {
  url: string;
  phone?: string;
  name?: string;
  what?: string;
  society?: string;
  from?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const message = waConsentInvite({
    name: name || "there",
    what: what || "your listing",
    society: society || "your society",
    url,
    from,
  });

  return (
    <div className="mt-3 p-3.5 rounded-xl bg-mustard-tint border border-mustard/25">
      <p className="text-caption font-bold text-mustard m-0 mb-1.5">
        Waiting for them to accept
      </p>
      <p className="font-mono text-caption break-all text-terracotta-deep m-0 mb-3">
        {url}
      </p>
      <div className="flex flex-wrap gap-2">
        {phone && (
          <a
            href={waLink(phone, message)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-body font-bold border border-sage/30 bg-sage-tint text-sage-deep hover:bg-sage hover:text-white transition"
          >
            <WhatsApp size={15} />
            Send on WhatsApp
          </a>
        )}
        <Button type="button" variant={copied ? "sage" : "ghost"} onClick={copy}>
          {copied ? "Copied" : "Copy link"}
        </Button>
      </div>
      <p className="text-caption text-charcoal-faint m-0 mt-2.5 leading-snug">
        Nothing is visible to a neighbour until they accept. The link is good
        for thirty days and stops working the moment it is used.
      </p>
    </div>
  );
}
