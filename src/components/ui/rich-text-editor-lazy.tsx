"use client";

import dynamic from "next/dynamic";

/**
 * Enveloppe à chargement différé autour de <RichTextEditor />.
 *
 * TipTap + ProseMirror pèsent ~370 Ko (≈115 Ko gz) répartis sur trois chunks.
 * Importés statiquement par article-form, ils entraient dans le First Load JS
 * de /dashboard/articles/new et /dashboard/articles/[articleId] (1 146 Ko
 * contre 490 Ko pour le layout racine).
 *
 * SSR désactivé : l'éditeur est déjà rendu en `immediatelyRender: false` pour
 * éviter les écarts d'hydratation, il n'a rien à produire côté serveur.
 */
export const RichTextEditor = dynamic(
  () =>
    import("./rich-text-editor").then((m) => ({ default: m.RichTextEditor })),
  {
    ssr: false,
    // Réserve la hauteur de l'éditeur (barre d'outils + zone de saisie) pour
    // ne pas décaler le formulaire quand le chunk arrive.
    loading: () => (
      <div
        className="flex min-h-[300px] items-center justify-center rounded-md border border-input bg-muted/20"
        aria-hidden="true"
      >
        <span className="text-sm text-muted-foreground">
          Chargement de l&apos;éditeur…
        </span>
      </div>
    ),
  },
);
