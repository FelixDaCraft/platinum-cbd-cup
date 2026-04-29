"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { GeometricEmblem } from "~/components/portal/platinum/geometric-emblem";

interface MobileHomeHeroProps {
  /** "EDITION 04" — already formatted by the page-level loader. */
  edition: string;
  /** "Inscriptions ouvertes" — already translated FR. */
  state: string;
  primaryCta: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
}

const TOPBAR_PX = 56; // matches the mobile topbar height (10px padding × 2 + ~36px logo row)
const BOTTOMNAV_PX = 56;
const MIN_HEADROOM = 120; // safe-area + breathing for the 3D canvas

/**
 * Mobile-only hero (≤880px) for the public portal home page.
 *
 * Renders the GeometricEmblem as a fixed full-viewport canvas behind the page,
 * then drives its scale + opacity from the document scroll position so the 3D
 * "lifts off" as the user scrolls into the rest of the page. The factual hero
 * content (eyebrow + H1 + lede + CTAs) is overlaid in normal flow on top of
 * the canvas, occupying one viewport-tall section so the scroll has somewhere
 * to land before the next page section.
 *
 * The canvas is unmounted via IntersectionObserver once it leaves the
 * viewport, so the rest of the home page (countdown, ticker, categories) does
 * not pay the WebGL cost. It re-mounts on scroll-back.
 *
 * Honours `prefers-reduced-motion: reduce` by freezing rotation and skipping
 * the scroll-driven transform.
 */
export function MobileHomeHero({
  edition,
  state,
  primaryCta,
  secondaryCta,
}: MobileHomeHeroProps) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [emblemSize, setEmblemSize] = useState(360);
  const [scrollY, setScrollY] = useState(0);
  const [inView, setInView] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);

  // Compute a viewport-aware emblem size. We want the model to fill most of
  // the available space between the topbar and the bottom nav, but stay
  // square so the metallic highlights stay coherent.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const compute = () => {
      const w = window.innerWidth;
      const h = window.innerHeight - TOPBAR_PX - BOTTOMNAV_PX - MIN_HEADROOM;
      // 92% of the smaller side keeps a small breathing margin on the edges.
      const next = Math.max(240, Math.min(w, h) * 0.92);
      setEmblemSize(Math.round(next));
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);

  // Honour prefers-reduced-motion: freeze rotation + skip scroll transform.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mql.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  // Track scroll for the parallax scale/opacity drive.
  useEffect(() => {
    if (reducedMotion) return;
    const handler = () => setScrollY(window.scrollY);
    handler();
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, [reducedMotion]);

  // Unmount the canvas once the hero section is fully out of view to free
  // up the WebGL context for the rest of the page.
  useEffect(() => {
    const node = sectionRef.current;
    if (!node) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry) setInView(entry.isIntersecting);
      },
      { threshold: 0, rootMargin: "200px 0px 200px 0px" },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, []);

  // Map scroll [0, 480px] → scale [1, 0.55] and opacity [1, 0.12].
  // The 480px window approximates one full viewport scroll on a 14 Pro,
  // so by the time the user has scrolled past the hero the 3D is fully
  // faded.
  const progress = reducedMotion ? 0 : Math.min(1, scrollY / 480);
  const scale = 1 - progress * 0.45;
  const opacity = 1 - progress * 0.88;

  return (
    <section
      ref={sectionRef}
      className="mobile-home-hero"
      aria-label="Platinum CBD Cup — hero"
    >
      {/* Fixed 3D backdrop — sits BELOW the page content (z-index 0). The
          .page wrapper from PlatinumShell already establishes z-index: 1,
          so we're guaranteed to render under text without explicit positioning
          on every overlay. */}
      {inView && (
        <div
          className="mobile-home-hero__canvas"
          style={{
            transform: `scale(${scale.toFixed(3)})`,
            opacity: opacity.toFixed(3),
          }}
        >
          <GeometricEmblem
            size={emblemSize}
            tiltZ={-0.18}
            interactive={!reducedMotion}
            rotationSpeed={reducedMotion ? 0 : 0.18}
          />
        </div>
      )}

      {/* Foreground content — eyebrow above the 3D, H1 + lede + CTAs below.
          The whole section is min-height 100svh so the 3D fills the screen
          on initial load, and the next page section starts after a full
          scroll. */}
      <div className="mobile-home-hero__content">
        <div className="mobile-home-hero__eyebrow">
          <span className="mobile-home-hero__eyebrow-tag">{edition}</span>
          <span aria-hidden="true">·</span>
          <span>{state}</span>
        </div>

        <div className="mobile-home-hero__hint" aria-hidden="true">
          {reducedMotion ? "" : "// drag to explore"}
        </div>

        <div className="mobile-home-hero__below">
          <h1 className="display mobile-home-hero__title">
            Platinum
            <br />
            <em>CBD Cup</em> 2026.
          </h1>

          <div className="mobile-home-hero__sub mono">
            · Europe · Independent · Blind ·
          </div>

          <div className="mobile-home-hero__cta">
            <Link href={primaryCta.href} className="btn accent">
              {primaryCta.label} <span className="btn-arrow">→</span>
            </Link>
            {secondaryCta && (
              <Link href={secondaryCta.href} className="btn ghost">
                {secondaryCta.label}
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
