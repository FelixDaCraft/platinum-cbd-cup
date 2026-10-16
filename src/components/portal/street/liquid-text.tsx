"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";

/**
 * Lettrage Unbounded « liquéfié » des visuels 2027 (PARTICIPANT, JURY, 2027…),
 * repris de platinum-visuels-2027/warp et de TexteLiquide (vidéo 2027).
 *
 * Les réglages d'origine valent pour une police de 260 px (fréquences
 * 0.004 / 0.01, flou 9, déplacement 0,5 × la taille) : le filtre est donc
 * recalculé sur la taille réellement rendue, qui suit la largeur d'écran.
 *
 * Mouvement : à l'entrée dans l'écran, le mot arrive très fondu puis se fige
 * (une seule fois) ; au survol, il « respire ». Rien de tout ça quand
 * l'utilisateur demande moins d'animations. Le texte reste du vrai texte.
 */

const REST = 0.5;
const IMPACT = 2.2;

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function LiquidText({
  as = "span",
  children,
  className,
  seed = 5,
  intensity = 1,
  settle = true,
  fit,
}: {
  as?: "span" | "h1" | "h2" | "h3" | "p" | "div";
  children: ReactNode;
  className?: string;
  seed?: number;
  /** Multiplie le déplacement au repos (0,6 = plus sage, 1,4 = plus fondu). */
  intensity?: number;
  /** Animation d'entrée « fondu puis figé ». */
  settle?: boolean;
  /**
   * Nombre de caractères du mot le plus long : la taille est alors plafonnée
   * pour que ce mot tienne dans la largeur du conteneur (voir .st-fit).
   */
  fit?: number;
}) {
  const id = `liq${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  // Toutes les balises admises partagent l'interface HTMLElement : on type
  // la balise dynamique comme un <div> pour la ref et les props.
  const Tag = as as "div";
  const ref = useRef<HTMLDivElement | null>(null);
  const dispRef = useRef<SVGFEDisplacementMapElement | null>(null);
  // Taille de police mesurée ; 0 tant qu'on ne l'a pas lue (rendu serveur).
  const [size, setSize] = useState(0);
  // L'entrée ne se joue qu'une fois par montage, même si la taille change.
  const played = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setSize(parseFloat(getComputedStyle(el).fontSize) || 0);
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const rest = size * REST * intensity;

  // Entrée : du très fondu au repos, une fois, quand le mot devient visible.
  useEffect(() => {
    const el = ref.current;
    const disp = dispRef.current;
    if (!el || !disp || !size || !settle || played.current || prefersReducedMotion()) return;
    let raf = 0;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        played.current = true;
        const start = performance.now();
        const from = size * IMPACT;
        disp.setAttribute("scale", String(from));
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / 1100);
          // Sortie exponentielle : l'essentiel de la prise se fait tôt.
          const e = 1 - Math.pow(2, -10 * t);
          disp.setAttribute("scale", String(from + (rest - from) * e));
          if (t < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [size, rest, settle]);

  // Survol : le lettrage respire autour de son état de repos.
  useEffect(() => {
    const el = ref.current;
    const disp = dispRef.current;
    if (!el || !disp || !size || prefersReducedMotion()) return;
    let raf = 0;
    let t0 = 0;
    const loop = (now: number) => {
      const k = Math.sin((now - t0) / 260);
      disp.setAttribute("scale", String(rest * (1 + 0.35 * k)));
      raf = requestAnimationFrame(loop);
    };
    const enter = () => {
      t0 = performance.now();
      raf = requestAnimationFrame(loop);
    };
    const leave = () => {
      cancelAnimationFrame(raf);
      disp.setAttribute("scale", String(rest));
    };
    el.addEventListener("pointerenter", enter);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointerenter", enter);
      el.removeEventListener("pointerleave", leave);
      cancelAnimationFrame(raf);
    };
  }, [size, rest]);

  const k = size ? 260 / size : 1;

  return (
    <Tag
      ref={ref}
      className={`st-liquid${fit ? " st-fit" : ""}${className ? ` ${className}` : ""}`}
      style={{
        ...(size ? { filter: `url(#${id})` } : {}),
        ...(fit ? ({ "--fit-chars": fit } as CSSProperties) : {}),
      }}
    >
      {size > 0 && (
        <svg width="0" height="0" aria-hidden="true" focusable="false" className="st-defs">
          <filter id={id} x="-10%" y="-25%" width="120%" height="150%" colorInterpolationFilters="sRGB">
            <feTurbulence
              type="fractalNoise"
              baseFrequency={`${0.004 * k} ${0.01 * k}`}
              numOctaves={1}
              seed={seed}
              result="n"
            />
            <feGaussianBlur in="n" stdDeviation={9 / k} result="t" />
            <feDisplacementMap
              ref={dispRef}
              in="SourceGraphic"
              in2="t"
              scale={rest}
              xChannelSelector="R"
              yChannelSelector="G"
              result="d"
            />
            {/* Le déplacement copie des pixels entiers : les bords sortent en
                escalier. Un léger flou puis un seuil doux sur l'opacité
                redessinent un contour lissé, à sa place d'origine. */}
            <feGaussianBlur in="d" stdDeviation={Math.max(0.6, size / 140)} result="s" />
            <feComponentTransfer in="s">
              <feFuncA type="linear" slope={5} intercept={-2} />
            </feComponentTransfer>
          </filter>
        </svg>
      )}
      {children}
    </Tag>
  );
}
