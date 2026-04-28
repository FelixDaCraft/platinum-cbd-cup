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
            <RotatingEmblem rotationSpeed={rotationSpeed} />
          </Center>
          <Environment preset="city" />
        </Suspense>
      </Canvas>
    </div>
  );
}

function RotatingEmblem({ rotationSpeed }: { rotationSpeed: number }) {
  const ref = useRef<Group>(null);
  const { scene } = useGLTF(MODEL_URL);

  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta * rotationSpeed;
    }
  });

  return (
    <group ref={ref}>
      <primitive object={scene} />
    </group>
  );
}

// Pre-load so the model warms before the home page mounts the canvas.
useGLTF.preload(MODEL_URL);
