"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  useGLTF,
  Environment,
  Lightformer,
  Center,
  OrbitControls,
} from "@react-three/drei";
import type { Group } from "three";

const MODEL_URL = "/models/geometric-emblem.glb";

// ─── Custom reticle cursor (matches the topbar live indicator vocabulary)
// Both states are 32×32 SVGs encoded as base64 data URLs. Hot-spot is
// centered at (16, 16). Idle = muted off-white outline, no glow. Active =
// accent-gold stroke + soft Gaussian glow halo. Native `grab/grabbing`
// kept as fallback for browsers that refuse data-URL SVG cursors.
const CURSOR_HOTSPOT_X = 16;
const CURSOR_HOTSPOT_Y = 16;
const CURSOR_IDLE_B64 =
  "PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiIgdmlld0JveD0iMCAwIDMyIDMyIj48ZyBmaWxsPSJub25lIiBzdHJva2U9InJnYmEoMjQyLDI0MiwyNDIsMC42KSIgc3Ryb2tlLXdpZHRoPSIxIj48Y2lyY2xlIGN4PSIxNiIgY3k9IjE2IiByPSI1Ii8+PGxpbmUgeDE9IjgiIHkxPSIxNiIgeDI9IjI0IiB5Mj0iMTYiLz48bGluZSB4MT0iMTYiIHkxPSI4IiB4Mj0iMTYiIHkyPSIyNCIvPjwvZz48L3N2Zz4=";
const CURSOR_ACTIVE_B64 =
  "PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiIgdmlld0JveD0iMCAwIDMyIDMyIj48ZGVmcz48ZmlsdGVyIGlkPSJnIiB4PSItNTAlIiB5PSItNTAlIiB3aWR0aD0iMjAwJSIgaGVpZ2h0PSIyMDAlIj48ZmVHYXVzc2lhbkJsdXIgc3RkRGV2aWF0aW9uPSIxLjQiIHJlc3VsdD0iYiIvPjxmZU1lcmdlPjxmZU1lcmdlTm9kZSBpbj0iYiIvPjxmZU1lcmdlTm9kZSBpbj0iU291cmNlR3JhcGhpYyIvPjwvZmVNZXJnZT48L2ZpbHRlcj48L2RlZnM+PGcgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZDRhZjM3IiBzdHJva2Utd2lkdGg9IjEuNCIgZmlsdGVyPSJ1cmwoI2cpIj48Y2lyY2xlIGN4PSIxNiIgY3k9IjE2IiByPSI1Ii8+PGxpbmUgeDE9IjgiIHkxPSIxNiIgeDI9IjI0IiB5Mj0iMTYiLz48bGluZSB4MT0iMTYiIHkxPSI4IiB4Mj0iMTYiIHkyPSIyNCIvPjwvZz48L3N2Zz4=";
const CURSOR_IDLE = `url("data:image/svg+xml;base64,${CURSOR_IDLE_B64}") ${CURSOR_HOTSPOT_X} ${CURSOR_HOTSPOT_Y}, grab`;
const CURSOR_ACTIVE = `url("data:image/svg+xml;base64,${CURSOR_ACTIVE_B64}") ${CURSOR_HOTSPOT_X} ${CURSOR_HOTSPOT_Y}, grabbing`;

interface GeometricEmblemProps {
  size?: number;
  /** Background halo glow behind the model. */
  glow?: boolean;
  /** Rotation speed in radians per second (default = 0.18 ~ slow elegant). */
  rotationSpeed?: number;
  /**
   * Static Z-axis tilt in radians. Negative leans the top toward the
   * right (top-right / bottom-left) — viewer's perspective.
   */
  tiltZ?: number;
  /** Static X-axis tilt in radians. Positive tips the top toward the camera. */
  tiltX?: number;
  /**
   * Drag-to-orbit + reticle cursor. Default true.
   * Set false when using the emblem as a passive background decoration
   * — disables OrbitControls, lets pointer events fall through to the
   * content sitting behind, and removes the reticle cursor.
   */
  interactive?: boolean;
}

