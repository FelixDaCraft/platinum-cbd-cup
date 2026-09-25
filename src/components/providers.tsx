"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "~/components/ui/sonner";
import { TRPCReactProvider } from "~/trpc/react";

/**
 * `nonce` vient du middleware, via l'en-tête de requête que Next lit déjà pour
 * poser le nonce sur ses propres balises. next-themes, lui, injecte un script
 * inline d'initialisation du thème (il doit s'exécuter avant l'hydratation,
 * sinon la page s'affiche en clair puis bascule) et Next ne peut pas le
 * connaître : sans ce prop, ce script est le seul de l'application à ne pas
 * porter le nonce. Il apparaîtrait alors dans CHAQUE signalement de la CSP
 * Report-Only — au point de rendre l'observation inexploitable — et serait
 * bloqué le jour du basculement, ce qui rendrait le thème faux sur tout le
 * site.
 */
export function Providers({
  children,
  nonce,
}: {
  children: React.ReactNode;
  nonce?: string;
}) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
      nonce={nonce}
    >
      <TRPCReactProvider>
        {children}
        <Toaster richColors position="top-right" />
      </TRPCReactProvider>
    </ThemeProvider>
  );
}
