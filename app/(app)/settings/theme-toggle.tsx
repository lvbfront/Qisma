"use client";

import { useSyncExternalStore } from "react";

type Theme = "system" | "light" | "dark";

const OPTIONS: [Theme, string][] = [
  ["system", "حسب الجهاز"],
  ["light", "فاتح"],
  ["dark", "داكن"],
];
const CHROME = { light: "#f6f5f1", dark: "#0f1113" };
const EVENT = "qisma-theme";

const read = (): Theme => {
  try {
    const saved = localStorage.getItem("theme");
    return saved === "light" || saved === "dark" ? saved : "system";
  } catch {
    return "system"; // storage blocked: the app simply follows the device
  }
};

const subscribe = (onChange: () => void) => {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
};

function apply(theme: Theme) {
  try {
    if (theme === "system") localStorage.removeItem("theme");
    else localStorage.setItem("theme", theme);
  } catch {
    // Not saved; it still applies until the page is reloaded.
  }
  const root = document.documentElement;
  if (theme === "system") delete root.dataset.theme;
  else root.dataset.theme = theme;
  // Keep the browser chrome (address bar, status bar) on the page background.
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
    const own = meta.media.includes("dark") ? "dark" : "light";
    meta.content = CHROME[theme === "system" ? own : theme];
  });
  window.dispatchEvent(new Event(EVENT));
}

/** Appearance: follow the device, or force light / dark. Saved on this device only. */
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, read, () => "system" as Theme);
  return (
    <fieldset>
      <legend className="block text-label font-medium">المظهر</legend>
      <div className="mt-1.5 grid grid-cols-3 gap-1 rounded-control border border-hairline bg-bg p-1">
        {OPTIONS.map(([value, label]) => (
          <label
            key={value}
            className="cursor-pointer rounded-lg px-2 py-2 text-center text-label font-medium text-muted has-checked:bg-surface has-checked:text-ink has-checked:shadow-sm has-focus-visible:ring-2 has-focus-visible:ring-accent"
          >
            <input type="radio" name="theme" className="sr-only" checked={theme === value} onChange={() => apply(value)} />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
