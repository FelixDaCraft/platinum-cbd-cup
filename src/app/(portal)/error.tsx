"use client";

import { useEffect } from "react";
import Link from "next/link";

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
  useEffect(() => {
    // Seule trace côté client d'une erreur de rendu ; le `digest` permet de
    // la relier à la ligne correspondante dans les logs du serveur.
    console.error("[Portail] Erreur de rendu", error.digest ?? "", error);
  }, [error]);

  return (
    <div className="pg pg--narrow page-enter">
      <header className="pg-head">
        <h1 className="display">Une erreur est survenue</h1>
        <p className="pg-lede">
          Cette page n&apos;a pas pu s&apos;afficher. Le problème vient de notre
          côté et a été enregistré. Vous pouvez réessayer dans un instant ou
          revenir à l&apos;accueil.
        </p>
      </header>

      <div className="home-actions">
        <Link href="/" className="btn accent">
          Retour à l&apos;accueil <span className="btn-arrow">→</span>
        </Link>
        <button type="button" onClick={reset} className="btn ghost">
          Réessayer
        </button>
      </div>

      <p className="pg-meta" style={{ marginTop: 32, marginBottom: 0 }}>
        Le problème persiste ?{" "}
        <Link href="/contact" className="pg-link">
          Contactez-nous
        </Link>
        {error.digest ? (
          <>
            {" "}
            en indiquant la référence <b style={{ color: "var(--fg-2)" }}>{error.digest}</b>.
          </>
        ) : (
          "."
        )}
      </p>
    </div>
  );
}
