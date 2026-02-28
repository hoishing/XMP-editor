import { useState, useCallback, useEffect } from "react";

export type ThemePreference = "cupcake" | "dim";

const STORAGE_KEY = "theme";

function getInitialPreference(): ThemePreference {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === "cupcake" || saved === "dim") return saved;
  return "dim";
}

function faviconSvg(color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="28" height="24" rx="4"/><circle cx="11" cy="12" r="3"/><path d="M30 22l-8-8-12 12"/></svg>`;
}

function applyTheme(preference: ThemePreference): void {
  document.documentElement.setAttribute("data-theme", preference);

  const color = preference === "dim" ? "#B2CBD6" : "#2A303C";
  const svg = faviconSvg(color);
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    link.type = "image/svg+xml";
    document.head.appendChild(link);
  }
  link.href = "data:image/svg+xml," + encodeURIComponent(svg);
}

export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>(
    getInitialPreference
  );

  const setTheme = useCallback((next: ThemePreference) => {
    setPreference(next);
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
  }, []);

  useEffect(() => {
    applyTheme(preference);
  }, [preference]);

  return { preference, setTheme } as const;
}
