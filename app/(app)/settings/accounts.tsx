"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useState } from "react";
import { Sheet } from "@/components/sheet";
import { SortableList } from "@/components/sortable";
import { ui, type Account, type AccountKind } from "./data";
import { useWrites } from "./use-writes";

const KINDS: Record<AccountKind, string> = {
  current: "جاري",
  savings: "ادخار",
  investment: "استثمار",
  cash: "نقد",
};

type Draft = { id?: string; name: string; kind: AccountKind; receives_income: boolean };

export function Accounts({
  accounts,
  setAccounts,
  supabase,
  reload,
}: {
  accounts: Account[];
  setAccounts: (accounts: Account[]) => void;
  supabase: () => SupabaseClient;
  reload: () => Promise<void>;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const { run, busy, error, setError } = useWrites(reload);
  // First run: two suggested accounts. Only the names are suggestions; nothing else is stored about a bank.
  const [starter, setStarter] = useState(["الحساب الجاري", "حساب الادخار"]);

  const createStarter = () =>
    run(() =>
      supabase().from("accounts").insert([
        { name: starter[0].trim(), kind: "current", sort_order: 0, receives_income: true },
        { name: starter[1].trim(), kind: "savings", sort_order: 1, receives_income: false },
      ]),
    );

  async function save(d: Draft) {
    const row = { name: d.name.trim(), kind: d.kind, receives_income: d.receives_income };
    const current = accounts.find((a) => a.receives_income && a.id !== d.id);
    const ok = await run(
      // Only one account receives income: release the other one first.
      // ponytail: two statements, not one transaction. If the second fails no account is
      // marked and the user sets it again; move to an RPC if that ever matters.
      ...(d.receives_income && current
        ? [() => supabase().from("accounts").update({ receives_income: false }).eq("id", current.id)]
        : []),
      () =>
        d.id
          ? supabase().from("accounts").update(row).eq("id", d.id)
          : supabase().from("accounts").insert({ ...row, sort_order: accounts.length }),
    );
    if (ok) setDraft(null);
  }

  async function remove(id: string) {
    if (await run(() => supabase().from("accounts").delete().eq("id", id))) setDraft(null);
  }

  const commitOrder = (items: Account[]) =>
    run(
      ...items
        .map((a, i) => ({ a, i }))
        .filter(({ a, i }) => a.sort_order !== i)
        .map(({ a, i }) => () => supabase().from("accounts").update({ sort_order: i }).eq("id", a.id)),
    );

  return (
    <section aria-labelledby="accounts-title" className="mt-10">
      <div className="flex items-center justify-between gap-2">
        <h2 id="accounts-title" className="text-heading font-bold">
          الحسابات
        </h2>
        <button
          type="button"
          onClick={() => setDraft({ name: "", kind: "current", receives_income: accounts.length === 0 })}
          className="rounded-control px-3 py-2 text-label font-semibold text-accent"
        >
          + إضافة حساب
        </button>
      </div>
      <p className="mt-1 text-label text-muted">الحساب مجرد اسم تختاره. لا تُحفظ أي أرقام حسابات أو بيانات بنكية.</p>

      {error && !draft && (
        <p role="alert" className="mt-3 text-label text-danger">
          {error}
        </p>
      )}

      {accounts.length === 0 ? (
        <div className={`${ui.card} mt-4`}>
          <p className="font-medium">ابدأ بحسابين</p>
          <p className="mt-1 text-label text-muted">حساب ينزل فيه الراتب، وحساب للادخار. يمكنك تغيير الاسمين الآن أو لاحقًا.</p>
          <div className="mt-4 flex flex-col gap-3">
            {starter.map((name, i) => (
              <label key={i} className={ui.label}>
                {i === 0 ? "حساب الراتب (جاري)" : "حساب الادخار"}
                <input
                  value={name}
                  maxLength={60}
                  onChange={(e) => setStarter(starter.map((s, j) => (j === i ? e.target.value : s)))}
                  className={`${ui.field} mt-1.5`}
                />
              </label>
            ))}
          </div>
          <button
            type="button"
            disabled={busy || starter.some((s) => !s.trim())}
            onClick={createStarter}
            className={`${ui.primary} mt-4 w-full`}
          >
            إنشاء الحسابين
          </button>
        </div>
      ) : (
        <div className="mt-4">
          <SortableList items={accounts} onReorder={setAccounts} onCommit={commitOrder}>
            {(a) => (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setDraft({ id: a.id, name: a.name, kind: a.kind, receives_income: a.receives_income });
                }}
                className="flex min-h-14 min-w-0 flex-1 items-center gap-2 py-2 pe-4 text-start"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{a.name}</span>
                  <span className="block text-label text-muted">{KINDS[a.kind]}</span>
                </span>
                {a.receives_income && (
                  <span className="shrink-0 rounded-full border border-hairline px-2 py-0.5 text-label text-muted">
                    يستقبل الدخل
                  </span>
                )}
              </button>
            )}
          </SortableList>
        </div>
      )}

      <Sheet open={draft !== null} onClose={() => setDraft(null)} title={draft?.id ? "تعديل الحساب" : "حساب جديد"}>
        {draft && (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              save(draft);
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
              النوع
              <select
                value={draft.kind}
                onChange={(e) => setDraft({ ...draft, kind: e.target.value as AccountKind })}
                className={`${ui.field} mt-1.5`}
              >
                {Object.entries(KINDS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center justify-between gap-3 py-1 font-medium">
              يستقبل الدخل (ينزل فيه الراتب)
              <input
                type="checkbox"
                role="switch"
                checked={draft.receives_income}
                onChange={(e) => setDraft({ ...draft, receives_income: e.target.checked })}
                className="switch"
              />
            </label>
            {error && (
              <p role="alert" className="text-label text-danger">
                {error}
              </p>
            )}
            <button disabled={busy || !draft.name.trim()} className={ui.primary}>
              حفظ
            </button>
            {draft.id && (
              <button
                type="button"
                disabled={busy}
                onClick={() => remove(draft.id!)}
                className="py-2 text-label font-medium text-danger"
              >
                حذف الحساب
              </button>
            )}
          </form>
        )}
      </Sheet>
    </section>
  );
}
