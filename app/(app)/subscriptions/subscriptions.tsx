"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Sheet } from "@/components/sheet";
import { daysBetween, formatDate } from "@/lib/dates";
import { formatAmount, formatNumber, parseAmount } from "@/lib/money";
import { billingDayOf, cycleLabel, cycleMonths, dueLabel, monthlyEquivalent, totals } from "@/lib/subscriptions";
import { supabaseBrowser } from "@/utils/supabase/client";
import { ui } from "../settings/data";
import { cycleOf, type SubscriptionRow } from "./data";

type BucketOption = { id: string; name: string; active: boolean; accountName: string };

type Draft = {
  id?: string;
  name: string;
  amount: string;
  cycleCount: string;
  cycleUnit: "month" | "year";
  nextDueOn: string;
  bucketId: string;
  note: string;
  paused: boolean;
};

/** What "تراجع" needs to reverse a payment. bucketId is the bucket that was actually charged. */
type Paid = { subscription: SubscriptionRow; bucketId: string; previousDueOn: string; newDueOn: string };

export function Subscriptions({
  subscriptions,
  buckets,
  defaultBucketId,
  today,
}: {
  /** Nearest payment first. */
  subscriptions: SubscriptionRow[];
  buckets: BucketOption[];
  /** From settings: pays any subscription that has no bucket of its own. May be null. */
  defaultBucketId: string | null;
  /** Today's date in Riyadh, "YYYY-MM-DD". */
  today: string;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [paid, setPaid] = useState<Paid | null>(null);
  // "تم الدفع" on a subscription with no bucket and no default: the user must choose one first.
  const [choosing, setChoosing] = useState<{ subscription: SubscriptionRow; bucketId: string; asDefault: boolean } | null>(null);
  // One payment id per subscription and due date: paying the same instalment twice is rejected.
  const paymentIds = useRef(new Map<string, string>());
  const undoId = useRef<string | null>(null);

  const active = subscriptions.filter((s) => !s.paused);
  const pausedOnes = subscriptions.filter((s) => s.paused);
  const total = totals(subscriptions.map((s) => ({ amount: s.amount, cycle: cycleOf(s), paused: s.paused })));
  const original = subscriptions.find((s) => s.id === draft?.id);

  const bucketById = new Map(buckets.map((b) => [b.id, b]));
  /** The bucket a payment comes out of: the subscription's own, otherwise the default. */
  const payingBucket = (ownBucketId: string | null | undefined) => bucketById.get(ownBucketId || defaultBucketId || "");
  const describe = (b: BucketOption) => `بند «${b.name}»${b.accountName ? ` في حساب «${b.accountName}»` : ""}`;

  const openNew = () => {
    setFailure(null);
    setDraft({ name: "", amount: "", cycleCount: "1", cycleUnit: "month", nextDueOn: today, bucketId: "", note: "", paused: false });
  };
  const openEdit = (s: SubscriptionRow) => {
    setFailure(null);
    setDraft({
      id: s.id,
      name: s.name,
      amount: formatNumber(s.amount),
      cycleCount: String(s.cycle_count),
      cycleUnit: s.cycle_unit,
      nextDueOn: s.next_due_on,
      bucketId: s.bucket_id ?? "",
      note: s.note ?? "",
      paused: s.paused,
    });
  };

  const draftAmount = draft ? parseAmount(draft.amount) : null;
  const draftCount = draft && /^\d{1,3}$/.test(draft.cycleCount.trim()) ? Number(draft.cycleCount) : 0;
  const draftValid =
    !!draft && !!draft.name.trim() && !!draftAmount && draftCount >= 1 && draftCount <= 120 && /^\d{4}-\d{2}-\d{2}$/.test(draft.nextDueOn);

  async function save() {
    if (!draft || !draftValid) return;
    setBusy(true);
    setFailure(null);
    const row = {
      name: draft.name.trim(),
      amount: draftAmount,
      cycle_count: draftCount,
      cycle_unit: draft.cycleUnit,
      next_due_on: draft.nextDueOn,
      // The billing day is the day of the date the user picked. If the date was not touched,
      // keep the stored day: a subscription on the 31st that currently sits on 28 Feb is still "the 31st".
      billing_day: original && original.next_due_on === draft.nextDueOn ? original.billing_day : billingDayOf(draft.nextDueOn),
      bucket_id: draft.bucketId || null,
      paused: draft.paused,
      note: draft.note.trim() || null,
    };
    const table = supabaseBrowser().from("subscriptions");
    const { error } = draft.id ? await table.update(row).eq("id", draft.id) : await table.insert(row);
    setBusy(false);
    if (error) return setFailure("تعذّر الحفظ. حاول مرة أخرى.");
    setDraft(null);
    router.refresh();
  }

  async function remove(id: string) {
    setBusy(true);
    const { error } = await supabaseBrowser().from("subscriptions").delete().eq("id", id);
    setBusy(false);
    if (error) return setFailure("تعذّر الحذف. حاول مرة أخرى.");
    setDraft(null);
    router.refresh();
  }

  async function pay(s: SubscriptionRow) {
    const bucket = payingBucket(s.bucket_id);
    // Every payment comes out of a bucket. None set: ask, and change nothing yet.
    if (!bucket) {
      setFailure(null);
      return setChoosing({ subscription: s, bucketId: "", asDefault: false });
    }
    const key = `${s.id}:${s.next_due_on}`;
    const id = paymentIds.current.get(key) ?? crypto.randomUUID();
    paymentIds.current.set(key, id);
    setBusy(true);
    setFailure(null);
    const { data, error } = await supabaseBrowser().rpc("pay_subscription", {
      p_id: id,
      p_subscription_id: s.id,
      p_paid_on: today,
    });
    setBusy(false);
    if (error) {
      // QS001: the database found no bucket to pay from (it changed since this page loaded).
      if (error.code === "QS001") return setChoosing({ subscription: s, bucketId: "", asDefault: false });
      // 23505: this payment id is already recorded, so the earlier tap went through.
      if (error.code !== "23505") setFailure(`تعذّر تسجيل دفع ${s.name}. لم يُخصم شيء ولم يتغيّر الموعد.`);
      return router.refresh();
    }
    undoId.current = null;
    setPaid({ subscription: s, bucketId: bucket.id, previousDueOn: s.next_due_on, newDueOn: data as string });
    router.refresh();
  }

  /** Saves the chosen bucket (on this subscription, or as the default), then pays. */
  async function chooseAndPay() {
    if (!choosing?.bucketId) return;
    const { subscription: s, bucketId, asDefault } = choosing;
    setBusy(true);
    setFailure(null);
    const supabase = supabaseBrowser();
    const { error } = asDefault
      ? await supabase.from("settings").upsert({ default_subscription_bucket_id: bucketId })
      : await supabase.from("subscriptions").update({ bucket_id: bucketId }).eq("id", s.id);
    if (error) {
      setBusy(false);
      return setFailure("تعذّر حفظ البند. لم يُخصم شيء ولم يتغيّر الموعد.");
    }
    const key = `${s.id}:${s.next_due_on}`;
    const id = paymentIds.current.get(key) ?? crypto.randomUUID();
    paymentIds.current.set(key, id);
    const paidResult = await supabase.rpc("pay_subscription", { p_id: id, p_subscription_id: s.id, p_paid_on: today });
    setBusy(false);
    if (paidResult.error && paidResult.error.code !== "23505") {
      setFailure(`حُفظ البند، لكن تعذّر تسجيل دفع ${s.name}. لم يُخصم شيء ولم يتغيّر الموعد. اضغط «تم الدفع» مرة أخرى.`);
      setChoosing(null);
      return router.refresh();
    }
    setChoosing(null);
    undoId.current = null;
    if (!paidResult.error) setPaid({ subscription: s, bucketId, previousDueOn: s.next_due_on, newDueOn: paidResult.data as string });
    router.refresh();
  }

  /** Entries are immutable, so undo adds a correcting adjustment and moves the date back. */
  async function undo(p: Paid) {
    setBusy(true);
    setFailure(null);
    const supabase = supabaseBrowser();
    const s = p.subscription;
    // ponytail: two statements, not one transaction. The money is corrected first; if moving
    // the date back then fails, the message says so and the date can be fixed in the edit sheet.
    {
      const { error } = await supabase.from("entries").insert({
        id: (undoId.current ??= crypto.randomUUID()),
        bucket_id: p.bucketId,
        kind: "adjustment",
        amount: s.amount,
        note: `تراجع عن دفع ${s.name}`,
        occurred_on: today,
      });
      if (error && error.code !== "23505") {
        setBusy(false);
        return setFailure("تعذّر التراجع. لم يتغيّر شيء.");
      }
    }
    const { error } = await supabase.from("subscriptions").update({ next_due_on: p.previousDueOn }).eq("id", s.id);
    setBusy(false);
    setPaid(null);
    if (error) setFailure(`أُعيد المبلغ إلى البند، لكن تعذّر إرجاع موعد ${s.name}. عدّل الموعد يدويًا.`);
    router.refresh();
  }

  const row = (s: SubscriptionRow) => {
    const cycle = cycleOf(s);
    const daysLeft = daysBetween(today, s.next_due_on);
    return (
      <li key={s.id} className={`flex items-stretch ${s.paused ? "dimmed" : ""}`}>
        <button type="button" onClick={() => openEdit(s)} className="min-w-0 flex-1 p-4 text-start">
          <span className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate font-medium">{s.name}</span>
            <span className="amount shrink-0 font-semibold">{formatAmount(s.amount)}</span>
          </span>
          <span className="amount mt-1 flex items-baseline justify-between gap-3 text-label text-muted">
            <span className="min-w-0 truncate">
              {cycleLabel(cycle)} · {formatDate(s.next_due_on)}
            </span>
            {s.paused ? (
              <span className="shrink-0">متوقف</span>
            ) : (
              <span className={`shrink-0 font-medium ${daysLeft < 0 ? "text-danger" : daysLeft <= 7 ? "text-ink" : ""}`}>
                {dueLabel(daysLeft)}
              </span>
            )}
          </span>
          {cycleMonths(cycle) > 1 && (
            <span className="amount mt-1 block text-label text-muted">
              ما يعادل {formatAmount(monthlyEquivalent(s.amount, cycle))} شهريًا
            </span>
          )}
          <span className="mt-1 block truncate text-label text-muted">
            {payingBucket(s.bucket_id)
              ? `يُدفع من ${payingBucket(s.bucket_id)!.name}${s.bucket_id ? "" : " (الافتراضي)"}`
              : "لم يُحدَّد بند للدفع"}
          </span>
        </button>
        {!s.paused && (
          <button
            type="button"
            disabled={busy}
            onClick={() => pay(s)}
            aria-label={`تم دفع ${s.name}`}
            className="my-3 me-3 shrink-0 self-center rounded-control border border-hairline px-3 py-2.5 text-label font-semibold text-accent disabled:opacity-50"
          >
            تم الدفع
          </button>
        )}
      </li>
    );
  };

  return (
    <>
      <dl className="mt-6 grid grid-cols-2 gap-3">
        <div className={ui.card}>
          <dt className="text-label text-muted">شهرياً</dt>
          <dd className="amount mt-1 whitespace-nowrap text-heading font-bold">{formatAmount(total.perMonth)}</dd>
        </div>
        <div className={ui.card}>
          <dt className="text-label text-muted">سنوياً</dt>
          <dd className="amount mt-1 whitespace-nowrap text-heading font-bold">{formatAmount(total.perYear)}</dd>
        </div>
      </dl>

      <div className="mt-6 flex items-center justify-between gap-2">
        <h2 className="text-heading font-bold">القائمة</h2>
        <button type="button" onClick={openNew} className="rounded-control px-3 py-2 text-label font-semibold text-accent">
          + إضافة اشتراك
        </button>
      </div>

      {failure && !draft && !choosing && (
        <p role="alert" className="mt-2 text-label text-danger">
          {failure}
        </p>
      )}

      {subscriptions.length === 0 ? (
        <div className={`${ui.card} mt-3`}>
          <p className="font-medium">لا توجد اشتراكات بعد</p>
          <p className="mt-1 text-label text-muted">
            أضف أول اشتراك: اسمه، مبلغه، دورته (شهري أو سنوي أو كل عدة أشهر)، وموعد الدفع القادم. نحسب لك كلفته الشهرية
            والسنوية ونذكّرك بالموعد هنا وفي الرئيسية.
          </p>
          <button type="button" onClick={openNew} className={`${ui.primary} mt-4 w-full`}>
            إضافة أول اشتراك
          </button>
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-hairline overflow-hidden rounded-card border border-hairline bg-surface">
          {active.map(row)}
          {pausedOnes.map(row)}
        </ul>
      )}

      {/* Toast: sits above the mobile tab bar. It stays until dismissed, so there is no race to undo. */}
      {paid && (
        <div
          role="status"
          className="fixed inset-x-4 bottom-24 z-20 mx-auto flex max-w-md items-center gap-3 rounded-card border border-hairline bg-surface p-3 ps-4 shadow-lg md:bottom-6"
        >
          <p className="amount min-w-0 flex-1 text-label">
            تم دفع {paid.subscription.name} من {bucketById.get(paid.bucketId) ? describe(bucketById.get(paid.bucketId)!) : "البند"}. الموعد القادم:{" "}
            {formatDate(paid.newDueOn)}
          </p>
          <button type="button" disabled={busy} onClick={() => undo(paid)} className="shrink-0 px-2 py-2 text-label font-semibold text-accent">
            تراجع
          </button>
          <button type="button" onClick={() => setPaid(null)} aria-label="إغلاق" className="grid size-9 shrink-0 place-items-center text-heading text-muted">
            ×
          </button>
        </div>
      )}

      <Sheet open={choosing !== null} onClose={() => setChoosing(null)} title="من أي بند يُدفع؟">
        {choosing && (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              chooseAndPay();
            }}
          >
            <p className="amount text-label text-muted">
              {choosing.subscription.name} · {formatAmount(choosing.subscription.amount)}. لم يُحدَّد له بند، ولا يوجد بند افتراضي
              للاشتراكات. كل دفعة تُخصم من بند، فلم يُسجَّل شيء بعد.
            </p>
            <label className={ui.label}>
              البند
              <select
                value={choosing.bucketId}
                required
                autoFocus
                onChange={(e) => setChoosing({ ...choosing, bucketId: e.target.value })}
                className={`${ui.field} mt-1.5`}
              >
                <option value="" disabled>
                  اختر بندًا
                </option>
                {buckets
                  .filter((b) => b.active)
                  .map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                      {b.accountName ? ` · ${b.accountName}` : ""}
                    </option>
                  ))}
              </select>
            </label>
            <label className="flex items-center justify-between gap-3 py-1 font-medium">
              اجعله البند الافتراضي لكل الاشتراكات
              <input
                type="checkbox"
                role="switch"
                checked={choosing.asDefault}
                onChange={(e) => setChoosing({ ...choosing, asDefault: e.target.checked })}
                className="switch"
              />
            </label>
            <p className="-mt-2 text-label text-muted">
              {choosing.asDefault
                ? "يُحفظ في الإعدادات ويُستخدم لكل اشتراك بلا بند."
                : "يُحفظ على هذا الاشتراك فقط."}
            </p>
            {buckets.every((b) => !b.active) && (
              <p role="alert" className="text-label text-danger">
                لا توجد بنود بعد. أضف بنودك من الإعدادات أولًا.
              </p>
            )}
            {failure && (
              <p role="alert" className="text-label text-danger">
                {failure}
              </p>
            )}
            <button disabled={busy || !choosing.bucketId} className={ui.primary}>
              حفظ ودفع {formatAmount(choosing.subscription.amount)}
            </button>
          </form>
        )}
      </Sheet>

      <Sheet open={draft !== null} onClose={() => setDraft(null)} title={draft?.id ? "تعديل الاشتراك" : "اشتراك جديد"}>
        {draft && (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <label className={ui.label}>
              الاسم
              <input
                value={draft.name}
                required
                maxLength={60}
                autoFocus={!draft.id}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className={`${ui.field} mt-1.5`}
              />
            </label>
            <label className={ui.label}>
              المبلغ
              <span className="relative mt-1.5 block">
                <input
                  value={draft.amount}
                  inputMode="decimal"
                  dir="ltr"
                  autoComplete="off"
                  aria-invalid={draft.amount.trim() !== "" && !draftAmount}
                  onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
                  className={`${ui.field} amount pe-14 text-end`}
                />
                <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-muted">ر.س</span>
              </span>
            </label>
            <fieldset>
              <legend className={ui.label}>يتكرر كل</legend>
              <div className="mt-1.5 grid grid-cols-[5rem_1fr] gap-2">
                <input
                  value={draft.cycleCount}
                  inputMode="numeric"
                  dir="ltr"
                  aria-label="عدد"
                  aria-invalid={draftCount < 1 || draftCount > 120}
                  onChange={(e) => setDraft({ ...draft, cycleCount: e.target.value })}
                  className={`${ui.field} amount text-center`}
                />
                <select
                  value={draft.cycleUnit}
                  aria-label="الوحدة"
                  onChange={(e) => setDraft({ ...draft, cycleUnit: e.target.value as "month" | "year" })}
                  className={ui.field}
                >
                  <option value="month">شهر</option>
                  <option value="year">سنة</option>
                </select>
              </div>
              <p className="amount mt-1.5 min-h-5 text-label text-muted">
                {draftCount >= 1 && draftCount <= 120
                  ? `${cycleLabel({ count: draftCount, unit: draft.cycleUnit })}${
                      draftAmount && draftCount * (draft.cycleUnit === "year" ? 12 : 1) > 1
                        ? ` · ما يعادل ${formatAmount(monthlyEquivalent(draftAmount, { count: draftCount, unit: draft.cycleUnit }))} شهريًا`
                        : ""
                    }`
                  : "أدخل عددًا بين 1 و 120."}
              </p>
            </fieldset>
            <label className={ui.label}>
              موعد الدفع القادم
              <input
                type="date"
                required
                value={draft.nextDueOn}
                onChange={(e) => setDraft({ ...draft, nextDueOn: e.target.value })}
                className={`${ui.field} amount mt-1.5`}
              />
            </label>
            <label className={ui.label}>
              يُدفع من بند
              <select
                value={draft.bucketId}
                aria-describedby="pays-from"
                onChange={(e) => setDraft({ ...draft, bucketId: e.target.value })}
                className={`${ui.field} mt-1.5`}
              >
                <option value="">البند الافتراضي للاشتراكات</option>
                {buckets
                  .filter((b) => b.active || b.id === draft.bucketId)
                  .map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
              </select>
            </label>
            {/* Never ambiguous: exactly where the money will come from. */}
            <p id="pays-from" aria-live="polite" className={`-mt-2 text-label ${payingBucket(draft.bucketId) ? "text-muted" : "font-medium text-danger"}`}>
              {payingBucket(draft.bucketId)
                ? `عند «تم الدفع» يُخصم المبلغ من ${describe(payingBucket(draft.bucketId)!)}${draft.bucketId ? "." : " (البند الافتراضي)."}`
                : "لا يوجد بند افتراضي بعد. اختر بندًا هنا، أو سنطلب منك اختياره عند «تم الدفع». لا تُسجَّل أي دفعة بلا بند."}
            </p>
            <label className={ui.label}>
              ملاحظة (اختياري)
              <input
                value={draft.note}
                maxLength={200}
                onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                className={`${ui.field} mt-1.5`}
              />
            </label>
            <label className="flex items-center justify-between gap-3 py-1 font-medium">
              إيقاف مؤقت
              <input
                type="checkbox"
                role="switch"
                checked={draft.paused}
                onChange={(e) => setDraft({ ...draft, paused: e.target.checked })}
                className="switch"
              />
            </label>
            {failure && (
              <p role="alert" className="text-label text-danger">
                {failure}
              </p>
            )}
            <button disabled={busy || !draftValid} className={ui.primary}>
              حفظ
            </button>
            {draft.id && (
              <button type="button" disabled={busy} onClick={() => remove(draft.id!)} className="py-2 text-label font-medium text-danger">
                حذف الاشتراك
              </button>
            )}
          </form>
        )}
      </Sheet>
    </>
  );
}
