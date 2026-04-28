"use client";

import { Suspense, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, Environment, Center } from "@react-three/drei";
import type { Group } from "three";

const MODEL_URL = "/models/geometric-emblem.glb";

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
        style={{ position: "relative", zIndex: 1 }}
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
