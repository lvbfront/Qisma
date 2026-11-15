"use client";

import { useState } from "react";
import { errorText } from "./data";

type Write = () => PromiseLike<{ error: { code?: string } | null }>;

/** Runs Supabase writes in order, stops at the first error, then reloads the screen's data. */
export function useWrites(reload: () => Promise<void>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Resolves to true when every write succeeded. */
  async function run(...writes: Write[]): Promise<boolean> {
    setBusy(true);
    setError(null);
    let ok = true;
    for (const write of writes) {
      const { error } = await write();
      if (error) {
        setError(errorText(error));
        ok = false;
        break;
      }
    }
    await reload().catch(() => setError("تعذّر تحديث البيانات. أعد تحميل الصفحة."));
    setBusy(false);
    return ok;
  }

  return { run, busy, error, setError };
}
