import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { bucketBg } from "@/components/bucket-color";
import { SplitBar } from "@/components/split-bar";
import { formatDate } from "@/lib/dates";
import { formatAmount } from "@/lib/money";
import { createClient } from "@/utils/supabase/server";
import { ui } from "../settings/data";
import { snapshotRows, snapshotSegments } from "./snapshot";

export default function Page() {
  return (
    <>
      <h1 className="text-title font-bold">السجل</h1>
      <Suspense fallback={<p className="mt-6 text-muted">جارٍ التحميل…</p>}>
        <Incomes />
      </Suspense>
    </>
  );
}

/** Every income, newest first; each opens to show how it was split (from the stored snapshot). */
async function Incomes() {
  await connection();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("incomes")
    .select("id, received_on, amount, note, snapshot")
    .order("received_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100); // ponytail: newest 100 only; add paging when a real history gets that long
  if (error) throw new Error(error.message);

  if (data.length === 0) {
    return (
      <div className={`${ui.card} mt-6`}>
        <p className="font-medium">لا يوجد دخل مسجَّل بعد</p>
        <p className="mt-1 text-label text-muted">كل دخل توزّعه يظهر هنا مع تفاصيل تقسيمه.</p>
        <Link href="/distribute" className={`${ui.primary} mt-4 block text-center`}>
          توزيع أول دخل
        </Link>
      </div>
    );
  }

  return (
    <ul className="mt-6 flex flex-col gap-3">
      {data.map((income) => {
        const rows = snapshotRows(income.snapshot);
        return (
          <li key={income.id}>
            <details className="group rounded-card border border-hairline bg-surface">
              <summary className="flex cursor-pointer list-none items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
                <span className="min-w-0 flex-1">
                  <span className="amount block text-heading font-bold">{formatAmount(income.amount)}</span>
                  <span className="amount block truncate text-label text-muted">
                    {formatDate(income.received_on)}
                    {income.note ? ` · ${income.note}` : ""}
                  </span>
                </span>
                <span aria-hidden className="text-muted transition-transform group-open:-rotate-90">
                  ‹
                </span>
              </summary>
              <div className="border-t border-hairline p-4">
                {rows.length === 0 ? (
                  <p className="text-label text-muted">تفاصيل التقسيم غير متوفرة لهذا الدخل.</p>
                ) : (
                  <>
                    <SplitBar segments={snapshotSegments(rows)} />
                    <ul className="mt-4 flex flex-col gap-3">
                      {rows.map((row) => (
                        <li key={row.bucketId} className={`flex items-center gap-3 ${row.off ? "opacity-55" : ""}`}>
                          <span aria-hidden className={`size-3 shrink-0 rounded-full ${bucketBg(row.color)}`} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">{row.name}</span>
                            <span className="amount block truncate text-label text-muted">
                              {row.rule}
                              {row.overridden && " · معدَّل"}
                              {row.accountName && ` · ${row.accountName}`}
                            </span>
                          </span>
                          <span className={`amount shrink-0 font-semibold ${row.color === "remainder" ? "text-accent" : ""}`}>
                            {row.off ? "خارج التوزيع" : formatAmount(row.amount)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                <Link href={`/distribute?income=${income.id}`} className="mt-4 inline-block text-label font-semibold text-accent">
                  قائمة التحويلات
                </Link>
              </div>
            </details>
          </li>
        );
      })}
    </ul>
  );
}
