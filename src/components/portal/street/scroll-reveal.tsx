"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Révélations au défilement du portail (DA « street » 2027).
 *
 * Le contenu est visible par défaut : seuls les éléments situés sous la ligne
 * de flottaison au chargement reçoivent l'état caché (`rv`), puis `rv-in`
 * quand ils entrent dans l'écran. Sans JavaScript, ou quand l'utilisateur
 * demande moins d'animations, rien n'est masqué. Chaque élément n'est
 * observé qu'une fois.
 *
 * Les effets eux-mêmes sont en CSS (street-styles.ts, « Révélations ») :
 *   - rv-wipe  : filets et bandeaux qui se tracent de gauche à droite ;
 *   - rv-rise  : bloc qui monte en fondu ;
 *   - rv-row   : lignes de liste qui montent derrière un cache, en cascade ;
 *   - rv-slap  : étiquette d'échantillon posée comme un sticker.
 */

const TARGETS: [selector: string, kind: string][] = [
  // Seulement des blocs sans enfant animé : un parent coupé par son clip-path
  // cachait ses enfants à l'IntersectionObserver.
  [".st-edition, .pal-list", "rv-wipe"],
  [".st-sec-head, .st-head-lede, .st-close-text > :not(.st-liquid), .st-cats-cta, .st-sec > .st-link-arrow, .pg-section > h2, .pg-section > .prose, .pal-category-head, .pal-medals > h3, .eds-card", "rv-rise"],
  [".st-cats-list > li, .st-routes li, .st-steps .st-step, .st-podium > li, .pg-grid > *, .eds-past > li, .pal-others > a, .st-tiers > li", "rv-row"],
  [".st-sample", "rv-slap"],
];

/** Au-delà, une cascade paraît lente : on plafonne le décalage. */
const MAX_STAGGER = 8;

export function ScrollReveal() {
  const pathname = usePathname();

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!("IntersectionObserver" in window)) return;

    const timers: number[] = [];
    const release = (el: HTMLElement) => {
      el.classList.remove("rv", "rv-in", "rv-wipe", "rv-rise", "rv-row", "rv-slap");
      el.style.removeProperty("--rv-i");
      el.style.removeProperty("transition");
    };
    const armed = new Set<HTMLElement>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          el.classList.add("rv-in");
          io.unobserve(el);
          armed.delete(el);
          // Animation finie : on rend l'élément à ses propres styles, sinon
          // le clip-path et la transform figés brideraient ses survols.
          timers.push(window.setTimeout(() => release(el), 2000));
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0 },
    );

    // Le focus clavier ne doit jamais tomber sur un élément encore invisible.
    const onFocus = (e: FocusEvent) => {
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>(".rv:not(.rv-in)");
      if (!el) return;
      el.style.transition = "none";
      el.classList.add("rv-in");
      io.unobserve(el);
      armed.delete(el);
      timers.push(window.setTimeout(() => release(el), 50));
    };
    document.addEventListener("focusin", onFocus);

    const arm = () => {
      const fold = window.innerHeight;
      for (const [selector, kind] of TARGETS) {
        document.querySelectorAll<HTMLElement>(`.shell ${selector.split(", ").join(", .shell ")}`).forEach((el) => {
          if (el.dataset.rv) return;
          el.dataset.rv = "1";
          // Déjà à l'écran : on n'y touche pas, rien ne doit clignoter.
          if (el.getBoundingClientRect().top < fold) return;
          if (kind === "rv-row") {
            const index = Array.prototype.indexOf.call(el.parentElement?.children ?? [], el);
            el.style.setProperty("--rv-i", String(Math.min(Math.max(index, 0), MAX_STAGGER)));
          }
          el.classList.add("rv", kind);
          armed.add(el);
          io.observe(el);
        });
      }
    };

    // La page arrive parfois en deux temps (données, chargement différé) :
    // un second passage rattrape ce qui manquait au premier.
    const first = requestAnimationFrame(arm);
    const second = window.setTimeout(arm, 400);
    return () => {
      cancelAnimationFrame(first);
      window.clearTimeout(second);
      io.disconnect();
      document.removeEventListener("focusin", onFocus);
      timers.forEach((t) => window.clearTimeout(t));
      // Plus personne pour les révéler : on ne laisse rien de masqué.
      armed.forEach((el) => {
        el.classList.remove("rv", "rv-wipe", "rv-rise", "rv-row", "rv-slap");
        delete el.dataset.rv;
      });
    };
  }, [pathname]);

  return null;
}
