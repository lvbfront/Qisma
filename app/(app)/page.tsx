import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { bucketBg } from "@/components/bucket-color";
import { SplitBar } from "@/components/split-bar";
import { addDays, daysBetween, formatDate } from "@/lib/dates";
import { formatAmount, formatSigned } from "@/lib/money";
import { dueLabel } from "@/lib/subscriptions";
import { createClient } from "@/utils/supabase/server";
import { loadPending } from "./distribute/data";
import { snapshotRows, snapshotSegments } from "./history/snapshot";
import { ui } from "./settings/data";
import { todayInRiyadh } from "./subscriptions/data";

export default function Page() {
  return (
    <>
      <h1 className="text-title font-bold">الرئيسية</h1>
      <Suspense fallback={<p className="mt-6 text-muted">جارٍ التحميل…</p>}>
        <Home />
      </Suspense>
    </>
  );
}

const heading = "text-heading font-bold";

/** An empty state: what is missing and the one next action. */
function NextStep({ title, text, href, action }: { title: string; text: string; href: string; action: string }) {
  return (
    <div className={`${ui.card} mt-6`}>
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-label text-muted">{text}</p>
      <Link href={href} className={`${ui.primary} mt-4 block text-center`}>
        {action}
      </Link>
    </div>
  );
}

