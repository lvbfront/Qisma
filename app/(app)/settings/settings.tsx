"use client";

import { useState } from "react";
import { formatNumber, parseAmount } from "@/lib/money";
import { supabaseBrowser } from "@/utils/supabase/client";
import { Accounts } from "./accounts";
import { Buckets } from "./buckets";
import { errorText, loadSettings, ui, type SettingsData } from "./data";

const asInput = (halalas: number) => (halalas ? formatNumber(halalas) : "");
/** Empty means 0; null means the text is not a valid amount. */
const asAmount = (text: string) => (text.trim() === "" ? 0 : parseAmount(text));

const supabase = supabaseBrowser;

export function Settings({ initial }: { initial: SettingsData }) {
  const [data, setData] = useState(initial);
  const reload = async () => setData(await loadSettings(supabase()));

  const [reference, setReference] = useState(asInput(initial.referenceIncome));
  const [floor, setFloor] = useState(asInput(initial.livingFloor));
  const [status, setStatus] = useState<{ text: string; bad?: boolean } | null>(null);
  const [payStatus, setPayStatus] = useState<{ text: string; bad?: boolean } | null>(null);

  async function saveDefaultBucket(bucketId: string) {
    setPayStatus(null);
    const { error } = await supabase()
      .from("settings")
      .upsert({ default_subscription_bucket_id: bucketId || null });
    if (error) return setPayStatus({ text: "تعذّر حفظ البند الافتراضي. لم يتغيّر شيء.", bad: true });
    setData((d) => ({ ...d, defaultSubscriptionBucketId: bucketId || null }));
    setPayStatus({ text: "تم الحفظ" });
  }

  // The preview follows what is typed, before it is saved.
  const referenceIncome = asAmount(reference) ?? data.referenceIncome;
  const livingFloor = asAmount(floor) ?? data.livingFloor;

  async function saveAmounts() {
    const r = asAmount(reference);
    const f = asAmount(floor);
    if (r === null || f === null) return setStatus({ text: "أدخل مبلغًا صحيحًا.", bad: true });
    if (r === data.referenceIncome && f === data.livingFloor) return;
    const { error } = await supabase().from("settings").upsert({ reference_income: r, living_floor: f });
    if (error) return setStatus({ text: errorText(error), bad: true });
    setData((d) => ({ ...d, referenceIncome: r, livingFloor: f }));
    setStatus({ text: "تم الحفظ" });
  }

  const amountField = (label: string, hint: string, value: string, set: (v: string) => void) => (
    <label className={ui.label}>
      {label}
      <span className="relative mt-1.5 block">
        <input
          value={value}
          inputMode="decimal"
          dir="ltr"
          autoComplete="off"
          aria-invalid={asAmount(value) === null}
          onChange={(e) => {
            set(e.target.value);
            setStatus(null);
          }}
          onBlur={saveAmounts}
          className={`${ui.field} amount pe-14 text-end`}
        />
        <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-muted">ر.س</span>
      </span>
      <span className="mt-1 block font-normal text-muted">{hint}</span>
    </label>
  );

  return (
    <>
      <section aria-labelledby="income-title" className="mt-6">
        <h2 id="income-title" className="sr-only">
          الراتب المرجعي والحد الأدنى
        </h2>
        <div className={`${ui.card} grid gap-4 md:grid-cols-2`}>
          {amountField("الراتب المرجعي", "يُستخدم للمعاينة فقط، وليس دخلًا مسجّلًا.", reference, setReference)}
          {amountField("الحد الأدنى للمعيشة", "ننبّهك إذا نزل الباقي عن هذا المبلغ.", floor, setFloor)}
          <p aria-live="polite" className={`min-h-5 text-label md:col-span-2 ${status?.bad ? "text-danger" : "text-muted"}`}>
            {status?.text}
          </p>
        </div>
      </section>

      <Accounts
        accounts={data.accounts}
        setAccounts={(accounts) => setData((d) => ({ ...d, accounts }))}
        supabase={supabase}
        reload={reload}
      />

      <Buckets
        buckets={data.buckets}
        setBuckets={(buckets) => setData((d) => ({ ...d, buckets }))}
        accounts={data.accounts}
        subscriptions={data.subscriptions}
        referenceIncome={referenceIncome}
        livingFloor={livingFloor}
        supabase={supabase}
        reload={reload}
      />

      <section aria-labelledby="pay-title" className="mt-10">
        <h2 id="pay-title" className="text-heading font-bold">
          الاشتراكات
        </h2>
        <div className={`${ui.card} mt-4`}>
          <label className={ui.label}>
            بند الدفع الافتراضي للاشتراكات
            <select
              value={data.defaultSubscriptionBucketId ?? ""}
              disabled={data.buckets.length === 0}
              onChange={(e) => saveDefaultBucket(e.target.value)}
              className={`${ui.field} mt-1.5`}
            >
              <option value="">بدون (سنسألك عند كل دفع)</option>
              {data.buckets
                .filter((b) => b.active || b.id === data.defaultSubscriptionBucketId)
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
            </select>
            <span className="mt-1 block font-normal text-muted">
              أي اشتراك لم تحدّد له بندًا يُخصم من هذا البند عند «تم الدفع». كل دفعة تُخصم من بند.
            </span>
          </label>
          <p role={payStatus?.bad ? "alert" : "status"} className={`mt-1 min-h-5 text-label ${payStatus?.bad ? "text-danger" : "text-muted"}`}>
            {payStatus?.text}
          </p>
        </div>
      </section>
    </>
  );
}