/**
 * Hero centerpiece — slowly rotating GLB emblem.
 *
 * Replaces the previous CSS-3D PlatinumTrophy. Uses @react-three/fiber +
 * Drei to render the .glb on a transparent canvas, with a soft halo glow
 * behind, a ground shadow that matches the rest of the brand vibe, and
 * a procedural <Environment> (Lightformer softboxes, zero network payload)
 * to give the metallic/PBR materials some specular life.
 */
export function GeometricEmblem({
  size = 420,
  glow = true,
  rotationSpeed = 0.18,
  tiltZ = 0,
  tiltX = 0,
  interactive = true,
}: GeometricEmblemProps) {
  useSilenceGltfTextureNoise();

  // La rotation est pilotée par useFrame, hors d'atteinte de la règle CSS
  // globale prefers-reduced-motion : il faut la couper ici (WCAG 2.3.3).
  const reducedMotion = usePrefersReducedMotion();
  const effectiveRotationSpeed = reducedMotion ? 0 : rotationSpeed;

  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        display: "grid",
        placeItems: "center",
      }}
    >
      {/* Halo glow behind */}
      {glow && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: "8%",
            background:
              "radial-gradient(circle, var(--accent-glow) 0%, rgba(212,175,55,.06) 45%, transparent 70%)",
            filter: "blur(22px)",
            pointerEvents: "none",
          }}
        />
      )}

      {/* Ground shadow */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          bottom: "10%",
          left: "20%",
          right: "20%",
          height: 22,
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,.45) 0%, transparent 70%)",
          filter: "blur(8px)",
          animation: "shadowPulse 8s ease-in-out infinite",
        }}
      />

      <Canvas
        camera={{ position: [0, 0.6, 4.2], fov: 35 }}
        gl={{ antialias: true, alpha: true }}
        style={{
          position: "relative",
          zIndex: 1,
          cursor: interactive ? CURSOR_IDLE : "default",
          touchAction: "none",
          pointerEvents: interactive ? "auto" : "none",
        }}
        {...(interactive
          ? {
              onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
                (e.currentTarget as HTMLDivElement).style.cursor = CURSOR_ACTIVE;
              },
              onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => {
                (e.currentTarget as HTMLDivElement).style.cursor = CURSOR_IDLE;
              },
              onPointerLeave: (e: React.PointerEvent<HTMLDivElement>) => {
                (e.currentTarget as HTMLDivElement).style.cursor = CURSOR_IDLE;
              },
            }
          : {})}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[3, 4, 5]} intensity={1.1} />
        <directionalLight position={[-3, 2, -3]} intensity={0.4} />

        {/* Environnement procédural, hors <Suspense> : rien à télécharger, donc
            rien qui suspende, et le PMREM n'est plus rejoué quand le GLB finit
            de charger. Il remplace un HDR de 1,5 Mo, depuis supprimé du dépôt (RGBE, un format
            que gzip/brotli ne compriment quasiment pas) : sur la
            home mobile c'était l'élément le plus lourd de la page, pour un simple
            reflet sur un objet unique. Quatre softbox suffisent à donner sa vie
            spéculaire au métal. */}
        <Environment resolution={128}>
          {/* Sans fond, le cube de réflexion est noir pur et l'or vire au
              charbon : ce gris très sombre lui rend sa profondeur. */}
          <color attach="background" args={["#14141a"]} />
          {/* Key : grande surface chaude au-dessus et légèrement en avant. */}
          <Lightformer
            form="rect"
            intensity={3}
            position={[0, 4, 2]}
            scale={[8, 6, 1]}
            color="#fff6e2"
          />
          {/* Rim or en contre-plongée gauche — rappelle l'accent de la charte. */}
          <Lightformer
            form="rect"
            intensity={2.2}
            position={[-4.5, -1, 2]}
            scale={[5, 4, 1]}
            color="#d4af37"
          />
          {/* Contre-jour froid à droite : détache la silhouette du fond sombre. */}
          <Lightformer
            form="rect"
            intensity={1.4}
            position={[5, 1, -3]}
            scale={[5, 5, 1]}
            color="#9fb2d4"
          />
          {/* Bandeau horizontal : c'est lui qui produit la ligne de spéculaire
              qui balaie les facettes pendant la rotation. */}
          <Lightformer
            form="rect"
            intensity={1.8}
            position={[0, 0.4, 5]}
            scale={[10, 0.6, 1]}
            color="#ffffff"
          />
        </Environment>

        <Suspense fallback={null}>
          <Center>
            <RotatingEmblem
              rotationSpeed={effectiveRotationSpeed}
              tiltZ={tiltZ}
              tiltX={tiltX}
            />
          </Center>
        </Suspense>

        {/* Drag-to-orbit (interactive mode only). Auto-rotation comes from
            useFrame on the model itself, so the camera stays put when no
            one's interacting and the off-axis spin keeps going. Pan and
            zoom are off — pure orientation play. */}
        {interactive && (
          <OrbitControls
            enablePan={false}
            enableZoom={false}
            enableDamping
            dampingFactor={0.08}
            rotateSpeed={0.7}
          />
        )}
      </Canvas>
    </div>
  );
}

