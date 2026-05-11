"use client";

import { useEffect, useState } from "react";
import { GeometricEmblem } from "~/components/portal/platinum/geometric-emblem-lazy";
import { useMediaQuery } from "~/lib/hooks/use-media-query";

/**
 * Mobile-only fixed-viewport 3D backdrop for the palmarès page (≤880px).
 *
 * Replaces the desktop top-right 735px emblem with a full-viewport ghost
 * canvas at low opacity, sized to fit between the topbar and bottom nav.
 * Non-interactive (the page content scrolls on top of it). Mounts only on
 * mobile so desktop rendering is untouched.
 *
 * When the page contains an element marked with `data-best-in-show`, the
 * backdrop briefly intensifies (opacity bump + subtle scale pulse) while
 * that element is on screen — a small celebratory beat that ties the 3D
 * to the page's editorial hierarchy.
 *
 * Honours `prefers-reduced-motion: reduce` by holding a static frame and
 * skipping the pulse animation.
 */
export function MobilePalmaresBackdrop() {
  const isMobile = useMediaQuery("(max-width: 880px)");
  const [pulsing, setPulsing] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [size, setSize] = useState(420);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const compute = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setSize(Math.round(Math.min(w, h) * 1.05));
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mql.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  // Watch for the Best-in-Show element entering the viewport so we can
  // pulse the backdrop while it's on screen.
  useEffect(() => {
    if (!isMobile || reducedMotion) return;
    const target = document.querySelector("[data-best-in-show]");
    if (!target) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry) setPulsing(entry.isIntersecting);
      },
      { threshold: 0.35 },
    );
    obs.observe(target);
    return () => obs.disconnect();
  }, [isMobile, reducedMotion]);

  // Don't mount on desktop — the existing fixed top-right emblem keeps
  // doing its job above the breakpoint.
  if (!isMobile) return null;

  return (
    <div
      aria-hidden="true"
      className={`mobile-palmares-backdrop${pulsing ? " is-pulsing" : ""}`}
    >
      <GeometricEmblem
        size={size}
        tiltZ={-0.18}
        interactive={false}
        rotationSpeed={reducedMotion ? 0 : 0.12}
        glow={false}
      />
    </div>
  );
}