async function Home() {
  await connection();
  const supabase = await createClient();
  const today = todayInRiyadh();
  const [accounts, accountBalances, buckets, bucketBalances, lastIncome, pending, due, investSummary, nextReturn] = await Promise.all([
    supabase.from("accounts").select("id, name").order("sort_order").order("created_at"),
    supabase.from("account_balances").select("account_id, balance"),
    supabase.from("buckets").select("id, name, color, rule_kind, active, is_investment").order("priority").order("created_at"),
    supabase.from("bucket_balances").select("bucket_id, balance"),
    supabase
      .from("incomes")
      .select("id, received_on, amount, snapshot")
      .order("received_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    loadPending(supabase),
    // Subscriptions due within 7 days, plus anything overdue.
    supabase
      .from("subscriptions")
      .select("id, name, amount, next_due_on")
      .eq("paused", false)
      .lte("next_due_on", addDays(today, 7))
      .order("next_due_on"),
    supabase.from("investment_summary").select("available, currently_invested, realised_profit").maybeSingle(),
    // The soonest expected return among open investments (may already be overdue).
    supabase
      .from("investment_positions")
      .select("expected_return_on")
      .eq("status", "open")
      .not("expected_return_on", "is", null)
      .order("expected_return_on")
      .limit(1)
      .maybeSingle(),
  ]);
  const error =
    accounts.error ??
    accountBalances.error ??
    buckets.error ??
    bucketBalances.error ??
    lastIncome.error ??
    due.error ??
    investSummary.error ??
    nextReturn.error;
  if (error) throw new Error(error.message);

  // Balances are never stored: they come from the views.
  const accountBalance = new Map(accountBalances.data!.map((b) => [b.account_id, b.balance as number]));
  const bucketBalance = new Map(bucketBalances.data!.map((b) => [b.bucket_id, b.balance as number]));
  // Paused buckets stay visible while they still hold money.
  const shownBuckets = buckets.data!.filter((b) => b.active || bucketBalance.get(b.id));
  const invest = investSummary.data;
  // Show the investments card once there is an investment bucket or any investment history.
  const showInvest =
    buckets.data!.some((b) => b.is_investment && b.active) || !!invest?.currently_invested || !!invest?.realised_profit;
  const nextReturnOn = nextReturn.data?.expected_return_on as string | undefined;
  const last = lastIncome.data;
  const lastRows = last ? snapshotRows(last.snapshot) : [];

  if (accounts.data!.length === 0) {
    return (
      <NextStep
        title="أهلًا بك في قِسمة"
        text="ابدأ بإنشاء حساباتك: الحساب الذي ينزل فيه الراتب، وحساب الادخار."
        href="/settings"
        action="إعداد الحسابات"
      />
    );
  }

  return (
    <>
      {/* 1. Accounts: the first thing the user sees. Scrolls sideways inside itself on small screens. */}
      <section aria-labelledby="accounts-title" className="mt-6">
        <h2 id="accounts-title" className="sr-only">
          الحسابات
        </h2>
        <ul className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
          {accounts.data!.map((a) => (
            <li key={a.id} className="min-w-40 flex-1 rounded-card border border-hairline bg-surface p-4">
              <span className="block truncate text-label text-muted">{a.name}</span>
              <span className="amount mt-1 block whitespace-nowrap text-heading font-bold">
                {formatAmount(accountBalance.get(a.id) ?? 0)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* 2. Pending transfers: only while a checklist is unfinished. */}
      {pending.length > 0 && (
        <section aria-labelledby="pending-title" className="mt-6">
          <h2 id="pending-title" className={heading}>
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
                      من توزيع {formatAmount(p.amount)} بتاريخ {formatDate(p.receivedOn)} ·{" "}
                      {p.accounts === 1 ? "حساب واحد" : `${p.accounts} حسابات`}
                    </span>
                  </span>
                  <span className="shrink-0 text-label font-semibold text-accent">متابعة</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {buckets.data!.length === 0 ? (
        <NextStep
          title="الخطوة التالية: البنود"
          text="أضف بنودك وحدّد قاعدة كل بند، واجعل واحدًا منها «الباقي»."
          href="/settings"
          action="إعداد البنود"
        />
      ) : (
        <>
          {/* 3. Last distribution. */}
          {last ? (
            <section aria-labelledby="last-title" className="mt-8">
              <div className="flex items-baseline justify-between gap-3">
                <h2 id="last-title" className={heading}>
                  آخر توزيع
                </h2>
                <Link href="/history" className="text-label font-semibold text-accent">
                  السجل
                </Link>
              </div>
              <div className={`${ui.card} mt-3`}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="amount text-heading font-bold">{formatAmount(last.amount)}</span>
                  <span className="amount text-label text-muted">{formatDate(last.received_on)}</span>
                </div>
                <div className="mt-3">
                  <SplitBar segments={snapshotSegments(lastRows)} />
                </div>
              </div>
            </section>
          ) : (
            <NextStep
              title="كل شيء جاهز للتوزيع"
              text="عند نزول الراتب أدخل المبلغ، وسنقسّمه على بنودك ونعرض لك التحويلات."
              href="/distribute"
              action="توزيع أول دخل"
            />
          )}

          {/* 4. Buckets. */}
          <section aria-labelledby="buckets-title" className="mt-8">
            <h2 id="buckets-title" className={heading}>
              البنود
            </h2>
            <ul className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
              {shownBuckets.map((b) => (
                <li key={b.id}>
                  <Link
                    href={`/buckets/${b.id}`}
                    className={`block rounded-card border border-hairline bg-surface p-4 ${b.active ? "" : "dimmed"}`}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className={`size-3 shrink-0 rounded-full ${bucketBg(b.rule_kind === "remainder" ? "remainder" : b.color)}`}
                      />
                      <span className="min-w-0 flex-1 truncate text-label text-muted">{b.name}</span>
                    </span>
                    <span className="amount mt-1 block whitespace-nowrap font-bold">{formatAmount(bucketBalance.get(b.id) ?? 0)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      {/* 5a. Upcoming subscriptions: due within 7 days or overdue. Hidden when there are none. */}
      {due.data!.length > 0 && (
        <section aria-labelledby="due-title" className="mt-8">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="due-title" className={heading}>
              الاشتراكات القادمة
            </h2>
            <Link href="/subscriptions" className="text-label font-semibold text-accent">
              الكل
            </Link>
          </div>
          <ul className="mt-3 divide-y divide-hairline overflow-hidden rounded-card border border-hairline bg-surface">
            {due.data!.map((s) => {
              const daysLeft = daysBetween(today, s.next_due_on);
              return (
                <li key={s.id}>
                  <Link href="/subscriptions" className="flex items-center gap-3 p-4">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{s.name}</span>
                      <span className={`amount block text-label ${daysLeft < 0 ? "font-medium text-danger" : "text-muted"}`}>
                        {dueLabel(daysLeft)} · {formatDate(s.next_due_on)}
                      </span>
                    </span>
                    <span className="amount shrink-0 font-semibold">{formatAmount(s.amount)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* 5b. Investments summary: cost basis only. Hidden until an investment bucket exists. */}
      {showInvest && (
        <section aria-labelledby="invest-title" className="mt-8">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="invest-title" className={heading}>
              ملخص الاستثمار
            </h2>
            <Link href="/investments" className="text-label font-semibold text-accent">
              التفاصيل
            </Link>
          </div>
          <Link href="/investments" className={`${ui.card} mt-3 block`}>
            <dl className="grid grid-cols-3 gap-3">
              <div className="min-w-0">
                <dt className="text-label text-muted">المتاح</dt>
                <dd className="amount mt-1 whitespace-nowrap font-bold">{formatAmount(invest?.available ?? 0)}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-label text-muted">مستثمر حالياً</dt>
                <dd className="amount mt-1 whitespace-nowrap font-bold">{formatAmount(invest?.currently_invested ?? 0)}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-label text-muted">الربح المحقق</dt>
                <dd className={`amount mt-1 whitespace-nowrap font-bold ${(invest?.realised_profit ?? 0) < 0 ? "text-danger" : ""}`}>
                  {formatSigned(invest?.realised_profit ?? 0)}
                </dd>
              </div>
            </dl>
            <p className={`amount mt-3 text-label ${nextReturnOn && nextReturnOn < today ? "font-medium text-danger" : "text-muted"}`}>
              {nextReturnOn
                ? `أقرب عودة متوقعة: ${formatDate(nextReturnOn)} · ${dueLabel(daysBetween(today, nextReturnOn))}`
                : "لا توجد عودة متوقعة مسجّلة."}
            </p>
          </Link>
        </section>
      )}
    </>
  );
}
