"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useState } from "react";
import { Sheet } from "@/components/sheet";
import { SortableList } from "@/components/sortable";
import { bucketBg } from "@/components/bucket-color";
import { amountToPercent, percentToAmount, type RuleKind } from "@/lib/allocate";
import { formatAmount, formatNumber, formatPercent, parseAmount } from "@/lib/money";
import { monthlyEquivalent } from "@/lib/subscriptions";
import { previewSplit, ui, type Account, type Bucket, type LinkedSubscription } from "./data";
import { Preview } from "./preview";
import { useWrites } from "./use-writes";

const RULES: [RuleKind, string][] = [
  ["fixed", "مبلغ ثابت"],
  ["percent", "نسبة"],
  ["remainder", "الباقي"],
];

const COLOR_NAMES = ["أزرق", "أصفر داكن", "بنفسجي", "طوبي", "رمادي", "وردي", "زيتوني", "نيلي"];

// Suggested first buckets. Values are left empty on purpose.
const STARTER: [string, RuleKind][] = [
  ["الإيجار", "fixed"],
  ["القسط", "fixed"],
  ["الاستثمار", "percent"],
  ["الصدقة", "percent"],
  ["الإخوان", "percent"],
  ["السفر", "percent"],
  ["المعيشة", "remainder"],
];

type Draft = {
  id?: string;
  name: string;
  color: number;
  account_id: string;
  rule_kind: RuleKind;
  /** What the user typed: SAR for fixed, percent for percent. Empty = not set yet. */
  value: string;
  is_investment: boolean;
  active: boolean;
};

/** Typed value -> halalas (fixed) or basis points (percent). null if not a valid number. */
function ruleValue(d: Draft): number | null {
  if (d.rule_kind === "remainder" || d.value.trim() === "") return 0;
  const n = parseAmount(d.value); // "12.5" -> 1250: halalas and basis points share the x100 scale
  return n !== null && d.rule_kind === "percent" && n > 10_000 ? null : n;
}

const shortfallOf = (buckets: Bucket[], referenceIncome: number) => {
  const split = previewSplit(buckets, referenceIncome);
  return !split.ok && split.error.code === "shortfall" ? split.error.missing : 0;
};

const ruleSummary = (b: Bucket) =>
  b.rule_kind === "remainder"
    ? "الباقي"
    : !b.rule_value
      ? "لم تُحدَّد القيمة"
      : b.rule_kind === "fixed"
        ? formatAmount(b.rule_value)
        : formatPercent(b.rule_value);

