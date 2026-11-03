"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { usePathname } from "~/i18n/navigation";
import { intlLocale, locales, localeNames, type Locale } from "~/i18n/locales";

/**
 * Sélecteur de langue de l'en-tête (bureau et mobile).
 *
 * Chaque langue est un vrai lien `<a hreflang>` vers la même page
 * préfixée : il fonctionne sans JavaScript, et c'est le middleware qui
 * mémorise le choix dans le cookie NEXT_LOCALE en voyant le préfixe. Le
 * français passe donc aussi par `/fr/…`, qui pose le cookie puis redirige
 * vers l'URL sans préfixe.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const t = useTranslations("shell");
  const current = useLocale() as Locale;
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        rootRef.current?.querySelector("button")?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const query = searchParams.toString();
  const suffix = `${pathname === "/" ? "" : pathname}${query ? `?${query}` : ""}`;

  return (
    <div ref={rootRef} className={`st-lang${className ? ` ${className}` : ""}`}>
      <button
        type="button"
        className="st-lang-toggle"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={t("languageLabel", { language: localeNames[current] })}
        onClick={() => setOpen((v) => !v)}
      >
        <span aria-hidden="true">{current}</span>
        <svg aria-hidden="true" width="10" height="10" viewBox="0 0 10 10">
          <path d="M1 3l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      </button>
      <ul id={listId} className="st-lang-menu" hidden={!open}>
        {locales.map((locale) => (
          <li key={locale}>
            <a
              href={`/${locale}${suffix}`}
              hrefLang={intlLocale(locale)}
              lang={locale}
              aria-current={locale === current ? "true" : undefined}
              onClick={() => setOpen(false)}
            >
              <span className="st-lang-code" aria-hidden="true">{locale}</span>
              {localeNames[locale]}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
