import { signOut } from "@/app/login/actions";

export default function Page() {
  return (
    <>
      <h1 className="text-title font-bold">الإعدادات</h1>
      <p className="mt-2 text-muted">قريبًا</p>
      <form action={signOut} className="mt-8">
        <button className="rounded-control border border-hairline bg-surface px-4 py-2.5 text-label font-medium text-danger">
          تسجيل الخروج
        </button>
      </form>
    </>
  );
}
