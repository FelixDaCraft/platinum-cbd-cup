import type { RouterOutputs } from "~/trpc/react";

export type DirectoryPage = RouterOutputs["jury"]["listDirectory"];
export type DirectoryEntry = DirectoryPage["items"][number];
export type DirectoryCup = DirectoryEntry["cups"][number];
export type JuryPanel = DirectoryCup["panel"];
export type CupListItem = RouterOutputs["cup"]["list"][number];

export const panelShortLabel = (panel: JuryPanel) => (panel === "pro" ? "Pro" : "Public");
export const panelLongLabel = (panel: JuryPanel) =>
  panel === "pro" ? "Jury professionnel" : "Jury public";

export const PANEL_EXPLANATIONS: Record<JuryPanel, string> = {
  pro: "Experts de la filière : leurs notes forment le classement du jury professionnel.",
  public: "Amateurs et consommateurs : leurs notes forment le classement du jury public.",
};

/** Avancement cumulé de toutes les cups : fiches notées / fiches attendues. */
export function overallCompletion(entry: Pick<DirectoryEntry, "cups">): {
  submitted: number;
  expected: number;
  rate: number | null;
} {
  let submitted = 0;
  let expected = 0;
  for (const cup of entry.cups) {
    submitted += cup.ratings.submitted;
    expected += cup.ratings.expected;
  }
  return {
    submitted,
    expected,
    rate: expected > 0 ? Math.round((submitted / expected) * 100) : null,
  };
}

export const formatRate = (rate: number | null) => (rate === null ? "—" : `${rate} %`);

/** « 2026 · Pro · 100 % » */
export const cupChipLabel = (cup: DirectoryCup) =>
  `${cup.year} · ${panelShortLabel(cup.panel)} · ${formatRate(cup.completionRate)}`;

/** Cup proposée par défaut : la plus récente non terminée, sinon la plus récente. */
export function defaultTargetCup(cups: CupListItem[] | undefined): CupListItem | null {
  if (!cups || cups.length === 0) return null;
  return cups.find((c) => c.status !== "completed") ?? cups[0] ?? null;
}

/** Type affiché : profil juré, sinon le jury de la dernière cup. */
export function displayedPanel(entry: DirectoryEntry): JuryPanel | null {
  return entry.juryType ?? entry.cups[0]?.panel ?? null;
}
