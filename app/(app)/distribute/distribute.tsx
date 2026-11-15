"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { bucketBg } from "@/components/bucket-color";
import { SplitBar } from "@/components/split-bar";
import { allocate, percentToAmount, type Line } from "@/lib/allocate";
import { formatAmount, formatNumber, formatPercent, parseAmount } from "@/lib/money";
import { supabaseBrowser } from "@/utils/supabase/client";
import { toSegments, ui, type Account, type Bucket } from "../settings/data";

const NUDGE = 100_00; // + / − step: 100 SAR

export function Distribute({
  buckets,
  accounts,
  livingFloor,
  today,
}: {
  /** Active buckets only, in priority order. */
  buckets: Bucket[];
  accounts: Account[];
  livingFloor: number;
  /** Today's date in Riyadh, "YYYY-MM-DD". */
  today: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<"amount" | "preview">("amount");
  const [text, setText] = useState("");
  // Per-distribution changes; the saved rules are not touched.
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [off, setOff] = useState<Record<string, boolean>>({});
  const [receivedOn, setReceivedOn] = useState(today);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  // One id per distribution: a second submit of the same one is rejected by the database.
  const incomeId = useRef<string | null>(null);

  const amount = parseAmount(text);
  const lines: Line[] = buckets.map((b) => ({
    bucketId: b.id,
    kind: b.rule_kind,
    value: b.rule_value,
    priority: b.priority,
    enabled: !off[b.id],
    override: overrides[b.id],
  }));
  const split = amount ? allocate(amount, lines) : null;
  const error = split && !split.ok ? split.error : null;
  const allocated = new Map(split?.ok ? split.allocations.map((a) => [a.bucketId, a.amount]) : []);
  const remainder = buckets.find((b) => b.rule_kind === "remainder");
  const remainderAmount = remainder ? allocated.get(remainder.id) : undefined;

  /** What a row asks for: from allocate() when it succeeded, otherwise from the rule, so rows stay editable during a shortfall. */
  const rowAmount = (b: Bucket) =>
    allocated.get(b.id) ??
    overrides[b.id] ??
    (b.rule_kind === "fixed" ? b.rule_value : b.rule_kind === "percent" ? percentToAmount(b.rule_value, amount ?? 0) : 0);

  // Same order as allocate(): fixed by priority, percent by priority, remainder last.
  const rows = (["fixed", "percent", "remainder"] as const).flatMap((kind) => buckets.filter((b) => b.rule_kind === kind));

  const setOverride = (id: string, value: number | undefined) =>
    setOverrides((o) => {
      const next = { ...o };
      if (value === undefined) delete next[id];
      else next[id] = Math.max(0, value);
      return next;
    });

  async function confirm() {
    if (!amount || !split?.ok) return;
    setBusy(true);
    setFailure(null);
    const id = (incomeId.current ??= crypto.randomUUID());
    const accountName = (accountId: string) => accounts.find((a) => a.id === accountId)?.name ?? "";
    const { error } = await supabaseBrowser().rpc("confirm_distribution", {
      p_id: id,
      p_amount: amount,
      p_received_on: receivedOn || today,
      p_note: note,
      // The exact lines and rules used, so history stays correct after rules change.
      p_snapshot: {
        amount,
        livingFloor,
        lines: lines.map((l) => {
          const b = buckets.find((x) => x.id === l.bucketId)!;
          return { ...l, name: b.name, color: b.color, accountId: b.account_id, accountName: accountName(b.account_id) };
        }),
        allocations: split.allocations,
      },
      p_allocations: split.allocations.map((a) => ({ bucket_id: a.bucketId, amount: a.amount })),
    });
    // 23505: this id is already recorded, so an earlier submit did go through.
    if (error && error.code !== "23505") {
      setFailure("تعذّر تأكيد التوزيع. لم يُسجَّل شيء. حاول مرة أخرى.");
      setBusy(false);
      return;
    }
    router.push(`/distribute?income=${id}`);
  }

  if (!remainder) {
    return (
      <div className={`${ui.card} mt-6`}>
        <p className="font-medium">لا يمكن التوزيع قبل إعداد البنود</p>
        <p className="mt-1 text-label text-muted">أضف بنودك واجعل واحدًا منها «الباقي»، ثم عد إلى هنا.</p>
        <Link href="/settings" className={`${ui.primary} mt-4 block text-center`}>
          الذهاب إلى الإعدادات
        </Link>
      </div>
    );
  }

  const status = (
    <div className="mt-4">
      <SplitBar
        segments={split?.ok ? toSegments(split.allocations, buckets) : []}
        shortfall={error?.code === "shortfall" ? error.missing : 0}
      />
      <div className="mt-3 min-h-6">
        {error ? (
          <p role="alert" className="text-label font-medium text-danger">
            {error.code === "shortfall" ? (
              <>
                البنود تتجاوز المبلغ بمقدار <span className="amount">{formatAmount(error.missing)}</span>. خفّض بندًا أو
                أوقفه لهذا التوزيع.
              </>
            ) : (
              "البنود غير صالحة للتوزيع. راجع الإعدادات."
            )}
          </p>
        ) : remainderAmount !== undefined ? (
          <>
            <p>
              الباقي للمعيشة: <span className="amount font-semibold">{formatAmount(remainderAmount)}</span>
            </p>
            {remainderAmount < livingFloor && (
              <p role="status" className="mt-1 text-label font-medium text-danger">
                تنبيه: الباقي أقل من الحد الأدنى للمعيشة (<span className="amount">{formatAmount(livingFloor)}</span>).
              </p>
            )}
          </>
        ) : (
          <p className="text-label text-muted">اكتب المبلغ ليظهر التقسيم.</p>
        )}
      </div>
    </div>
  );

  if (step === "amount") {
    return (
      <form
        className="mt-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (amount) setStep("preview");
        }}
      >
        <label className={ui.label} htmlFor="amount">
          المبلغ المستلم
        </label>
        <div className="relative mt-2">
          <input
            id="amount"
            value={text}
            onChange={(e) => setText(e.target.value)}
            inputMode="decimal"
            enterKeyHint="next"
            autoComplete="off"
            autoFocus
            dir="ltr"
            placeholder="0"
            aria-invalid={text.trim() !== "" && amount === null}
            className="amount w-full rounded-card border border-hairline bg-surface py-5 ps-4 pe-16 text-end text-display font-bold outline-none placeholder:text-hairline focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30"
          />
          <span className="pointer-events-none absolute inset-y-0 end-4 flex items-center text-heading text-muted">ر.س</span>
        </div>
        {text.trim() !== "" && amount === null && (
          <p role="alert" className="mt-2 text-label text-danger">
            أدخل مبلغًا صحيحًا.
          </p>
        )}
        {status}
        <button disabled={!amount} className={`${ui.primary} mt-6 w-full`}>
          متابعة
        </button>
      </form>
    );
  }

  return (
    <div className="mt-6">
      <div className="flex items-baseline justify-between gap-3">
        <p className="amount text-title font-bold">{formatAmount(amount ?? 0)}</p>
        <button type="button" onClick={() => setStep("amount")} className="text-label font-semibold text-accent">
          تعديل المبلغ
        </button>
      </div>
      {status}

      <ul className="mt-4 divide-y divide-hairline overflow-hidden rounded-card border border-hairline bg-surface">
        {rows.map((b) =>
          b.rule_kind === "remainder" ? (
            <li key={b.id} className="flex items-center gap-3 p-4">
              <span aria-hidden className="size-3 shrink-0 rounded-full bg-accent" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{b.name}</span>
                <span className="block text-label text-muted">الباقي</span>
              </span>
              <span className="amount text-heading font-bold text-accent">
                {remainderAmount === undefined ? "—" : formatAmount(remainderAmount)}
              </span>
            </li>
          ) : (
            <Row
              key={b.id}
              bucket={b}
              amount={rowAmount(b)}
              off={!!off[b.id]}
              overridden={overrides[b.id] !== undefined}
              onSet={(value) => setOverride(b.id, value)}
              onToggle={(on) => setOff((o) => ({ ...o, [b.id]: !on }))}
            />
          ),
        )}
      </ul>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className={ui.label}>
          تاريخ الاستلام
          <input
            type="date"
            value={receivedOn}
            max={today}
            onChange={(e) => setReceivedOn(e.target.value)}
            className={`${ui.field} amount mt-1.5`}
          />
        </label>
        <label className={ui.label}>
          ملاحظة (اختياري)
          <input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} className={`${ui.field} mt-1.5`} />
        </label>
      </div>

      {failure && (
        <p role="alert" className="mt-3 text-label text-danger">
          {failure}
        </p>
      )}
      <button type="button" disabled={busy || !split?.ok} onClick={confirm} className={`${ui.primary} mt-4 w-full`}>
        {busy ? "جارٍ التأكيد…" : "تأكيد التوزيع"}
      </button>
      <p className="mt-2 text-center text-label text-muted">بعد التأكيد لا يُعدَّل التوزيع؛ التصحيح يكون بقيد تسوية.</p>
    </div>
  );
}

