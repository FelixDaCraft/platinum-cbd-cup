"use client";

import { Suspense, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, Environment, Center, OrbitControls } from "@react-three/drei";
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
}

/**
 * Hero centerpiece — slowly rotating GLB emblem.
 *
 * Replaces the previous CSS-3D PlatinumTrophy. Uses @react-three/fiber +
 * Drei to render the .glb on a transparent canvas, with a soft halo glow
 * behind, a ground shadow that matches the rest of the brand vibe, and
 * an Environment HDRI ("city") to give the metallic/PBR materials some
 * specular life without needing custom lights.
 */
export function GeometricEmblem({
  size = 420,
  glow = true,
  rotationSpeed = 0.18,
  tiltZ = 0,
  tiltX = 0,
}: GeometricEmblemProps) {
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
          cursor: CURSOR_IDLE,
          touchAction: "none",
        }}
        onPointerDown={(e) => {
          (e.currentTarget as HTMLDivElement).style.cursor = CURSOR_ACTIVE;
        }}
        onPointerUp={(e) => {
          (e.currentTarget as HTMLDivElement).style.cursor = CURSOR_IDLE;
        }}
        onPointerLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.cursor = CURSOR_IDLE;
        }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[3, 4, 5]} intensity={1.1} />
        <directionalLight position={[-3, 2, -3]} intensity={0.4} />

        <Suspense fallback={null}>
          <Center>
            <RotatingEmblem
              rotationSpeed={rotationSpeed}
              tiltZ={tiltZ}
              tiltX={tiltX}
            />
          </Center>
          <Environment preset="city" />
        </Suspense>

        {/* Drag-to-orbit. Auto-rotation comes from useFrame on the model
            itself, so the camera stays put when no one's interacting and
            the off-axis spin keeps going. Pan and zoom are off — pure
            orientation play. */}
        <OrbitControls
          enablePan={false}
          enableZoom={false}
          enableDamping
          dampingFactor={0.08}
          rotateSpeed={0.7}
        />
      </Canvas>
    </div>
  );
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
  const { scene } = useGLTF(MODEL_URL);

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
useGLTF.preload(MODEL_URL);
