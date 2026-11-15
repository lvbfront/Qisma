"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Sheet } from "@/components/sheet";
import { formatAmount, formatNumber, formatSigned, parseAmount } from "@/lib/money";
import { supabaseBrowser } from "@/utils/supabase/client";
import { ui } from "../../settings/data";

/**
 * The two ways to change a bucket by hand. Both only ADD an entry (entries are immutable):
 * - spend: a negative entry for the amount
 * - adjust: an adjustment entry for the difference between the new figure and the balance
 */
export function BucketActions({
  bucketId,
  bucketName,
  balance,
  today,
}: {
  bucketId: string;
  bucketName: string;
  balance: number;
  /** Today's date in Riyadh, "YYYY-MM-DD". */
  today: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"spend" | "adjust" | null>(null);
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  // One id per opened form: submitting the same entry twice is rejected by the primary key.
  const entryId = useRef<string | null>(null);

  const open = (next: "spend" | "adjust") => {
    entryId.current = null;
    setText(next === "adjust" && balance > 0 ? formatNumber(balance) : "");
    setNote("");
    setFailure(null);
    setMode(next);
  };

  const value = text.trim() === "" ? null : parseAmount(text);
  // The signed amount of the entry that would be recorded.
  const delta = value === null ? null : mode === "spend" ? -value : value - balance;
  const valid = delta !== null && (mode === "spend" ? value! > 0 : true);

  async function submit() {
    if (!valid || delta === null || !mode) return;
    if (delta === 0) return setMode(null); // the balance already is that figure
    setBusy(true);
    setFailure(null);
    const { error } = await supabaseBrowser()
      .from("entries")
      .insert({
        id: (entryId.current ??= crypto.randomUUID()),
        bucket_id: bucketId,
        kind: mode === "spend" ? "spend" : "adjustment",
        amount: delta,
        note: note.trim() || null,
        occurred_on: today,
      });
    setBusy(false);
    // 23505: this id is already recorded, so an earlier submit did go through.
    if (error && error.code !== "23505") return setFailure("تعذّر الحفظ. لم يُسجَّل شيء. حاول مرة أخرى.");
    setMode(null);
    router.refresh();
  }

  return (
    <>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button type="button" onClick={() => open("spend")} className={ui.primary}>
          تسجيل صرف
        </button>
        <button type="button" onClick={() => open("adjust")} className={ui.secondary}>
          تعديل الرصيد
        </button>
      </div>

      <Sheet
        open={mode !== null}
        onClose={() => setMode(null)}
        title={mode === "adjust" ? `تعديل رصيد ${bucketName}` : `صرف من ${bucketName}`}
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <label className={ui.label}>
            {mode === "adjust" ? "الرصيد الفعلي الآن" : "المبلغ"}
            <span className="relative mt-1.5 block">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                inputMode="decimal"
                enterKeyHint="done"
                autoComplete="off"
                autoFocus
                dir="ltr"
                aria-invalid={text.trim() !== "" && value === null}
                aria-describedby="entry-effect"
                className={`${ui.field} amount pe-14 text-end text-heading font-semibold`}
              />
              <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-muted">ر.س</span>
            </span>
          </label>
          <p id="entry-effect" aria-live="polite" className="amount -mt-2 min-h-5 text-label text-muted">
            {text.trim() !== "" && value === null
              ? "أدخل مبلغًا صحيحًا."
              : delta === null
                ? mode === "adjust"
                  ? "اكتب الرصيد كما هو في الواقع، وسنسجّل الفرق كقيد تعديل."
                  : " "
                : mode === "spend"
                  ? `الرصيد بعد الصرف: ${formatAmount(balance + delta)}`
                  : delta === 0
                    ? "الرصيد مطابق، لا حاجة لتعديل."
                    : `سيُسجَّل قيد تعديل بمقدار ${formatSigned(delta)}`}
          </p>
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
            {mode === "adjust" ? "حفظ الرصيد" : "تسجيل الصرف"}
          </button>
        </form>
      </Sheet>
    </>
  );
}
