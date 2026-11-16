"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export async function signIn(_prev: string | null, formData: FormData): Promise<string | null> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return "أدخل البريد الإلكتروني وكلمة المرور.";

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return error.status === 400
      ? "البريد الإلكتروني أو كلمة المرور غير صحيحة."
      : "تعذّر تسجيل الدخول. حاول مرة أخرى.";
  }
  redirect("/");
}

/** Returns an Arabic message if signing out failed; otherwise redirects to the login page. */
export async function signOut(): Promise<string | null> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) return "تعذّر تسجيل الخروج. ما زلت مسجّل الدخول. حاول مرة أخرى.";
  redirect("/login");
}
