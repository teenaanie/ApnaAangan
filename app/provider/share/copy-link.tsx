"use client";

import { useState } from "react";
import { Button, Card } from "@/components/ui";

export default function CopyLink({ url, waText }: { url: string; waText: string }) {
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

  return (
    <Card className="p-4">
      <p className="font-mono text-body break-all text-terracotta-deep mb-3">{url}</p>
      <div className="flex gap-2 flex-wrap">
        <Button onClick={copy} variant={copied ? "sage" : "primary"}>
          {copied ? "Copied" : "Copy link"}
        </Button>
        <a
          href={`https://wa.me/?text=${waText}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-body font-bold border border-sandstone bg-surface hover:border-terracotta"
        >
          Share on WhatsApp
        </a>
      </div>
    </Card>
  );
}
