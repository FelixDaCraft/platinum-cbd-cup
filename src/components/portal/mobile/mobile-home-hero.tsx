"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { GeometricEmblem } from "~/components/portal/platinum/geometric-emblem-lazy";

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
 * the scroll-driven opacity fade.
 */
export function MobileHomeHero({
  edition,
  state,
  primaryCta,
  secondaryCta,
}: MobileHomeHeroProps) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [emblemSize, setEmblemSize] = useState(360);
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

  // Honour prefers-reduced-motion: freeze rotation + skip scroll opacity fade.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mql.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

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

  // Le fondu du canvas est écrit directement sur le DOM, cadencé par
  // requestAnimationFrame. Passer par un state React re-rendrait la section
  // entière — donc le sous-arbre GeometricEmblem/Canvas — à chaque événement
  // scroll, soit des dizaines de re-rendus par seconde concurrents de la
  // boucle WebGL, pour ne changer qu'une opacité.
  useEffect(() => {
    const node = canvasRef.current;
    if (!node) return;
    if (reducedMotion) {
      node.style.opacity = "1";
      return;
    }

    let frame = 0;
    const apply = () => {
      frame = 0;
      const target = canvasRef.current;
      if (!target) return;
      // Map scroll [0, 480px] → opacity [1, 0.22]. The 480px window
      // approximates one full viewport scroll on a 14 Pro. The emblem keeps
      // its size — only opacity fades — so it stays a constant presence
      // behind the page content. The 0.22 floor guarantees the logo remains
      // visibly transparent through subsequent sections rather than vanishing.
      const progress = Math.min(1, window.scrollY / 480);
      target.style.opacity = Math.max(0.22, 1 - progress * 0.78).toFixed(3);
    };

    apply();
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(apply);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
    // `inView` démonte et remonte le canvas : l'effet doit se réaccrocher au
    // nouveau nœud.
  }, [reducedMotion, inView]);

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
          ref={canvasRef}
          className="mobile-home-hero__canvas"
          // Valeur initiale ; l'effet ci-dessus prend la main dès le montage.
          style={{ opacity: 1 }}
        >
          <GeometricEmblem
            size={emblemSize}
            tiltZ={-0.18}
            interactive={false}
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
