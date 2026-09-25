"use client";

import { useEffect } from "react";

/**
 * Dernier filet : erreur survenue dans le layout racine lui-même.
 *
 * Next remplace alors tout le document, y compris <html> et <body> — ce
 * fichier doit donc les rendre, et ne peut compter ni sur platinumCSS ni sur
 * les polices, injectés par le layout qui vient d'échouer. D'où les styles
 * en ligne, volontairement autonomes.
 *
 * Le cas est rare (les erreurs de page sont captées par (portal)/error.tsx),
 * mais sans ce fichier il produisait un écran blanc en anglais.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Global] Erreur de rendu racine", error.digest ?? "", error);
  }, [error]);

  return (
    <html lang="fr">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0a",
          color: "#f2f2f2",
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 520 }}>
          <p
            style={{
              fontSize: 11,
              letterSpacing: ".18em",
              textTransform: "uppercase",
              color: "#d4af37",
              margin: 0,
            }}
          >
            Platinum CBD Cup
          </p>
          <h1 style={{ fontSize: 32, lineHeight: 1.15, margin: "18px 0 12px" }}>
            Le site est momentanément indisponible.
          </h1>
          <p style={{ color: "#a3a3a3", lineHeight: 1.55, margin: 0 }}>
            Une erreur inattendue nous empêche d&apos;afficher cette page.
            Réessayez dans un instant.
          </p>

          <div style={{ display: "flex", gap: 12, marginTop: 32, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={reset}
              style={{
                border: "1px solid #d4af37",
                background: "#d4af37",
                color: "#0a0a0a",
                padding: "12px 20px",
                borderRadius: 8,
                cursor: "pointer",
                font: "inherit",
              }}
            >
              Réessayer
            </button>
            <a
              href="/"
              style={{
                border: "1px solid #3a3a3a",
                color: "#f2f2f2",
                padding: "12px 20px",
                borderRadius: 8,
                textDecoration: "none",
              }}
            >
              Retour à l&apos;accueil
            </a>
          </div>

          {error.digest && (
            <p
              style={{
                marginTop: 28,
                fontSize: 11,
                letterSpacing: ".1em",
                color: "#6b6b6b",
                fontFamily: "ui-monospace, monospace",
              }}
            >
              RÉFÉRENCE · {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
