import { useCallback, useEffect, useState } from "react";

export type Locale = "en" | "es";

const STORAGE_KEY = "imago.locale";
const SUPPORTED: readonly Locale[] = ["en", "es"] as const;

function isLocale(value: string | null): value is Locale {
  return value !== null && (SUPPORTED as readonly string[]).includes(value);
}

export function detectLocale(): Locale {
  if (typeof window === "undefined") return "en";

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isLocale(stored)) return stored;
  } catch {
    // localStorage may be unavailable (private mode); fall through.
  }

  const nav = typeof navigator !== "undefined" ? navigator.language : "";
  return nav.toLowerCase().startsWith("es") ? "es" : "en";
}

export function useLocale(): { locale: Locale; setLocale: (next: Locale) => void } {
  const [locale, setLocaleState] = useState<Locale>(() => detectLocale());

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  return { locale, setLocale };
}

/**
 * Build a typed translator for a dictionary keyed by locale.
 *
 *   const dict = { en: { hi: "Hi" }, es: { hi: "Hola" } } as const;
 *   const t = createT(dict);
 *   t("en", "hi"); // "Hi"
 */
export function createT<TDict extends Record<Locale, Record<string, string>>>(
  dict: TDict
): <K extends keyof TDict["en"]>(locale: Locale, key: K) => string {
  return (locale, key) => {
    const table = dict[locale] ?? dict.en;
    return (table as Record<string, string>)[key as string] ?? (dict.en as Record<string, string>)[key as string] ?? "";
  };
}
