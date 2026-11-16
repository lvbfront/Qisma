import { Nav } from "@/components/nav";

// Auth is enforced in proxy.ts: no request reaches this shell without a session.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* First tab stop: jump over the navigation. Visible only when focused. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-30 focus:rounded-control focus:bg-surface focus:px-4 focus:py-2 focus:font-semibold"
      >
        تخطَّ إلى المحتوى
      </a>
      <Nav />
      <main id="main" tabIndex={-1} className="outline-none mx-auto max-w-3xl px-4 pt-6 pb-24 md:ms-56 md:px-8 md:pt-10 md:pb-10">
        {children}
      </main>
    </>
  );
}
