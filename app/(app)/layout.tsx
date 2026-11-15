import { Nav } from "@/components/nav";

// Auth is enforced in proxy.ts: no request reaches this shell without a session.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-4 pt-6 pb-24 md:ms-56 md:px-8 md:pt-10 md:pb-10">
        {children}
      </main>
    </>
  );
}
