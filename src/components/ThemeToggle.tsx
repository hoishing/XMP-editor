import { Sun, Moon, Monitor } from "lucide-react";
import type { ThemePreference } from "@/hooks/useTheme";

interface ThemeToggleProps {
  preference: ThemePreference;
  onChangeTheme: (theme: ThemePreference) => void;
}

const options: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "system", label: "System", icon: Monitor },
  { value: "cupcake", label: "Light", icon: Sun },
  { value: "dim", label: "Dark", icon: Moon },
];

export function ThemeToggle({ preference, onChangeTheme }: ThemeToggleProps) {
  const currentOption =
    options.find((o) => o.value === preference) ?? options[0];
  const CurrentIcon = currentOption.icon;

  return (
    <details className="dropdown dropdown-end">
      <summary className="btn btn-ghost btn-sm btn-square">
        <CurrentIcon className="size-4" />
      </summary>
      <ul className="dropdown-content menu bg-base-200 rounded-box z-10 w-40 p-2 shadow-sm">
        {options.map((opt) => (
          <li key={opt.value}>
            <button
              className={preference === opt.value ? "active" : ""}
              onClick={(e) => {
                onChangeTheme(opt.value);
                (e.currentTarget.closest("details") as HTMLDetailsElement).open =
                  false;
              }}
            >
              <opt.icon className="size-4" />
              {opt.label}
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
