"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Icons are single 24x24 stroke paths.
const tabs = [
  { href: "/", label: "الرئيسية", icon: "M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" },
  { href: "/distribute", label: "توزيع", icon: "M3 8h18v8H3zM9 8v8M16 8v8" },
  { href: "/history", label: "السجل", icon: "M4 6h16M4 12h16M4 18h10" },
  {
    href: "/settings",
    label: "الإعدادات",
    icon: "M4 7h9m4 0h3M4 17h3m4 0h9M15 4.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM9 14.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z",
  },
];

/** Bottom tab bar on mobile, side rail (inline-start) from md up. */
export function Nav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="التنقل الرئيسي"
      className="fixed inset-x-0 bottom-0 z-10 flex border-t border-hairline bg-surface pb-[env(safe-area-inset-bottom)] md:inset-y-0 md:start-0 md:end-auto md:w-56 md:flex-col md:gap-1 md:border-t-0 md:border-e md:p-3"
    >
      <div className="hidden px-3 pt-3 pb-5 text-heading font-bold md:block">قِسمة</div>
      {tabs.map(({ href, label, icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-label transition-colors md:min-h-0 md:flex-none md:flex-row md:justify-start md:gap-3 md:rounded-control md:px-3 md:py-2.5 md:text-base ${
              active ? "font-semibold text-ink md:bg-bg" : "text-muted hover:text-ink"
            }`}
          >
            <svg
              viewBox="0 0 24 24"
              className="size-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d={icon} />
            </svg>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
