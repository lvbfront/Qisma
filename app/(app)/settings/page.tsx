import { connection } from "next/server";
import { Suspense } from "react";
import { signOut } from "@/app/login/actions";
import { createClient } from "@/utils/supabase/server";
import { loadSettings } from "./data";
import { Settings } from "./settings";

export default function Page() {
  return (
    <>
      <h1 className="text-title font-bold">الإعدادات</h1>
      {/* Reading the session is request-time work, so it streams in behind a boundary. */}
      <Suspense fallback={<p className="mt-6 text-muted">جارٍ التحميل…</p>}>
        <Loader />
      </Suspense>
      <form action={signOut} className="mt-12">
        <button className="rounded-control border border-hairline bg-surface px-4 py-2.5 text-label font-medium text-danger">
          تسجيل الخروج
        </button>
      </form>
    </>
  );
}

async function Loader() {
  // The Supabase client reads the clock (token expiry). With Cache Components that is only
  // allowed at request time, so say so explicitly before creating it.
  await connection();
  const supabase = await createClient();
  return <Settings initial={await loadSettings(supabase)} />;
}
