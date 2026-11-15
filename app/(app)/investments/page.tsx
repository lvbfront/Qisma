import { connection } from "next/server";
import { Suspense } from "react";
import { createClient } from "@/utils/supabase/server";
import { todayInRiyadh } from "../subscriptions/data";
import { loadInvestments } from "./data";
import { Investments } from "./investments";

export default function Page() {
  return (
    <>
      <h1 className="text-title font-bold">الاستثمار</h1>
      <Suspense fallback={<p className="mt-6 text-muted">جارٍ التحميل…</p>}>
        <Loader />
      </Suspense>
    </>
  );
}

async function Loader() {
  await connection();
  const data = await loadInvestments(await createClient());
  return <Investments data={data} today={todayInRiyadh()} />;
}
