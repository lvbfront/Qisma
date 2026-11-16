"use client";

import { useActionState } from "react";
import { signOut } from "@/app/login/actions";

/** Sign out, with a visible message if it fails (the session would otherwise silently stay). */
export function SignOut() {
  const [error, action, pending] = useActionState(signOut, null);
  return (
    <form action={action} className="mt-8">
      <button
        disabled={pending}
        className="rounded-control border border-hairline bg-surface px-4 py-2.5 text-label font-medium text-danger disabled:opacity-50"
      >
        {pending ? "جارٍ الخروج…" : "تسجيل الخروج"}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-label text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
