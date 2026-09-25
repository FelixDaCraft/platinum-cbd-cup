"use client";

import { GeometricEmblem } from "~/components/portal/platinum";
import { useMediaQuery } from "~/lib/hooks/use-media-query";
import { RenderBoundary } from "./render-boundary";

/** Point de bascule partagé avec les feuilles de style des deux pages. */
const DESKTOP_QUERY = "(min-width: 881px)";

interface DesktopEmblemProps {
  size?: number;
  tiltZ?: number;
  interactive?: boolean;
}

/**
 * Emblème 3D réservé au bureau.
 *
 * L'accueil et le palmarès rendaient l'emblème desktop et la variante mobile
 * en même temps, l'un des deux étant simplement masqué par une media query.
 * Masqué en CSS, le canvas desktop restait monté sur téléphone : deux
 * contextes WebGL, deux boucles `useFrame`, deux calculs PMREM de l'HDRI, et
 * surtout deux montages de la même scène GLB — `useGLTF` renvoyant l'objet
 * `scene` mis en cache, le second `<primitive>` la détachait du premier, d'où
 * un emblème vide selon l'ordre de montage.
 *
 * Le rendu conditionnel remplace le masquage : sous 881px, rien n'est monté.
 * L'emblème étant purement décoratif, ne rien émettre côté serveur ne coûte
 * aucun contenu — le wrapper `GeometricEmblem` est déjà `ssr: false`.
 */
export function DesktopEmblem({ size, tiltZ, interactive }: DesktopEmblemProps) {
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  if (!isDesktop) return null;
  // L'emblème dépend de WebGL et d'un modèle GLB servi par le réseau : deux
  // sources d'échec qui, sans frontière ici, remontaient jusqu'à error.tsx et
  // remplaçaient l'accueil ou le palmarès entiers par un écran d'erreur.
  return (
    <RenderBoundary label="DesktopEmblem">
      <GeometricEmblem size={size} tiltZ={tiltZ} interactive={interactive} />
    </RenderBoundary>
  );
}
