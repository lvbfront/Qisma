import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { formatDate } from "@/lib/dates";
import { formatAmount } from "@/lib/money";
import { createClient } from "@/utils/supabase/server";
import { loadPending } from "./distribute/data";

export default function Page() {
  return (
    <>
      <h1 className="text-title font-bold">الرئيسية</h1>
      <Suspense fallback={null}>
        <PendingTransfers />
      </Suspense>
      <p className="mt-6 text-muted">قريبًا</p>
    </>
  );
}

/** Confirmed distributions whose transfers are not all ticked yet. */
async function PendingTransfers() {
  await connection();
  const pending = await loadPending(await createClient());
  if (pending.length === 0) return null;
  return (
    <section aria-labelledby="pending-title" className="mt-6">
      <h2 id="pending-title" className="text-heading font-bold">
        تحويلات لم تكتمل
      </h2>
      <ul className="mt-3 flex flex-col gap-3">
        {pending.map((p) => (
          <li key={p.incomeId}>
            <Link
              href={`/distribute?income=${p.incomeId}`}
              className="flex items-center gap-3 rounded-card border border-hairline bg-surface p-4"
            >
              <span className="min-w-0 flex-1">
                <span className="amount block font-semibold">متبقٍّ {formatAmount(p.remaining)}</span>
                <span className="amount block text-label text-muted">
                  من توزيع {formatAmount(p.amount)} بتاريخ {formatDate(p.receivedOn)} · {p.accounts === 1 ? "حساب واحد" : `${p.accounts} حسابات`}
                </span>
              </span>
              <span className="shrink-0 text-label font-semibold text-accent">متابعة</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
