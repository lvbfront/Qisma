"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/utils/supabase/client";
import { ui } from "./data";

// Everything the user owns. Row Level Security already limits each table to their own rows.
const TABLES = ["settings", "accounts", "buckets", "incomes", "entries", "subscriptions", "investments"] as const;
const PAGE = 1000; // the API returns at most this many rows per request

/** Downloads all of the user's data as one JSON file. Amounts are halalas (1 SAR = 100). */
export function ExportButton() {
  const [state, setState] = useState<"idle" | "busy" | "done" | "failed">("idle");

  async function exportAll() {
    setState("busy");
    const supabase = supabaseBrowser();
    const data: Record<string, unknown[]> = {};
    for (const table of TABLES) {
      const rows: unknown[] = [];
      for (let from = 0; ; from += PAGE) {
        const page = await supabase.from(table).select("*").range(from, from + PAGE - 1);
        if (page.error) return setState("failed"); // nothing is downloaded: a partial file would look complete
        rows.push(...page.data);
        if (page.data.length < PAGE) break;
      }
      data[table] = rows;
    }

    const exportedAt = new Date().toISOString();
    const file = new Blob(
      [JSON.stringify({ app: "qisma", version: 1, exportedAt, note: "Amounts are integer halalas (1 SAR = 100).", ...data }, null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = `qisma-${exportedAt.slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setState("done");
  }

  return (
    <div>
      <button type="button" disabled={state === "busy"} onClick={exportAll} className={`${ui.secondary} w-full`}>
        {state === "busy" ? "جارٍ تجهيز الملف…" : "تنزيل كل بياناتي (JSON)"}
      </button>
      <p role={state === "failed" ? "alert" : "status"} className={`mt-1.5 min-h-5 text-label ${state === "failed" ? "text-danger" : "text-muted"}`}>
        {state === "failed"
          ? "تعذّر تجهيز الملف. لم يُنزَّل شيء. حاول مرة أخرى."
          : state === "done"
            ? "تم تنزيل الملف."
            : "ملف واحد يضم الحسابات والبنود والدخل والحركات والاشتراكات والاستثمارات."}
      </p>
    </div>
  );
}
