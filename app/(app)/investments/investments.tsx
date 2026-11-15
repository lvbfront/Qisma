"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Sheet } from "@/components/sheet";
import { SplitBar } from "@/components/split-bar";
import { amountToPercent } from "@/lib/allocate";
import { daysBetween, daysLabel, formatDate } from "@/lib/dates";
import { groupByPlatform } from "@/lib/investments";
import { formatAmount, formatPercent, formatSigned, parseAmount } from "@/lib/money";
import { dueLabel } from "@/lib/subscriptions";
import { supabaseBrowser } from "@/utils/supabase/client";
import { ui } from "../settings/data";
import type { InvestmentsData, Position } from "./data";

// The app only records what was paid in and what came back.
// No market prices, no advice, no ranking of platforms.

type Mode =
  | { kind: "new" }
  | { kind: "receive"; position: Position }
  /** After a return was saved: "is this investment finished?" */
  | { kind: "finished?"; position: Position; returned: number; on: string }
  | { kind: "close"; position: Position };

const blankForm = (today: string) => ({ platform: "", title: "", amount: "", date: today, expectedOn: "", expectedProfit: "" });

const titleOf = (p: Position) => p.title || "استثمار بلا عنوان";

/** "+8%" / "-100%" of the amount invested. */
const percentOf = (result: number, invested: number) => formatPercent(amountToPercent(result, invested), true);

