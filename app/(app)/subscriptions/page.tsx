import { connection } from "next/server";
import { Suspense } from "react";
import { createClient } from "@/utils/supabase/server";
import { loadSubscriptions, todayInRiyadh } from "./data";
import { Subscriptions } from "./subscriptions";

export default function Page() {
  return (
    <>
      <h1 className="text-title font-bold">الاشتراكات</h1>
      <Suspense fallback={<p className="mt-6 text-muted">جارٍ التحميل…</p>}>
        <Loader />
      </Suspense>
    </>
  );
}

async function Loader() {
  await connection();
  const supabase = await createClient();
  const [subscriptions, buckets] = await Promise.all([
    loadSubscriptions(supabase),
    supabase.from("buckets").select("id, name, active").order("priority").order("created_at"),
  ]);
  if (buckets.error) throw new Error(buckets.error.message);
  return <Subscriptions subscriptions={subscriptions} buckets={buckets.data} today={todayInRiyadh()} />;
}
