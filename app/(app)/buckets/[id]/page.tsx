import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { bucketBg } from "@/components/bucket-color";
import { formatDate } from "@/lib/dates";
import { formatAmount, formatSigned } from "@/lib/money";
import { createClient } from "@/utils/supabase/server";
import { ui } from "../../settings/data";
import { BucketActions } from "./actions";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const KIND: Record<string, string> = {
  allocation: "توزيع",
  spend: "صرف",
  adjustment: "تعديل رصيد",
  transfer: "تحويل",
  invest: "استثمار",
  return: "عائد استثمار",
};

export default function Page({ params }: PageProps<"/buckets/[id]">) {
  return (
    <>
      <Link href="/" className="text-label font-semibold text-accent">
        › الرئيسية
      </Link>
      <Suspense fallback={<p className="mt-6 text-muted">جارٍ التحميل…</p>}>
        <BucketDetail params={params} />
      </Suspense>
    </>
  );
}

async function BucketDetail({ params }: { params: PageProps<"/buckets/[id]">["params"] }) {
  await connection();
  const { id } = await params;
  const supabase = await createClient();
  const [bucket, balance, entries] = UUID.test(id)
    ? await Promise.all([
        supabase.from("buckets").select("id, name, color, rule_kind, account_id").eq("id", id).maybeSingle(),
        supabase.from("bucket_balances").select("balance").eq("bucket_id", id).maybeSingle(),
        supabase
          .from("entries")
          .select("id, kind, amount, note, occurred_on")
          .eq("bucket_id", id)
          .order("occurred_on", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(200), // ponytail: newest 200 only; add paging when a bucket really has more
      ])
    : [null, null, null];
  const error = bucket?.error ?? balance?.error ?? entries?.error;
  if (error) throw new Error(error.message);

  if (!bucket?.data) {
    return (
      <div className={`${ui.card} mt-6`}>
        <p className="font-medium">لم نجد هذا البند.</p>
        <Link href="/" className={`${ui.primary} mt-4 block text-center`}>
          العودة إلى الرئيسية
        </Link>
      </div>
    );
  }

  const b = bucket.data;
  const current = (balance?.data?.balance as number | undefined) ?? 0;
  const account = await supabase.from("accounts").select("name").eq("id", b.account_id).maybeSingle();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date());
  const list = entries?.data ?? [];

  return (
    <>
      <div className="mt-4 flex items-center gap-2">
        <span aria-hidden className={`size-3 shrink-0 rounded-full ${bucketBg(b.rule_kind === "remainder" ? "remainder" : b.color)}`} />
        <h1 className="min-w-0 truncate text-heading font-bold">{b.name}</h1>
      </div>
      {account.data?.name && <p className="mt-1 text-label text-muted">في {account.data.name}</p>}
      <p className="amount mt-3 text-display font-bold">{formatAmount(current)}</p>

      <BucketActions bucketId={b.id} bucketName={b.name} balance={current} today={today} />

      <h2 className="mt-8 text-heading font-bold">الحركات</h2>
      {list.length === 0 ? (
        <div className={`${ui.card} mt-3`}>
          <p className="font-medium">لا توجد حركات في هذا البند بعد</p>
          <p className="mt-1 text-label text-muted">يمتلئ البند عند توزيع الدخل، وتُسجَّل هنا كل حركة عليه.</p>
          <Link href="/distribute" className={`${ui.primary} mt-4 block text-center`}>
            توزيع دخل
          </Link>
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-hairline overflow-hidden rounded-card border border-hairline bg-surface">
          {list.map((e) => (
            <li key={e.id} className="flex items-center gap-3 p-4">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{e.note || KIND[e.kind] || e.kind}</span>
                <span className="amount block truncate text-label text-muted">
                  {e.note ? `${KIND[e.kind] ?? e.kind} · ` : ""}
                  {formatDate(e.occurred_on)}
                </span>
              </span>
              <span className={`amount shrink-0 font-semibold ${e.amount < 0 ? "" : "text-accent"}`}>
                {formatSigned(e.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