function Row({
  bucket,
  amount,
  off,
  overridden,
  onSet,
  onToggle,
}: {
  bucket: Bucket;
  amount: number;
  off: boolean;
  overridden: boolean;
  /** undefined = back to the rule */
  onSet: (value: number | undefined) => void;
  onToggle: (on: boolean) => void;
}) {
  // null = showing the amount; a string = the user is typing an exact figure.
  const [typing, setTyping] = useState<string | null>(null);
  const typed = typing === null ? null : typing.trim() === "" ? 0 : parseAmount(typing);

  const commit = () => {
    if (typed !== null && typed !== amount) onSet(typed);
    setTyping(null);
  };
  const round =
    "grid size-11 shrink-0 place-items-center rounded-full border border-hairline text-heading text-ink disabled:opacity-40";

  return (
    <li className="p-4">
      <div className="flex items-center gap-3">
        <span aria-hidden className={`size-3 shrink-0 rounded-full ${bucketBg(bucket.color)} ${off ? "opacity-40" : ""}`} />
        <span className={`min-w-0 flex-1 ${off ? "opacity-55" : ""}`}>
          <span className="block truncate font-medium">{bucket.name}</span>
          <span className="amount block text-label text-muted">
            {bucket.rule_kind === "fixed" ? "ثابت" : formatPercent(bucket.rule_value)}
            {overridden && !off && " · معدَّل"}
          </span>
        </span>
        <input
          type="checkbox"
          role="switch"
          aria-label={`تضمين ${bucket.name} في هذا التوزيع`}
          checked={!off}
          onChange={(e) => onToggle(e.target.checked)}
          className="switch"
        />
      </div>

      {off ? (
        <p className="mt-2 text-label text-muted">خارج هذا التوزيع فقط. قاعدته في الإعدادات لم تتغيّر.</p>
      ) : (
        <div className="mt-3 flex items-center gap-2">
          <button type="button" aria-label={`إنقاص ${bucket.name} 100 ريال`} disabled={amount <= 0} onClick={() => onSet(amount - NUDGE)} className={round}>
            −
          </button>
          {typing === null ? (
            <button
              type="button"
              aria-label={`${bucket.name}: ${formatAmount(amount)}. اضغط لكتابة مبلغ محدد`}
              onClick={() => setTyping(amount ? formatNumber(amount) : "")}
              className="amount min-h-11 min-w-0 flex-1 rounded-control border border-transparent text-center text-heading font-semibold hover:border-hairline"
            >
              {formatAmount(amount)}
            </button>
          ) : (
            <input
              value={typing}
              onChange={(e) => setTyping(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") setTyping(null);
              }}
              inputMode="decimal"
              enterKeyHint="done"
              autoFocus
              dir="ltr"
              aria-label={`مبلغ ${bucket.name}`}
              aria-invalid={typed === null}
              className={`${ui.field} amount min-w-0 flex-1 text-center text-heading font-semibold aria-invalid:border-danger`}
            />
          )}
          <button type="button" aria-label={`زيادة ${bucket.name} 100 ريال`} onClick={() => onSet(amount + NUDGE)} className={round}>
            +
          </button>
          {overridden && (
            <button type="button" onClick={() => onSet(undefined)} className="shrink-0 px-1 text-label font-semibold text-accent">
              إعادة للقاعدة
            </button>
          )}
        </div>
      )}
    </li>
  );
}