export function Buckets({
  buckets,
  setBuckets,
  accounts,
  subscriptions,
  referenceIncome,
  livingFloor,
  supabase,
  reload,
}: {
  buckets: Bucket[];
  setBuckets: (buckets: Bucket[]) => void;
  accounts: Account[];
  subscriptions: LinkedSubscription[];
  referenceIncome: number;
  livingFloor: number;
  supabase: () => SupabaseClient;
  reload: () => Promise<void>;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const { run, busy, error, setError } = useWrites(reload);

  const defaultAccount = (accounts.find((a) => a.receives_income) ?? accounts[0])?.id ?? "";
  const accountName = (id: string) => accounts.find((a) => a.id === id)?.name ?? "";

  const open = (d: Draft) => {
    setError(null);
    setDraft(d);
  };
  const openNew = () =>
    open({
      name: "",
      color: (buckets.length % 8) + 1,
      account_id: defaultAccount,
      rule_kind: "fixed",
      value: "",
      is_investment: false,
      active: true,
    });
  const openEdit = (b: Bucket) =>
    open({
      id: b.id,
      name: b.name,
      color: b.color,
      account_id: b.account_id,
      rule_kind: b.rule_kind,
      value: !b.rule_value ? "" : b.rule_kind === "fixed" ? formatNumber(b.rule_value) : String(b.rule_value / 100),
      is_investment: b.is_investment,
      active: b.active,
    });

  const createStarter = () =>
    run(() =>
      supabase().from("buckets").insert(
        STARTER.map(([name, rule_kind], i) => ({
          name,
          rule_kind,
          rule_value: 0,
          priority: i,
          color: i + 1,
          account_id: defaultAccount,
          is_investment: name === "الاستثمار",
        })),
      ),
    );

  const commitOrder = (items: Bucket[]) =>
    run(
      ...items
        .map((b, i) => ({ b, i }))
        .filter(({ b, i }) => b.priority !== i)
        .map(({ b, i }) => () => supabase().from("buckets").update({ priority: i }).eq("id", b.id)),
    );

  return (
    <section aria-labelledby="buckets-title" className="mt-10">
      <div className="flex items-center justify-between gap-2">
        <h2 id="buckets-title" className="text-heading font-bold">
          البنود
        </h2>
        {accounts.length > 0 && (
          <button type="button" onClick={openNew} className="rounded-control px-3 py-2 text-label font-semibold text-accent">
            + إضافة بند
          </button>
        )}
      </div>

      {error && !draft && (
        <p role="alert" className="mt-3 text-label text-danger">
          {error}
        </p>
      )}

      {accounts.length === 0 ? (
        <p className={`${ui.card} mt-4 text-muted`}>أنشئ حسابًا أولًا، ثم أضف البنود وحدّد لكل بند حسابه.</p>
      ) : buckets.length === 0 ? (
        <div className={`${ui.card} mt-4`}>
          <p className="font-medium">ابدأ ببنود مقترحة</p>
          <p className="mt-1 text-label text-muted">سبعة بنود بلا قيم. عدّل الأسماء والقيم والقواعد كما تشاء بعد إنشائها.</p>
          <ul className="mt-4 flex flex-col gap-2">
            {STARTER.map(([name, kind], i) => (
              <li key={name} className="flex items-center gap-2">
                <span aria-hidden className={`size-3 shrink-0 rounded-full ${bucketBg(kind === "remainder" ? "remainder" : i + 1)}`} />
                <span className="flex-1">{name}</span>
                <span className="text-label text-muted">{RULES.find(([k]) => k === kind)![1]}</span>
              </li>
            ))}
          </ul>
          <button type="button" disabled={busy} onClick={createStarter} className={`${ui.primary} mt-4 w-full`}>
            إنشاء البنود المقترحة
          </button>
        </div>
      ) : (
        <>
          <div className={`${ui.card} mt-4`}>
            <Preview buckets={buckets} referenceIncome={referenceIncome} livingFloor={livingFloor} />
          </div>
          <p className="mt-4 mb-2 text-label text-muted">الترتيب هو الأولوية: اسحب البند من المقبض لتغيير موضعه.</p>
          <SortableList items={buckets} onReorder={setBuckets} onCommit={commitOrder}>
            {(b) => (
              <button
                type="button"
                onClick={() => openEdit(b)}
                className={`flex min-h-14 min-w-0 flex-1 items-center gap-3 py-2 pe-4 text-start ${b.active ? "" : "opacity-55"}`}
              >
                <span
                  aria-hidden
                  className={`size-3 shrink-0 rounded-full ${bucketBg(b.rule_kind === "remainder" ? "remainder" : b.color)}`}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{b.name}</span>
                  <span className="block truncate text-label text-muted">
                    <span className="amount">{ruleSummary(b)}</span> · {accountName(b.account_id)}
                  </span>
                </span>
                {b.is_investment && (
                  <span className="shrink-0 rounded-full border border-hairline px-2 py-0.5 text-label text-muted">استثمار</span>
                )}
                {!b.active && (
                  <span className="shrink-0 rounded-full border border-hairline px-2 py-0.5 text-label text-muted">متوقف</span>
                )}
              </button>
            )}
          </SortableList>
        </>
      )}

      <Sheet open={draft !== null} onClose={() => setDraft(null)} title={draft?.id ? "تعديل البند" : "بند جديد"}>
        {draft && (
          <Editor
            draft={draft}
            setDraft={setDraft}
            buckets={buckets}
            accounts={accounts}
            subscriptionsMonthly={subscriptions
              .filter((s) => s.bucket_id === draft.id && !s.paused)
              .reduce((sum, s) => sum + monthlyEquivalent(s.amount, { count: s.cycle_count, unit: s.cycle_unit }), 0)}
            referenceIncome={referenceIncome}
            livingFloor={livingFloor}
            busy={busy}
            error={error}
            onSave={async (row, demote) => {
              const ok = await run(
                // The remainder and the investment flag each belong to one bucket: release the
                // previous holder first.
                // ponytail: separate statements, not one transaction. If the last one fails the
                // previous holder is already released; the preview says so and the user saves
                // again. Move to an RPC if that ever matters.
                ...demote.map(({ id, patch }) => () => supabase().from("buckets").update(patch).eq("id", id)),
                () =>
                  draft.id
                    ? supabase().from("buckets").update(row).eq("id", draft.id)
                    : supabase().from("buckets").insert({ ...row, priority: buckets.length }),
              );
              if (ok) setDraft(null);
            }}
            onDelete={async () => {
              if (await run(() => supabase().from("buckets").delete().eq("id", draft.id!))) setDraft(null);
            }}
          />
        )}
      </Sheet>
    </section>
  );
}

type Row = Omit<Bucket, "id" | "priority">;
type Demotion = { id: string; patch: Partial<Bucket> };

function Editor({
  draft,
  setDraft,
  buckets,
  accounts,
  subscriptionsMonthly,
  referenceIncome,
  livingFloor,
  busy,
  error,
  onSave,
  onDelete,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  buckets: Bucket[];
  accounts: Account[];
  /** Monthly cost (halalas) of the active subscriptions paid from this bucket. */
  subscriptionsMonthly: number;
  referenceIncome: number;
  livingFloor: number;
  busy: boolean;
  error: string | null;
  onSave: (row: Row, demote: Demotion[]) => void;
  onDelete: () => void;
}) {
  const value = ruleValue(draft);
  const others = buckets.filter((b) => b.id !== draft.id);
  const otherRemainder = draft.rule_kind === "remainder" ? others.find((b) => b.rule_kind === "remainder") : undefined;
  const otherInvestment = draft.is_investment ? others.find((b) => b.is_investment) : undefined;

  const row: Row = {
    name: draft.name.trim(),
    color: draft.color,
    account_id: draft.account_id,
    rule_kind: draft.rule_kind,
    rule_value: value ?? 0,
    is_investment: draft.is_investment,
    active: draft.active,
  };
  const demote: Demotion[] = [
    ...(otherRemainder ? [{ id: otherRemainder.id, patch: { rule_kind: "fixed" as const, rule_value: 0 } }] : []),
    ...(otherInvestment ? [{ id: otherInvestment.id, patch: { is_investment: false } }] : []),
  ];

  // The buckets as they would be after saving, for the live preview.
  const existing = buckets.find((b) => b.id === draft.id);
  const after: Bucket[] = [
    ...others.map((b) => ({ ...b, ...demote.find((d) => d.id === b.id)?.patch })),
    { ...row, id: draft.id ?? "draft", priority: existing?.priority ?? buckets.length },
  ].sort((a, b) => a.priority - b.priority);

  // Saving is blocked when it would create a shortfall or make one bigger.
  // A change that shrinks an existing shortfall is allowed, so the user can fix it step by step.
  const shortBefore = referenceIncome ? shortfallOf(buckets, referenceIncome) : 0;
  const shortAfter = referenceIncome ? shortfallOf(after, referenceIncome) : 0;
  const blocked = shortAfter > shortBefore;

  function setKind(kind: RuleKind) {
    let next = draft.value;
    // Keep the meaning of the number when switching between amount and percent.
    if (referenceIncome && value) {
      if (draft.rule_kind === "fixed" && kind === "percent") next = String(amountToPercent(value, referenceIncome) / 100);
      if (draft.rule_kind === "percent" && kind === "fixed") next = formatNumber(percentToAmount(value, referenceIncome));
    }
    setDraft({
      ...draft,
      rule_kind: kind,
      value: kind === "remainder" ? "" : next,
      is_investment: kind === "remainder" ? false : draft.is_investment,
    });
  }

  const conversion =
    draft.rule_kind === "remainder"
      ? "يأخذ كل ما يتبقى بعد البنود الأخرى."
      : value === null
        ? null
        : !referenceIncome
          ? "أدخل الراتب المرجعي لرؤية ما يعادله."
          : !value
            ? " "
            : draft.rule_kind === "percent"
              ? `= ${formatAmount(percentToAmount(value, referenceIncome))} من راتبك المرجعي`
              : `= ${formatPercent(amountToPercent(value, referenceIncome))} من راتبك المرجعي`;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (value !== null && !blocked) onSave(row, demote);
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

      <fieldset>
        <legend className={ui.label}>القاعدة</legend>
        <div className="mt-1.5 grid grid-cols-3 gap-1 rounded-control border border-hairline bg-bg p-1">
          {RULES.map(([kind, label]) => (
            <label
              key={kind}
              className="cursor-pointer rounded-lg px-2 py-2 text-center text-label font-medium text-muted has-checked:bg-surface has-checked:text-ink has-checked:shadow-sm has-focus-visible:ring-2 has-focus-visible:ring-accent/40"
            >
              <input
                type="radio"
                name="rule"
                className="sr-only"
                checked={draft.rule_kind === kind}
                onChange={() => setKind(kind)}
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      {draft.rule_kind !== "remainder" && (
        <label className={ui.label}>
          {draft.rule_kind === "fixed" ? "المبلغ" : "النسبة"}
          <span className="relative mt-1.5 block">
            <input
              value={draft.value}
              inputMode="decimal"
              dir="ltr"
              autoComplete="off"
              aria-invalid={value === null}
              aria-describedby="rule-conversion"
              onChange={(e) => setDraft({ ...draft, value: e.target.value })}
              className={`${ui.field} amount pe-14 text-end`}
            />
            <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-muted">
              {draft.rule_kind === "fixed" ? "ر.س" : "%"}
            </span>
          </span>
        </label>
      )}
      <p id="rule-conversion" aria-live="polite" className={`amount -mt-2 min-h-5 text-label ${value === null ? "text-danger" : "text-muted"}`}>
        {conversion ?? (draft.rule_kind === "percent" ? "أدخل نسبة بين 0 و 100." : "أدخل مبلغًا صحيحًا.")}
      </p>
      {draft.rule_kind === "fixed" && value !== null && subscriptionsMonthly > value && (
        <div className="-mt-1 rounded-control border border-hairline bg-bg p-3 text-label">
          <p className="amount">
            اشتراكات هذا البند تكلّف {formatAmount(subscriptionsMonthly)} شهريًا، أي أكثر من قيمته بـ{" "}
            {formatAmount(subscriptionsMonthly - value)}.
          </p>
          <button
            type="button"
            // Rounded up to a whole riyal so twelve months always cover a yearly subscription.
            onClick={() => setDraft({ ...draft, value: formatNumber(Math.ceil(subscriptionsMonthly / 100) * 100) })}
            className="amount mt-1 py-1 font-semibold text-accent"
          >
            تحديث إلى {formatAmount(Math.ceil(subscriptionsMonthly / 100) * 100)}
          </button>
        </div>
      )}
      {otherRemainder && (
        <p className="-mt-2 text-label text-muted">
          «{otherRemainder.name}» هو الباقي حاليًا. عند الحفظ سيصبح مبلغًا ثابتًا بلا قيمة.
        </p>
      )}

      {draft.rule_kind !== "remainder" && (
        <fieldset>
          <legend className={ui.label}>اللون</legend>
          <div className="mt-1.5 grid grid-cols-8 justify-items-center">
            {COLOR_NAMES.map((name, i) => (
              <label
                key={name}
                className="grid size-9 cursor-pointer place-items-center rounded-full border-2 border-transparent has-checked:border-ink has-focus-visible:ring-2 has-focus-visible:ring-accent/40"
              >
                <input
                  type="radio"
                  name="color"
                  aria-label={name}
                  className="sr-only"
                  checked={draft.color === i + 1}
                  onChange={() => setDraft({ ...draft, color: i + 1 })}
                />
                <span aria-hidden className={`size-6 rounded-full ${bucketBg(i + 1)}`} />
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <label className={ui.label}>
        الحساب
        <select
          value={draft.account_id}
          onChange={(e) => setDraft({ ...draft, account_id: e.target.value })}
          className={`${ui.field} mt-1.5`}
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>

      <div>
        <label className="flex items-center justify-between gap-3 py-1 font-medium">
          هذا بند الاستثمار
          <input
            type="checkbox"
            role="switch"
            checked={draft.is_investment}
            disabled={draft.rule_kind === "remainder"}
            onChange={(e) => setDraft({ ...draft, is_investment: e.target.checked })}
            className="switch"
          />
        </label>
        <p className="text-label text-muted">
          {draft.rule_kind === "remainder"
            ? "بند الباقي لا يمكن أن يكون بند الاستثمار."
            : otherInvestment
              ? `«${otherInvestment.name}» هو بند الاستثمار حاليًا. عند الحفظ ينتقل الوصف إلى هذا البند.`
              : "رصيده هو «المتاح» في تبويب الاستثمار."}
        </p>
      </div>

      <label className="flex items-center justify-between gap-3 py-1 font-medium">
        إيقاف مؤقت
        <input
          type="checkbox"
          role="switch"
          checked={!draft.active}
          onChange={(e) => setDraft({ ...draft, active: !e.target.checked })}
          className="switch"
        />
      </label>

      <div className="rounded-card border border-hairline bg-bg p-3">
        <p className="mb-2 text-label text-muted">المعاينة بعد الحفظ</p>
        <Preview buckets={after} referenceIncome={referenceIncome} livingFloor={livingFloor} />
      </div>

      {blocked && (
        <p role="alert" className="text-label font-medium text-danger">
          لا يمكن الحفظ: هذا التعديل يجعل البنود تتجاوز الراتب المرجعي.
        </p>
      )}
      {error && (
        <p role="alert" className="text-label text-danger">
          {error}
        </p>
      )}

      <button disabled={busy || !row.name || !draft.account_id || value === null || blocked} className={ui.primary}>
        حفظ
      </button>
      {draft.id && (
        <button type="button" disabled={busy} onClick={onDelete} className="py-2 text-label font-medium text-danger">
          حذف البند
        </button>
      )}
    </form>
  );
}
