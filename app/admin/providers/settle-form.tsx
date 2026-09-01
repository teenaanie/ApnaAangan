"use client";

import { useActionState } from "react";
import { recordSettlement, type SettleState } from "../actions";
import { inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit";

function Submit() {
  return (
    <SubmitButton variant="sage" pendingLabel="Recording…">
      Record payment
    </SubmitButton>
  );
}

/**
 * Amounts are entered in RUPEES here and converted to paise on the server.
 * Asking an administrator to type 34000 for ₹340 at eleven at night is how
 * a provider ends up credited a hundred times what they paid.
 */
export default function SettleForm({
  providerId,
  outstandingRupees,
}: {
  providerId: string;
  outstandingRupees: number;
}) {
  const [state, action] = useActionState<SettleState, FormData>(recordSettlement, {});

  return (
    // No rule of its own: this now sits inside the folded money panel, which
    // draws the one line separating it from the provider's details.
    <form action={action} className="mt-1">
      <input type="hidden" name="provider_id" value={providerId} />
      <div className="flex flex-wrap items-end gap-2">
        <label className="block">
          <span className="block text-caption font-bold mb-1">Amount received (₹)</span>
          <input
            name="amount_rupees"
            type="number"
            min="1"
            step="1"
            required
            defaultValue={outstandingRupees > 0 ? outstandingRupees : undefined}
            className={`${inputClass} w-[130px] py-1.5`}
          />
        </label>
        <label className="block">
          <span className="block text-caption font-bold mb-1">How</span>
          <select name="method" className={`${inputClass} w-[110px] py-1.5`} defaultValue="upi">
            <option value="upi">UPI</option>
            <option value="cash">Cash</option>
            <option value="bank">Bank</option>
            <option value="waived">Waived</option>
          </select>
        </label>
        <label className="block flex-1 min-w-[140px]">
          <span className="block text-caption font-bold mb-1">Reference / note</span>
          <input
            name="reference"
            className={`${inputClass} py-1.5`}
            placeholder="UPI ref, or why it was waived"
          />
        </label>
        <Submit />
      </div>

      {state.error && (
        <p className="text-caption text-terracotta-deep mt-2 mb-0">{state.error}</p>
      )}
      {state.ok && <p className="text-caption text-sage-deep mt-2 mb-0">{state.ok}</p>}
    </form>
  );
}
