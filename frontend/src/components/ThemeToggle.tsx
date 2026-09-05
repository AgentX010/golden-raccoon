"use client";

import { Contrast, Monitor, Moon, Sun } from "lucide-react";
import { useId } from "react";
import { themeModes, useTheme, type ThemeMode } from "@/theme/useTheme";

const themeLabels: Record<ThemeMode, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
  "high-contrast": "High contrast",
};

const themeIcons: Record<ThemeMode, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
  "high-contrast": Contrast,
};

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const groupId = useId();
  const ActiveIcon = themeIcons[theme];

  return (
    <fieldset
      className="flex items-center rounded-full border border-[var(--color-border)] bg-[var(--color-glass-bg)] p-1"
      aria-labelledby={groupId}
    >
      <legend id={groupId} className="sr-only">
        Color theme
      </legend>
      {themeModes.map((mode) => {
        const Icon = themeIcons[mode];
        const active = theme === mode;

        return (
          <button
            key={mode}
            type="button"
            onClick={() => setTheme(mode)}
            aria-pressed={active}
            aria-label={`${themeLabels[mode]} theme${active ? ", selected" : ""}`}
            title={themeLabels[mode]}
            className={`touch-target inline-flex h-9 w-9 min-h-0 min-w-0 items-center justify-center rounded-full transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)] ${
              active
                ? "bg-[var(--color-brand)] text-[var(--color-fg-inverse)]"
                : "text-[var(--color-nav-fg)] hover:bg-[var(--color-nav-hover-bg)] hover:text-[var(--color-fg)]"
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">{themeLabels[mode]}</span>
          </button>
        );
      })}
      <span className="sr-only" aria-live="polite">
        Current theme: {themeLabels[theme]}
      </span>
      <ActiveIcon className="sr-only" aria-hidden="true" />
    </fieldset>
  );
}
