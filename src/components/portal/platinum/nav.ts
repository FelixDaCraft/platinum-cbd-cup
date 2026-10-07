// ---------------------------------------------------------------------------
// Navigation — une seule source pour l'en-tête ; la barre mobile reprend les
// mêmes libellés (voir mobile-bottom-nav.tsx).
// ---------------------------------------------------------------------------

type NavEntry = {
  label: string;
  href: string;
  /** Préfixe de chemin qui rend l'entrée active. */
  match: string;
  /**
   * Largeur (px) sous laquelle l'en-tête bureau masque l'entrée, faute de
   * place sur une ligne. Réservé aux liens repris dans le pied de page.
   */
  hideBelow?: 960 | 1024;
};

export const PORTAL_NAV: NavEntry[] = [
  { label: "Le concours", href: "/about", match: "/about", hideBelow: 960 },
  { label: "Participer", href: "/cups", match: "/cups" },
  { label: "Palmarès", href: "/palmares", match: "/palmares" },
  { label: "Éditions", href: "/archives", match: "/archives" },
  { label: "Presse", href: "/press", match: "/press", hideBelow: 1024 },
];

export function isNavActive(entry: { match: string }, pathname: string): boolean {
  if (entry.match === "/") return pathname === "/";
  return pathname === entry.match || pathname.startsWith(`${entry.match}/`);
}

/** Espace personnel selon le rôle du compte connecté. */
export function accountHref(role: string | undefined): string {
  if (role === "organizer" || role === "admin") return "/dashboard";
  if (role === "jury") return "/jury/dashboard";
  if (role === "producer") return "/producer/dashboard";
  return "/login";
}
