import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import "./globals.css";

const plexArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-plex-arabic",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "قِسمة",
  description: "توزيع الدخل على البنود",
  appleWebApp: { capable: true, title: "قِسمة", statusBarStyle: "default" },
};

// Browser chrome follows the page background in each scheme.
// theme-toggle.tsx rewrites these when the user forces light or dark.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f5f1" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1113" },
  ],
};

// Runs before first paint so a saved light/dark choice never flashes the other theme.
// "system" (or nothing saved) leaves <html> without data-theme, and CSS follows the device.
const applySavedTheme = `try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: the script above may add data-theme before React hydrates.
    <html lang="ar" dir="rtl" className={`${plexArabic.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: applySavedTheme }} />
      </head>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
