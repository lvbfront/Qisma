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
  const [subscriptions, buckets, accounts, settings] = await Promise.all([
    loadSubscriptions(supabase),
    supabase.from("buckets").select("id, name, active, account_id").order("priority").order("created_at"),
    supabase.from("accounts").select("id, name"),
    supabase.from("settings").select("default_subscription_bucket_id").maybeSingle(),
  ]);
  const error = buckets.error ?? accounts.error ?? settings.error;
  if (error) throw new Error(error.message);
  const accountName = new Map((accounts.data ?? []).map((a) => [a.id, a.name]));
  return (
    <Subscriptions
      subscriptions={subscriptions}
      buckets={(buckets.data ?? []).map((b) => ({ id: b.id, name: b.name, active: b.active, accountName: accountName.get(b.account_id) ?? "" }))}
      defaultBucketId={settings.data?.default_subscription_bucket_id ?? null}
      today={todayInRiyadh()}
    />
  );
}
