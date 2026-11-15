"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Icons are single 24x24 stroke paths.
// on: "both" = mobile bar and desktop rail, "mobile" / "desktop" = only there.
// Mobile shows five items (المزيد holds السجل and الإعدادات); desktop shows all six destinations.
const items = [
  { href: "/", label: "الرئيسية", on: "both", icon: "M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" },
  { href: "/investments", label: "الاستثمار", on: "both", icon: "M3 17l6-6 4 4 8-8M15 7h6v6" },
  { href: "/distribute", label: "توزيع", on: "both", primary: true, icon: "M3 8h18v8H3zM9 8v8M16 8v8" },
  {
    href: "/subscriptions",
    label: "الاشتراكات",
    on: "both",
    icon: "M17 2l4 4-4 4M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v1a4 4 0 0 1-4 4H3",
  },
  { href: "/more", label: "المزيد", on: "mobile", also: ["/history", "/settings"], icon: "M5 12h.01M12 12h.01M19 12h.01" },
  { href: "/history", label: "السجل", on: "desktop", icon: "M4 6h16M4 12h16M4 18h10" },
  {
    href: "/settings",
    label: "الإعدادات",
    on: "desktop",
    icon: "M4 7h9m4 0h3M4 17h3m4 0h9M15 4.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM9 14.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z",
  },
] as const;

const under = (pathname: string, href: string) =>
  href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

/** Bottom tab bar on mobile, side rail (inline-start) from md up. */
export function Nav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="التنقل الرئيسي"
      className="fixed inset-x-0 bottom-0 z-10 flex border-t border-hairline bg-surface pb-[env(safe-area-inset-bottom)] md:inset-y-0 md:start-0 md:end-auto md:w-56 md:flex-col md:gap-1 md:border-t-0 md:border-e md:p-3"
    >
      <div className="hidden px-3 pt-3 pb-5 text-heading font-bold md:block">قِسمة</div>
      {items.map((item) => {
        const active = [item.href, ...("also" in item ? item.also : [])].some((h) => under(pathname, h));
        const primary = "primary" in item;
        const show = item.on === "mobile" ? "flex md:hidden" : item.on === "desktop" ? "hidden md:flex" : "flex";
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`${show} min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 text-label transition-colors md:min-h-0 md:flex-none md:flex-row md:justify-start md:gap-3 md:rounded-control md:px-3 md:py-2.5 md:text-base ${
              active ? "font-semibold text-ink md:bg-bg" : "text-muted hover:text-ink"
            }`}
          >
            {/* The centre tab is the primary action: its icon sits in an accent disc on mobile. */}
            <span
              className={
                primary
                  ? "-mt-5 grid size-12 place-items-center rounded-full bg-accent text-on-accent ring-4 ring-surface md:mt-0 md:size-auto md:rounded-none md:bg-transparent md:text-inherit md:ring-0"
                  : "grid place-items-center"
              }
            >
              <svg
                viewBox="0 0 24 24"
                className="size-6"
                fill="none"
                stroke="currentColor"
                strokeWidth={item.href === "/more" ? 2.5 : 1.75}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d={item.icon} />
              </svg>
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
