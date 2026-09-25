"use client";

import dynamic from "next/dynamic";

/**
 * Code-split wrapper around <GeometricEmblem />. The Three.js + R3F + drei
 * bundle is ~1 MB minified; without `dynamic({ ssr: false })` it ships with
 * every page that statically imports the emblem (home, palmares, mobile
 * variants). With this wrapper the bundle is fetched only when the
 * component actually mounts on the client.
 *
 * SSR is disabled because Three.js needs `window` to initialize.
 *
 * Ce module ne doit contenir aucun effet de bord : il est importé
 * statiquement par le barrel platinum, donc par pratiquement toutes les
 * pages. Le filtre dev-only du bruit GLTFLoader vit dans geometric-emblem.tsx,
 * dans un effet du composant.
 */
export const GeometricEmblem = dynamic(
  () =>
    import("./geometric-emblem").then((m) => ({ default: m.GeometricEmblem })),
  { ssr: false },
);
