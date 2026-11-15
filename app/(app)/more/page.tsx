import Link from "next/link";

const links = [
  { href: "/history", label: "السجل" },
  { href: "/settings", label: "الإعدادات" },
];

export default function Page() {
  return (
    <>
      <h1 className="text-title font-bold">المزيد</h1>
      <ul className="mt-6 divide-y divide-hairline overflow-hidden rounded-card border border-hairline bg-surface">
        {links.map(({ href, label }) => (
          <li key={href}>
            <Link href={href} className="flex min-h-14 items-center justify-between px-4 font-medium">
              {label}
              <span aria-hidden className="text-muted">
                ‹
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
