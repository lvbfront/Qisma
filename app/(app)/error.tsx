"use client";

// Shown when a screen fails to load its data (network down, Supabase unreachable, session gone).
// Nothing is written while loading, so retrying is always safe.
export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="rounded-card border border-hairline bg-surface p-4">
      <h1 className="text-heading font-bold">تعذّر تحميل هذه الصفحة</h1>
      <p className="mt-1 text-label text-muted">
        لم نتمكن من جلب بياناتك. تحقق من اتصالك بالإنترنت ثم أعد المحاولة. بياناتك لم تتغيّر.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 w-full rounded-control bg-accent px-4 py-3 font-semibold text-on-accent"
      >
        إعادة المحاولة
      </button>
    </div>
  );
}
