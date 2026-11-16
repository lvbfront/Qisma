"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatDate } from "@/lib/dates";
import { formatAmount } from "@/lib/money";
import { supabaseBrowser } from "@/utils/supabase/client";
import type { PendingBucketTransfer } from "./distribute/data";

/** One pending bank transfer caused by moving money between buckets in different accounts. */
export function BankTransferTick({ transfer }: { transfer: PendingBucketTransfer }) {
  const router = useRouter();
  const [done, setDone] = useState(false);
  const [failure, setFailure] = useState(false);

  async function tick(checked: boolean) {
    setFailure(false);
    setDone(checked); // optimistic
    const { error } = await supabaseBrowser().from("entries").update({ transfer_done: checked }).eq("id", transfer.entryId);
    if (error) {
      setDone(!checked);
      return setFailure(true);
    }
    router.refresh();
  }

  return (
    <div className="rounded-card border border-hairline bg-surface p-4">
      <label className="flex cursor-pointer items-center gap-3">
        <input type="checkbox" checked={done} onChange={(e) => tick(e.target.checked)} className="size-6 shrink-0 accent-accent" />
        <span className="min-w-0 flex-1">
          <span className="block text-label text-muted">
            حوّل من {transfer.fromAccount} إلى
          </span>
          <span className="block truncate font-semibold">{transfer.toAccount}</span>
          <span className="amount block truncate text-label text-muted">
            من بند {transfer.fromBucket} إلى بند {transfer.toBucket} · {formatDate(transfer.occurredOn)}
          </span>
        </span>
        <span className="amount shrink-0 text-heading font-bold">{formatAmount(transfer.amount)}</span>
      </label>
      {failure && (
        <p role="alert" className="mt-2 text-label text-danger">
          تعذّر حفظ العلامة. حاول مرة أخرى.
        </p>
      )}
    </div>
  );
}
