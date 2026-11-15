"use client";

import Link from "next/link";
import { useState } from "react";
import { bucketBg, SplitBar } from "@/components/split-bar";
import { formatDate } from "@/lib/dates";
import { formatAmount } from "@/lib/money";
import { supabaseBrowser } from "@/utils/supabase/client";
import { ui } from "../settings/data";
import { groupTransfers, type TransferGroup, type TransfersData } from "./data";

/** Step 3: what to move between real accounts after a confirmed distribution. */
export function Transfers({ data }: { data: TransfersData }) {
  const [entries, setEntries] = useState(data.entries);
  const [failure, setFailure] = useState<string | null>(null);
  const { incomeAccount, stay, transfers } = groupTransfers({ ...data, entries });
  const allDone = transfers.every((g) => g.done);

  const bucketOf = (id: string) => data.buckets.find((b) => b.id === id);
  const segments = [...entries]
    .sort((a, b) => Number(bucketOf(a.bucket_id)?.rule_kind === "remainder") - Number(bucketOf(b.bucket_id)?.rule_kind === "remainder"))
    .map((e) => {
      const b = bucketOf(e.bucket_id);
      return {
        id: e.id,
        label: b?.name ?? "",
        amount: e.amount,
        color: b?.rule_kind === "remainder" ? ("remainder" as const) : (b?.color ?? 1),
      };
    });

  async function tick(group: TransferGroup, done: boolean) {
    const ids = group.items.map((i) => i.entryId);
    const before = entries;
    setFailure(null);
    setEntries(entries.map((e) => (ids.includes(e.id) ? { ...e, transfer_done: done } : e))); // optimistic
    const { error } = await supabaseBrowser().from("entries").update({ transfer_done: done }).in("id", ids);
    if (error) {
      setEntries(before);
      setFailure("تعذّر حفظ العلامة. حاول مرة أخرى.");
    }
  }

  const items = (group: TransferGroup) => (
    <ul className="mt-3 flex flex-col gap-2">
      {group.items.map((item) => (
        <li key={item.entryId} className="flex items-center gap-2 text-label">
          <span aria-hidden className={`size-2.5 shrink-0 rounded-full ${bucketBg(item.isRemainder ? "remainder" : item.color)}`} />
          <span className="min-w-0 flex-1 truncate">{item.name}</span>
          <span className="amount text-muted">{formatAmount(item.amount)}</span>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="mt-6">
      <p className="text-label text-muted">
        توزيع بتاريخ <span className="amount">{formatDate(data.income.received_on)}</span>
        {data.income.note ? ` · ${data.income.note}` : ""}
      </p>
      <p className="amount mt-1 text-title font-bold">{formatAmount(data.income.amount)}</p>
      <div className="mt-4">
        <SplitBar segments={segments} />
      </div>

      <h2 className="mt-8 text-heading font-bold">التحويلات</h2>
      <p aria-live="polite" className="mt-1 text-label text-muted">
        {transfers.length === 0
          ? "لا توجد تحويلات: كل البنود في حساب الدخل."
          : allDone
            ? "اكتملت كل التحويلات."
            : "نفّذ كل تحويل من تطبيق البنك ثم ضع علامة عليه."}
      </p>
      {failure && (
        <p role="alert" className="mt-2 text-label text-danger">
          {failure}
        </p>
      )}

      <div className="mt-4 flex flex-col gap-3">
        {transfers.map((group) => (
          <div key={group.account?.id ?? "none"} className={ui.card}>
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={group.done}
                onChange={(e) => tick(group, e.target.checked)}
                className="size-6 shrink-0 accent-accent"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-label text-muted">
                  حوّل{incomeAccount ? ` من ${incomeAccount.name}` : ""} إلى
                </span>
                <span className={`block truncate font-semibold ${group.done ? "text-muted line-through" : ""}`}>
                  {group.account?.name ?? "حساب محذوف"}
                </span>
              </span>
              <span className={`amount text-heading font-bold ${group.done ? "text-muted" : ""}`}>{formatAmount(group.total)}</span>
            </label>
            {items(group)}
          </div>
        ))}

        {stay && (
          <div className={`${ui.card} bg-transparent`}>
            <div className="flex items-center gap-3">
              <span className="min-w-0 flex-1">
                <span className="block text-label text-muted">يبقى في الحساب</span>
                <span className="block truncate font-semibold">{stay.account?.name}</span>
              </span>
              <span className="amount text-heading font-bold">{formatAmount(stay.total)}</span>
            </div>
            {items(stay)}
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-2">
        <Link href="/" className={`${ui.secondary} text-center`}>
          الرئيسية
        </Link>
        <Link href="/distribute" className={`${ui.secondary} text-center`}>
          توزيع جديد
        </Link>
      </div>
    </div>
  );
}
