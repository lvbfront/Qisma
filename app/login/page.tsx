"use client";

import { useActionState } from "react";
import { signIn } from "./actions";

const field =
  "mt-1.5 w-full rounded-control border border-line bg-surface px-3 py-2.5 text-base outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30";

export default function LoginPage() {
  const [error, action, pending] = useActionState(signIn, null);
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
      <h1 className="text-display font-bold">قِسمة</h1>
      <p className="mt-1 text-muted">سجّل الدخول للمتابعة</p>

      <form action={action} className="mt-8 flex flex-col gap-4">
        <label className="text-sm font-medium">
          البريد الإلكتروني
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            dir="ltr"
            className={`${field} text-end`}
          />
        </label>
        <label className="text-sm font-medium">
          كلمة المرور
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            dir="ltr"
            className={`${field} text-end`}
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <button
          disabled={pending}
          className="mt-2 rounded-control bg-accent px-4 py-3 font-semibold text-on-accent transition-opacity disabled:opacity-60"
        >
          {pending ? "جارٍ الدخول…" : "دخول"}
        </button>
      </form>
    </main>
  );
}