export function Investments({ data, today }: { data: InvestmentsData; today: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode | null>(null);
  const [form, setForm] = useState(blankForm(today));
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  // One id per opened form: a repeated submit is rejected by the database.
  const requestId = useRef<string | null>(null);

  const { summary } = data;
  const open = data.positions.filter((p) => p.status === "open");
  const closed = data.positions.filter((p) => p.status === "closed");
  const groups = groupByPlatform(open);
  const platforms = [...new Set(data.positions.map((p) => p.platform))].sort((a, b) => a.localeCompare(b, "ar"));

  const start = (next: Mode) => {
    requestId.current = null;
    setForm(blankForm(today));
    setFailure(null);
    setMode(next);
  };
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const amount = form.amount.trim() === "" ? null : parseAmount(form.amount);
  const expectedProfit = form.expectedProfit.trim() === "" ? null : parseAmount(form.expectedProfit);
  const overAvailable = mode?.kind === "new" && !!amount && amount > summary.available;
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(form.date);

  /** Runs one database function; returns true on success. */
  async function call(fn: string, args: Record<string, unknown>, message: string) {
    setBusy(true);
    setFailure(null);
    const { error } = await supabaseBrowser().rpc(fn, args);
    setBusy(false);
    // 23505: this id is already recorded, so an earlier submit did go through.
    if (error && error.code !== "23505") {
      setFailure(message);
      return false;
    }
    router.refresh();
    return true;
  }

  async function openInvestment() {
    if (!amount || overAvailable || !form.platform.trim() || !validDate) return;
    const ok = await call(
      "open_investment",
      {
        p_id: (requestId.current ??= crypto.randomUUID()),
        p_platform: form.platform,
        p_title: form.title,
        p_amount: amount,
        p_invested_on: form.date,
        p_expected_return_on: form.expectedOn || null,
        p_expected_profit: expectedProfit,
      },
      "تعذّر تسجيل الاستثمار. لم يُسجَّل شيء. تأكد أن المبلغ لا يتجاوز المتاح.",
    );
    if (ok) setMode(null);
  }

  async function receive(position: Position) {
    if (!amount || !validDate) return;
    const ok = await call(
      "record_investment_return",
      {
        p_id: (requestId.current ??= crypto.randomUUID()),
        p_investment_id: position.id,
        p_amount: amount,
        p_returned_on: form.date,
        p_note: null,
      },
      "تعذّر تسجيل المبلغ. لم يُسجَّل شيء.",
    );
    if (ok) setMode({ kind: "finished?", position, returned: position.returned + amount, on: form.date });
  }

  async function close(position: Position, on: string) {
    const ok = await call("close_investment", { p_investment_id: position.id, p_closed_on: on }, "تعذّر إغلاق الاستثمار.");
    if (ok) setMode(null);
  }

  if (!data.hasInvestmentBucket && data.positions.length === 0) {
    return (
      <div className={`${ui.card} mt-6`}>
        <p className="font-medium">حدّد بند الاستثمار أولًا</p>
        <p className="mt-1 text-label text-muted">
          افتح أحد بنودك في الإعدادات وفعّل «هذا بند الاستثمار». رصيد ذلك البند يصبح «المتاح» هنا، ومنه تضع المال في
          منصاتك وتتابع ما عاد منه.
        </p>
        <Link href="/settings" className={`${ui.primary} mt-4 block text-center`}>
          الذهاب إلى إعدادات البنود
        </Link>
      </div>
    );
  }

  const amountField = (label: string, value: string, onChange: (v: string) => void, autoFocus = false) => (
    <label className={ui.label}>
      {label}
      <span className="relative mt-1.5 block">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          inputMode="decimal"
          autoComplete="off"
          autoFocus={autoFocus}
          dir="ltr"
          aria-invalid={value.trim() !== "" && !parseAmount(value)}
          className={`${ui.field} amount pe-14 text-end`}
        />
        <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-muted">ر.س</span>
      </span>
    </label>
  );
  const dateField = (label: string, value: string, onChange: (v: string) => void, max?: string) => (
    <label className={ui.label}>
      {label}
      <input type="date" value={value} max={max} onChange={(e) => onChange(e.target.value)} className={`${ui.field} amount mt-1.5`} />
    </label>
  );
  const figure = (label: string, value: string, tone = "") => (
    <div className="min-w-0">
      <dt className="text-label text-muted">{label}</dt>
      <dd className={`amount mt-1 whitespace-nowrap font-bold ${tone}`}>{value}</dd>
    </div>
  );
  const failureLine = failure && (
    <p role="alert" className="text-label text-danger">
      {failure}
    </p>
  );

  return (
    <>
      <section aria-label="ملخص الاستثمار" className={`${ui.card} mt-6`}>
        <dl className="grid grid-cols-3 gap-3">
          {figure("المتاح", formatAmount(summary.available))}
          {figure("مستثمر حالياً", formatAmount(summary.invested))}
          {figure("الربح المحقق", formatSigned(summary.realisedProfit), summary.realisedProfit < 0 ? "text-danger" : "")}
        </dl>
        <div className="mt-4">
          <SplitBar
            thin
            segments={[
              { id: "available", label: "المتاح", amount: Math.max(summary.available, 0), color: "remainder" },
              { id: "invested", label: "مستثمر حالياً", amount: summary.invested, color: "muted" },
            ]}
          />
        </div>
      </section>

      <button
        type="button"
        disabled={!data.hasInvestmentBucket}
        onClick={() => start({ kind: "new" })}
        className={`${ui.primary} mt-4 w-full`}
      >
        استثمار جديد
      </button>
      {!data.hasInvestmentBucket && (
        <p className="mt-2 text-label text-muted">
          لا يوجد بند استثمار نشط الآن.{" "}
          <Link href="/settings" className="font-semibold text-accent">
            حدّده من الإعدادات
          </Link>
        </p>
      )}

      <h2 className="mt-8 text-heading font-bold">الاستثمارات القائمة</h2>
      {open.length === 0 ? (
        <div className={`${ui.card} mt-3`}>
          <p className="font-medium">لا توجد استثمارات قائمة</p>
          <p className="mt-1 text-label text-muted">
            {summary.available > 0
              ? "عندما تضع مبلغًا في إحدى المنصات سجّله من «استثمار جديد» لتعرف دائمًا أين مالك."
              : "المتاح صفر الآن. يمتلئ بند الاستثمار عند توزيع الدخل، ثم تسجّل منه استثماراتك."}
          </p>
          {summary.available <= 0 && (
            <Link href="/distribute" className={`${ui.secondary} mt-4 block text-center`}>
              توزيع دخل
            </Link>
          )}
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.platform} aria-label={group.platform} className="mt-4">
            <div className="flex items-baseline justify-between gap-3 px-1">
              <h3 className="min-w-0 truncate font-semibold">{group.platform}</h3>
              <span className="amount shrink-0 text-label text-muted">القائم {formatAmount(group.subtotal)}</span>
            </div>
            <ul className="mt-2 divide-y divide-hairline overflow-hidden rounded-card border border-hairline bg-surface">
              {group.items.map((p) => {
                const daysLeft = p.expectedReturnOn ? daysBetween(today, p.expectedReturnOn) : null;
                return (
                  <li key={p.id} className="p-4">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 truncate font-medium">{titleOf(p)}</span>
                      <span className="amount shrink-0 font-semibold">{formatAmount(p.invested)}</span>
                    </div>
                    <p className="amount mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-label text-muted">
                      {daysLeft === null ? (
                        <span>بلا موعد متوقع</span>
                      ) : (
                        <>
                          <span>
                            العودة المتوقعة {formatDate(p.expectedReturnOn!)} · {dueLabel(daysLeft)}
                          </span>
                          {daysLeft < 0 && (
                            <span className="rounded-full border border-danger px-2 py-0.5 font-semibold text-danger">متأخر</span>
                          )}
                        </>
                      )}
                    </p>
                    {(p.returned > 0 || p.expectedProfit) && (
                      <p className="amount mt-1 text-label text-muted">
                        {p.returned > 0 && `عاد منه ${formatAmount(p.returned)}`}
                        {p.returned > 0 && p.expectedProfit ? " · " : ""}
                        {p.expectedProfit ? `ربح متوقع ${formatAmount(p.expectedProfit)}` : ""}
                      </p>
                    )}
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => start({ kind: "receive", position: p })} className={`${ui.secondary} py-2.5 text-label font-semibold text-accent`}>
                        استلمت مبلغ
                      </button>
                      <button type="button" onClick={() => start({ kind: "close", position: p })} className={`${ui.secondary} py-2.5 text-label`}>
                        إغلاق
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}

      {closed.length > 0 && (
        <details className="group mt-8 rounded-card border border-hairline bg-surface">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 font-semibold [&::-webkit-details-marker]:hidden">
            <span className="amount">الاستثمارات المغلقة ({closed.length})</span>
            <span aria-hidden className="text-muted transition-transform group-open:-rotate-90">
              ‹
            </span>
          </summary>
          <ul className="divide-y divide-hairline border-t border-hairline">
            {closed.map((p) => {
              const result = p.result ?? 0;
              return (
                <li key={p.id} className="p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate font-medium">
                      {titleOf(p)} <span className="font-normal text-muted">· {p.platform}</span>
                    </span>
                    <span className={`amount shrink-0 font-semibold ${result < 0 ? "text-danger" : ""}`}>
                      {formatSigned(result)} <span className="font-normal">({percentOf(result, p.invested)})</span>
                    </span>
                  </div>
                  <p className="amount mt-1 text-label text-muted">
                    استُثمر {formatAmount(p.invested)} · عاد {formatAmount(p.returned)} · المدة{" "}
                    {daysLabel(daysBetween(p.investedOn, p.closedOn ?? p.investedOn))}
                  </p>
                </li>
              );
            })}
          </ul>
        </details>
      )}

      <Sheet
        open={mode !== null}
        onClose={() => setMode(null)}
        title={
          mode?.kind === "new"
            ? "استثمار جديد"
            : mode?.kind === "receive"
              ? "استلمت مبلغ"
              : mode?.kind === "finished?"
                ? "هل انتهى هذا الاستثمار؟"
                : "إغلاق الاستثمار"
        }
      >
        {mode?.kind === "new" && (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              openInvestment();
            }}
          >
            <label className={ui.label}>
              المنصة
              <input
                value={form.platform}
                onChange={(e) => set({ platform: e.target.value })}
                list="platforms"
                required
                maxLength={60}
                autoFocus
                autoComplete="off"
                className={`${ui.field} mt-1.5`}
              />
              {/* Suggestions: platforms already used, in alphabetical order. */}
              <datalist id="platforms">
                {platforms.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </label>
            <label className={ui.label}>
              العنوان أو ملاحظة (اختياري)
              <input value={form.title} onChange={(e) => set({ title: e.target.value })} maxLength={200} className={`${ui.field} mt-1.5`} />
            </label>
            {amountField("المبلغ", form.amount, (v) => set({ amount: v }))}
            <p aria-live="polite" className={`amount -mt-2 text-label ${overAvailable ? "font-medium text-danger" : "text-muted"}`}>
              {overAvailable
                ? `المبلغ أكبر من المتاح. المتاح ${formatAmount(summary.available)} فقط.`
                : `المتاح ${formatAmount(summary.available)}`}
            </p>
            {dateField("تاريخ الاستثمار", form.date, (v) => set({ date: v }), today)}
            {dateField("تاريخ العودة المتوقع (اختياري)", form.expectedOn, (v) => set({ expectedOn: v }))}
            {amountField("الربح المتوقع (اختياري)", form.expectedProfit, (v) => set({ expectedProfit: v }))}
            {failureLine}
            <button
              disabled={busy || !amount || overAvailable || !form.platform.trim() || !validDate || (form.expectedProfit.trim() !== "" && expectedProfit === null)}
              className={ui.primary}
            >
              تسجيل الاستثمار
            </button>
          </form>
        )}

        {mode?.kind === "receive" && (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              receive(mode.position);
            }}
          >
            <p className="amount text-label text-muted">
              {titleOf(mode.position)} · {mode.position.platform} · استُثمر {formatAmount(mode.position.invested)}
              {mode.position.returned > 0 && ` · عاد منه ${formatAmount(mode.position.returned)}`}
            </p>
            {amountField("المبلغ المستلم", form.amount, (v) => set({ amount: v }), true)}
            {dateField("تاريخ الاستلام", form.date, (v) => set({ date: v }), today)}
            <p className="text-label text-muted">يُضاف المبلغ إلى بند الاستثمار ويصبح جزءًا من «المتاح».</p>
            {failureLine}
            <button disabled={busy || !amount || !validDate} className={ui.primary}>
              تسجيل المبلغ
            </button>
          </form>
        )}

        {(mode?.kind === "finished?" || mode?.kind === "close") &&
          (() => {
            const p = mode.position;
            const returned = mode.kind === "finished?" ? mode.returned : p.returned;
            const result = returned - p.invested;
            const on = mode.kind === "finished?" ? mode.on : today;
            return (
              <div className="flex flex-col gap-4">
                {mode.kind === "finished?" && <p className="text-label text-muted">سُجِّل المبلغ. إن لم يبقَ شيء سيعود من هذا الاستثمار فأغلقه لتثبيت نتيجته.</p>}
                <dl className="grid grid-cols-3 gap-3 rounded-card border border-hairline bg-bg p-3">
                  {figure("استُثمر", formatAmount(p.invested))}
                  {figure("عاد", formatAmount(returned))}
                  {figure(result < 0 ? "خسارة" : "ربح", formatSigned(result), result < 0 ? "text-danger" : "")}
                </dl>
                <p className="amount text-label text-muted">
                  {titleOf(p)} · {p.platform}.{" "}
                  {returned === 0
                    ? "لم يعد أي مبلغ: الإغلاق يسجّل كامل المبلغ خسارة."
                    : "بعد الإغلاق تُثبَّت النتيجة ولا يُسجَّل على هذا الاستثمار أي مبلغ آخر."}
                </p>
                {failureLine}
                <button type="button" disabled={busy} onClick={() => close(p, on)} className={ui.primary}>
                  {mode.kind === "finished?" ? "نعم، أغلقه" : "تأكيد الإغلاق"}
                </button>
                <button type="button" disabled={busy} onClick={() => setMode(null)} className={ui.secondary}>
                  {mode.kind === "finished?" ? "لا، ما زال قائمًا" : "تراجع"}
                </button>
              </div>
            );
          })()}
      </Sheet>
    </>
  );
}
