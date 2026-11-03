"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Link } from "~/i18n/navigation";

/**
 * Frontière d'erreur du portail public.
 *
 * Sans ce fichier, la moindre exception de rendu (WebGL indisponible pour
 * l'emblème, base de données injoignable dans une page serveur) affichait
 * l'écran « Application error » de Next : blanc, en anglais, sans issue.
 */
export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errorPage");
  useEffect(() => {
    // Seule trace côté client d'une erreur de rendu ; le `digest` permet de
    // la relier à la ligne correspondante dans les logs du serveur.
    console.error("[Portail] Erreur de rendu", error.digest ?? "", error);
  }, [error]);

  return (
    <div className="pg pg--narrow page-enter">
      <header className="pg-head">
        <h1 className="display">{t("title")}</h1>
        <p className="pg-lede">{t("lede")}</p>
      </header>

      <div className="home-actions">
        <Link href="/" className="btn accent">
          {t("home")} <span className="btn-arrow">→</span>
        </Link>
        <button type="button" onClick={reset} className="btn ghost">
          {t("retry")}
        </button>
      </div>

      <p className="pg-meta" style={{ marginTop: 32, marginBottom: 0 }}>
        {t("persist")}{" "}
        <Link href="/contact" className="pg-link">
          {t("contact")}
        </Link>
        {error.digest ? (
          <>
            {" "}
            {t.rich("reference", {
              digest: error.digest,
              b: (c) => <b style={{ color: "var(--fg-2)" }}>{c}</b>,
            })}
          </>
        ) : (
          "."
        )}
      </p>
    </div>
  );
}
