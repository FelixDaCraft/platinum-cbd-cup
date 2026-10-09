import type { JuryPanel } from "~/lib/enums";

/**
 * Habillage des deux grilles de critères (jury pro / jury public) dans le
 * back-office : libellés et couleur repère, pour qu'on sache toujours à quel
 * jury appartient une liste. Les couleurs ont un repli car les dialogues
 * (rendus en portail hors de `.nothing-org`) ne voient pas les variables --n-*.
 */
export const CRITERIA_PANELS: Record<
  JuryPanel,
  { label: string; short: string; accent: string; other: JuryPanel }
> = {
  pro: {
    label: "Jury professionnel",
    short: "Pro",
    accent: "var(--n-text-display, #FFFFFF)",
    other: "public",
  },
  public: {
    label: "Jury public",
    short: "Public",
    accent: "var(--n-interactive, #5B9BF6)",
    other: "pro",
  },
};

export const CRITERIA_PANEL_ORDER: readonly JuryPanel[] = ["pro", "public"];
