import { Sun, Moon } from "lucide-react";
import type { ThemePreference } from "@/hooks/useTheme";

interface ThemeToggleProps {
  preference: ThemePreference;
  onChangeTheme: (theme: ThemePreference) => void;
}

export function ThemeToggle({ preference, onChangeTheme }: ThemeToggleProps) {
  const isDark = preference === "dim";

  return (
    <button
      className="btn btn-ghost btn-sm btn-square"
      onClick={() => onChangeTheme(isDark ? "cupcake" : "dim")}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}
