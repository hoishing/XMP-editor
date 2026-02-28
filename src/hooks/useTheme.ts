import { useState, useCallback, useEffect } from "react";

export type ThemePreference = "system" | "cupcake" | "dim";

const STORAGE_KEY = "theme";

function getInitialPreference(): ThemePreference {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === "cupcake" || saved === "dim") return saved;
  return "system";
}

function applyTheme(preference: ThemePreference): void {
  if (preference === "system") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", preference);
  }
}

export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>(
    getInitialPreference
  );

  const setTheme = useCallback((next: ThemePreference) => {
    setPreference(next);
    if (next === "system") {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, next);
    }
    applyTheme(next);
  }, []);

  useEffect(() => {
    applyTheme(preference);
  }, [preference]);

  return { preference, setTheme } as const;
}
