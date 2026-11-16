"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Sheet } from "@/components/sheet";
import { formatAmount, formatNumber, formatSigned, parseAmount } from "@/lib/money";
import { adjustmentDelta, needsBankTransfer, transferError } from "@/lib/transfers";
import { supabaseBrowser } from "@/utils/supabase/client";
import { ui } from "../../settings/data";

export type OtherBucket = { id: string; name: string; accountId: string; accountName: string };

type Mode = "spend" | "transfer" | "adjust";

/**
 * The three ways to change a bucket by hand. Each only ADDS entries (entries are immutable):
 * - spend:    money leaves for good. One negative entry.
 * - transfer: money moves to another bucket. Two linked entries, written together by the
 *             database, so the total of all money does not change.
 * - adjust:   a correction to match the real bank balance. One adjustment entry for the
 *             difference; the total of all money goes up or down by that difference.
 */
export function BucketActions({
  bucketId,
  bucketName,
  balance,
  accountId,
  accountName,
  others,
  today,
}: {
  bucketId: string;
  bucketName: string;
  balance: number;
  accountId: string;
  accountName: string;
  /** Active buckets this one can send money to. */
  others: OtherBucket[];
  /** Today's date in Riyadh, "YYYY-MM-DD". */
  today: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode | null>(null);
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const [toId, setToId] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  // One id per opened form: submitting the same thing twice is rejected by the primary key.
  const requestId = useRef<string | null>(null);

  const open = (next: Mode) => {
    requestId.current = null;
    setText(next === "adjust" && balance > 0 ? formatNumber(balance) : "");
    setNote("");
    setToId("");
    setFailure(null);
    setMode(next);
  };

  const value = text.trim() === "" ? null : parseAmount(text);
  const typedBad = text.trim() !== "" && value === null;
  const destination = others.find((b) => b.id === toId);
  const moveError = transferError({ amount: value, balance, fromBucketId: bucketId, toBucketId: toId });
  const delta = value === null ? null : adjustmentDelta(balance, value);
  const valid =
    mode === "spend" ? !!value && value > 0 : mode === "transfer" ? moveError === null : mode === "adjust" ? value !== null : false;

  async function submit() {
    if (!valid || value === null || !mode) return;
    if (mode === "adjust" && delta === 0) return setMode(null); // the balance already is that figure
    setBusy(true);
    setFailure(null);
    const id = (requestId.current ??= crypto.randomUUID());
    const supabase = supabaseBrowser();
    const { error } =
      mode === "transfer"
        ? await supabase.rpc("transfer_between_buckets", {
            p_id: id,
            p_from_bucket: bucketId,
            p_to_bucket: toId,
            p_amount: value,
            p_on: today,
            p_note: note,
          })
        : await supabase.from("entries").insert({
            id,
            bucket_id: bucketId,
            kind: mode === "spend" ? "spend" : "adjustment",
            amount: mode === "spend" ? -value : delta,
            note: note.trim() || null,
            occurred_on: today,
          });
    setBusy(false);
    // 23505: this id is already recorded, so an earlier submit did go through.
    if (error && error.code !== "23505") {
      return setFailure(
        error.code === "QT001"
          ? "المبلغ أكبر من رصيد البند الآن. لم يُنقل شيء. حدّث الصفحة وحاول مرة أخرى."
          : "تعذّر الحفظ. لم يُسجَّل شيء. حاول مرة أخرى.",
      );
    }
    setMode(null);
    router.refresh();
  }

  const title =
    mode === "transfer" ? `تحويل من ${bucketName}` : mode === "adjust" ? `تصحيح رصيد ${bucketName}` : `صرف من ${bucketName}`;

  // One line, always shown, that says exactly what saving will do.
  const effect =
    typedBad
      ? "أدخل مبلغًا صحيحًا."
      : mode === "spend"
        ? value
          ? `الرصيد بعد الصرف: ${formatAmount(balance - value)}`
          : " "
        : mode === "transfer"
          ? moveError === "exceeds-balance"
            ? `المبلغ أكبر من رصيد البند. المتاح ${formatAmount(Math.max(balance, 0))} فقط.`
            : moveError || !value || !destination
              ? `رصيد ${bucketName}: ${formatAmount(balance)}`
              : needsBankTransfer(accountId, destination.accountId)
                ? `هذا ينقل ${formatAmount(value)} من ${accountName} إلى ${destination.accountName}. التحويل البنكي تنفّذه أنت، وسنضيفه إلى قائمة التحويلات في الرئيسية.`
                : `البندان في ${accountName}: لا يلزم تحويل بنكي.`
          : delta === null
            ? "اكتب الرصيد كما هو في حسابك البنكي فعلًا."
            : delta === 0
              ? "الرصيد مطابق، لا حاجة لتصحيح."
              : delta > 0
                ? `إجمالي أموالك سيرتفع بمقدار ${formatSigned(delta)}. يُسجَّل كقيد تصحيح على هذا البند.`
                : `إجمالي أموالك سينخفض بمقدار ${formatAmount(-delta)}. يُسجَّل كقيد تصحيح على هذا البند.`;
  const effectBad = typedBad || (mode === "transfer" && moveError === "exceeds-balance");

  return (
    <>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button type="button" onClick={() => open("spend")} className={ui.primary}>
          تسجيل صرف
        </button>
        <button type="button" disabled={others.length === 0} onClick={() => open("transfer")} className={`${ui.secondary} disabled:opacity-50`}>
          تحويل إلى بند آخر
        </button>
        <button type="button" onClick={() => open("adjust")} className={`${ui.secondary} col-span-2 py-2.5 text-label`}>
          تعديل الرصيد (تصحيح ليطابق رصيدك البنكي)
        </button>
      </div>

      <Sheet open={mode !== null} onClose={() => setMode(null)} title={title}>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          {mode === "adjust" && (
            <p className="rounded-control border border-hairline bg-bg p-3 text-label text-muted">
              هذا تصحيح، وليس تحويلًا: المال لا ينتقل إلى بند آخر، بل يتغيّر إجمالي أموالك ليطابق الواقع. لنقل المال بين
              البنود استخدم «تحويل إلى بند آخر».
            </p>
          )}
          {mode === "transfer" && (
            <label className={ui.label}>
              إلى بند
              <select value={toId} required autoFocus onChange={(e) => setToId(e.target.value)} className={`${ui.field} mt-1.5`}>
                <option value="" disabled>
                  اختر البند
                </option>
                {others.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                    {b.accountName ? ` · ${b.accountName}` : ""}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className={ui.label}>
            {mode === "adjust" ? "الرصيد الفعلي الآن" : "المبلغ"}
            <span className="relative mt-1.5 block">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                inputMode="decimal"
                enterKeyHint="done"
                autoComplete="off"
                autoFocus={mode !== "transfer"}
                dir="ltr"
                aria-invalid={effectBad}
                aria-describedby="entry-effect"
                className={`${ui.field} amount pe-14 text-end text-heading font-semibold`}
              />
              <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-muted">ر.س</span>
            </span>
          </label>
          <p id="entry-effect" aria-live="polite" className={`amount -mt-2 min-h-5 text-label ${effectBad ? "font-medium text-danger" : "text-muted"}`}>
            {effect}
          </p>
          {mode === "transfer" && <p className="-mt-2 text-label text-muted">إجمالي أموالك لا يتغيّر: ما يخرج من هذا البند يدخل البند الآخر.</p>}
          <label className={ui.label}>
            ملاحظة (اختياري)
            <input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} className={`${ui.field} mt-1.5`} />
          </label>
          {failure && (
            <p role="alert" className="text-label text-danger">
              {failure}
            </p>
          )}
          <button disabled={busy || !valid} className={ui.primary}>
            {mode === "transfer" ? "تحويل" : mode === "adjust" ? "حفظ التصحيح" : "تسجيل الصرف"}
          </button>
        </form>
      </Sheet>
    </>
  );
}