// ─── Filtre de bruit dev-only du GLTFLoader ────────────────────────────────
// Le cache `useGLTF` de Drei + le double montage du Strict Mode + le HMR de
// Next font perdre la course au GLTFLoader, qui journalise
//   "THREE.GLTFLoader: Couldn't load texture blob:http://..."
// quand le composant est démonté avant la fin du parsing des textures. Le
// Canvas réessaie au remontage et le modèle s'affiche correctement, mais
// l'overlay d'erreur de Next transforme chaque console.error en modale
// bloquante, ce qui ruine la boucle d'itération.
//
// Cette mutation de `console.error` était auparavant exécutée à l'import du
// module enveloppe (geometric-emblem-lazy) : importer un composant altérait le
// logging global de toute l'application. Elle vit désormais dans un effet du
// composant 3D lui-même — donc seulement pendant qu'un emblème est monté, en
// développement, et l'original est restauré au démontage.
//
// Le compteur gère les emblèmes multiples (home + backdrop mobile) : seul le
// dernier démontage restaure `console.error`.
let gltfNoiseFilterMounts = 0;
let consoleErrorBeforeFilter: typeof console.error | null = null;

function useSilenceGltfTextureNoise() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    if (gltfNoiseFilterMounts++ === 0) {
      const original = console.error;
      consoleErrorBeforeFilter = original;
      console.error = (...args: unknown[]) => {
        // Three.js passe le préfixe et le message en arguments séparés
        // ("THREE.GLTFLoader:", "Couldn't load texture blob:...") : on ne peut
        // pas se contenter d'inspecter args[0].
        const joined = args
          .map((a) => (typeof a === "string" ? a : ""))
          .join(" ");
        if (joined.includes("Couldn't load texture blob:")) return;
        return original.apply(console, args as []);
      };
    }

    return () => {
      if (--gltfNoiseFilterMounts === 0 && consoleErrorBeforeFilter) {
        console.error = consoleErrorBeforeFilter;
        consoleErrorBeforeFilter = null;
      }
    };
  }, []);
}

/**
 * Suit `prefers-reduced-motion` de façon réactive (l'utilisateur peut changer
 * le réglage système sans recharger la page). Faux au premier rendu pour que
 * SSR et hydratation concordent.
 */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mql.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  return reduced;
}

function RotatingEmblem({
  rotationSpeed,
  tiltZ,
  tiltX,
}: {
  rotationSpeed: number;
  tiltZ: number;
  tiltX: number;
}) {
  const spinRef = useRef<Group>(null);
  const { scene } = useGLTF(MODEL_URL, true, true);

  useFrame((_, delta) => {
    if (spinRef.current) {
      spinRef.current.rotation.y += delta * rotationSpeed;
    }
  });

  // Outer group holds the static tilt in world space; inner group spins
  // around its (now-tilted) local Y axis — gives the off-axis wobble look.
  return (
    <group rotation={[tiltX, 0, tiltZ]}>
      <group ref={spinRef}>
        <primitive object={scene} />
      </group>
    </group>
  );
}

// Pre-load so the model warms before the home page mounts the canvas.
// Args: (path, useDraco, useMeshOpt). The GLB is compressed with EXT_meshopt
// + KHR_mesh_quantization + EXT_texture_webp via gltf-transform — Meshopt
// decoder must be enabled or the geometry won't decode.
useGLTF.preload(MODEL_URL, true, true);
