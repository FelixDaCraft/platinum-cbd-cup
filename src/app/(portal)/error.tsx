"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Eyebrow } from "~/components/portal/platinum";

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
    <div className="page-enter">
      <section
        style={{
          paddingTop: 72,
          paddingBottom: 72,
          maxWidth: 680,
          margin: "0 auto",
        }}
      >
        <Eyebrow>Erreur</Eyebrow>
        <h1 className="display" style={{ marginTop: 18, marginBottom: 12 }}>
          Une erreur est survenue<em>.</em>
        </h1>
        <p className="lede">
          Cette page n&apos;a pas pu s&apos;afficher. Le problème vient de notre
          côté et a été enregistré.
        </p>

        <div
          style={{
            display: "flex",
            gap: 12,
            marginTop: 36,
            flexWrap: "wrap",
          }}
        >
          <button type="button" onClick={reset} className="btn accent">
            Réessayer <span className="btn-arrow">→</span>
          </button>
          <Link href="/" className="btn ghost">
            Retour à l&apos;accueil
          </Link>
          <Link href="/contact" className="btn ghost">
            Nous contacter
          </Link>
        </div>

        {error.digest && (
          <p
            className="mono fg3"
            style={{ marginTop: 28, fontSize: 11, letterSpacing: ".1em" }}
          >
            RÉFÉRENCE · {error.digest}
          </p>
        )}
      </section>
    </div>
  );
}
