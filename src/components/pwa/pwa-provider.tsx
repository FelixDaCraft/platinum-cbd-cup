"use client";

import { useEffect } from "react";

interface PWAProviderProps {
  themeColor?: string;
  logoUrl?: string | null;
  children: React.ReactNode;
}

/**
 * Couleur de barre d'adresse par défaut. Elle était auparavant indexée par
 * « portail » (producer / jury / organizer / admin) — un vestige du SaaS
 * multi-tenant : les quatre entrées portaient déjà la même valeur.
 */
const DEFAULT_THEME_COLOR = "#d4af37";

/**
 * Icône iOS de repli. L'`apple-touch-icon` n'était posé que si un logo de
 * thème était fourni ; or le thème du portail renvoie null, donc aucune icône
 * n'était jamais déclarée et iOS tombait sur une capture d'écran générique.
 */
const FALLBACK_APPLE_TOUCH_ICON = "/brand/platinum-cbd-cup-logo.png";

/**
 * PWA Provider Component (single-tenant).
 *
 * Registers the service worker and wires up the static `/manifest.json`
 * shipped under `public/`. The dynamic `/api/pwa/manifest/[portal]` route
 * that this component used to hit no longer exists.
 *
 * Les balises sont encore posées depuis un effet, donc absentes du HTML
 * initial : l'endroit correct est l'API `metadata` de src/app/layout.tsx
 * (metadata.manifest, metadata.appleWebApp, metadata.icons.apple,
 * viewport.themeColor). Tant que ce n'est pas fait là-bas, les retirer d'ici
 * supprimerait purement et simplement le manifeste.
 */
export function PWAProvider({
  themeColor,
  logoUrl,
  children,
}: PWAProviderProps) {
  const finalThemeColor = themeColor ?? DEFAULT_THEME_COLOR;

  useEffect(() => {
    // Register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Service worker registration failed silently
      });
    }

    const upsertMeta = (name: string, content: string) => {
      let meta = document.querySelector(`meta[name="${name}"]`);
      if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute("name", name);
        document.head.appendChild(meta);
      }
      meta.setAttribute("content", content);
    };

    const upsertLink = (rel: string, href: string) => {
      let link = document.querySelector(`link[rel="${rel}"]`);
      if (!link) {
        link = document.createElement("link");
        link.setAttribute("rel", rel);
        document.head.appendChild(link);
      }
      link.setAttribute("href", href);
    };

    // Ne restent ici que les deux valeurs qui dépendent du thème chargé à
    // l'exécution. Le manifeste, `mobile-web-app-capable`, sa variante Apple
    // et la barre d'état sont désormais déclarés par l'API metadata dans
    // src/app/layout.tsx : les reposer ici produisait des balises en double.
    upsertMeta("theme-color", finalThemeColor);
    upsertLink("apple-touch-icon", logoUrl ?? FALLBACK_APPLE_TOUCH_ICON);
  }, [finalThemeColor, logoUrl]);

  return <>{children}</>;
}
