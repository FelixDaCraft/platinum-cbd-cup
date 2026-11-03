"use client";

import { useEffect } from "react";

/**
 * Sur mobile, les puces de catégorie défilent horizontalement : la catégorie
 * active (choisie par lien, donc après rechargement) pouvait se retrouver hors
 * de l'écran. On la ramène dans la zone visible, sans défilement vertical.
 */
export function ActiveChipIntoView({ activeId }: { activeId: string }) {
  useEffect(() => {
    const chip = document.querySelector<HTMLElement>('.pal-cats a[aria-current="true"]');
    chip?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [activeId]);
  return null;
}
