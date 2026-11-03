"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "~/i18n/navigation";
import { localizePath, type Locale } from "~/i18n/locales";

interface EditionSelectProps {
  options: { value: string; label: string }[];
  current: string;
}

/**
 * Sélecteur d'édition du palmarès. Un formulaire GET classique : sans
 * JavaScript, le bouton « Afficher » soumet le choix ; avec, le changement
 * de valeur navigue directement.
 */
export function EditionSelect({ options, current }: EditionSelectProps) {
  const router = useRouter();
  const t = useTranslations("palmares");
  const locale = useLocale() as Locale;
  return (
    <form method="get" action={localizePath("/palmares", locale)} className="pal-edition">
      <label>
        {t("editionLabel")}
        <select
          name="edition"
          defaultValue={current}
          onChange={(e) => router.push(`/palmares?edition=${e.target.value}`, { scroll: false })}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <noscript>
        <button type="submit" className="btn ghost">
          {t("show")}
        </button>
      </noscript>
    </form>
  );
}
