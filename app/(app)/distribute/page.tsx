import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { createClient } from "@/utils/supabase/server";
import { loadSettings, ui } from "../settings/data";
import { loadTransfers } from "./data";
import { Distribute } from "./distribute";
import { Transfers } from "./transfers";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// One route, three steps: amount and preview (client state), then the transfers
// checklist of a confirmed distribution at /distribute?income=<id>.
export default function Page({ searchParams }: PageProps<"/distribute">) {
  return (
    <>
      <h1 className="text-title font-bold">توزيع</h1>
      <Suspense fallback={<p className="mt-6 text-muted">جارٍ التحميل…</p>}>
        <Loader searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Loader({ searchParams }: { searchParams: PageProps<"/distribute">["searchParams"] }) {
  await connection(); // request-time work: see CLAUDE.md, "Reading Supabase in a server component"
  const { income } = await searchParams;
  const supabase = await createClient();

  if (income !== undefined) {
    const data = typeof income === "string" && UUID.test(income) ? await loadTransfers(supabase, income) : null;
    // key: a different distribution must not inherit the ticks held in client state.
    if (data) return <Transfers key={data.income.id} data={data} />;
    return (
      <div className={`${ui.card} mt-6`}>
        <p className="font-medium">لم نجد هذا التوزيع.</p>
        <Link href="/distribute" className={`${ui.primary} mt-4 block text-center`}>
          توزيع جديد
        </Link>
      </div>
    );
  }

  const settings = await loadSettings(supabase);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date());
  return (
    <Distribute
      buckets={settings.buckets.filter((b) => b.active)}
      accounts={settings.accounts}
      livingFloor={settings.livingFloor}
      today={today}
    />
  );
}
