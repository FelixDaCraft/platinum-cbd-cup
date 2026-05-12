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
 */

/**
 * Silence a known dev-only Three.js noise.
 *
 * The Drei `useGLTF` cache + React Strict Mode double-mount + Next dev
 * HMR race cause GLTFLoader to log
 *   "THREE.GLTFLoader: Couldn't load texture blob:http://..."
 * when the component unmounts before all embedded textures finish
 * parsing. The Canvas retries on remount and the model still renders
 * correctly, but Next.js' dev error overlay surfaces every console.error
 * as a blocking modal which hurts iteration speed.
 *
 * We filter exactly that prefix once, on the client, and leave every
 * other error untouched. No effect on the production build (no overlay
 * either way).
 */
if (typeof window !== "undefined") {
  const original = console.error;
  // Three.js passes the prefix and message as separate console.error args
  // ("THREE.GLTFLoader:", "Couldn't load texture blob:..."), so we can't
  // just inspect args[0]. Join everything stringly and look for the unique
  // substring instead.
  console.error = (...args: unknown[]) => {
    const joined = args
      .map((a) => (typeof a === "string" ? a : ""))
      .join(" ");
    if (joined.includes("Couldn't load texture blob:")) return;
    return original.apply(console, args as []);
  };
}

export const GeometricEmblem = dynamic(
  () =>
    import("./geometric-emblem").then((m) => ({ default: m.GeometricEmblem })),
  { ssr: false },
);
