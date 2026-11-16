import { connection } from "next/server";
import { Suspense } from "react";
import { createClient } from "@/utils/supabase/server";
import { loadSettings, ui } from "./data";
import { ExportButton } from "./export-button";
import { Settings } from "./settings";
import { SignOut } from "./sign-out";
import { ThemeToggle } from "./theme-toggle";

export default function Page() {
  return (
    <>
      <h1 className="text-title font-bold">الإعدادات</h1>
      {/* Reading the session is request-time work, so it streams in behind a boundary. */}
      <Suspense fallback={<p className="mt-6 text-muted">جارٍ التحميل…</p>}>
        <Loader />
      </Suspense>
      <section aria-labelledby="app-title" className="mt-10">
        <h2 id="app-title" className="text-heading font-bold">
          التطبيق
        </h2>
        <div className={`${ui.card} mt-4 flex flex-col gap-5`}>
          <ThemeToggle />
          <ExportButton />
        </div>
      </section>
      <SignOut />
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
