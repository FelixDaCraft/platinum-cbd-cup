"use client";

import Link from "next/link";
import { Mail } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { AddToCupForm } from "./add-to-cup-form";
import {
  displayedPanel,
  formatRate,
  overallCompletion,
  panelLongLabel,
  panelShortLabel,
  type DirectoryEntry,
} from "./directory-utils";

interface JurorDetailSheetProps {
  juror: DirectoryEntry | null;
  onClose: () => void;
  cupId: string | null;
  onCupChange: (cupId: string) => void;
}

export function JurorDetailSheet({ juror, onClose, cupId, onCupChange }: JurorDetailSheetProps) {
  return (
    <Sheet open={!!juror} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto p-6 sm:max-w-lg">
        {juror && <JurorDetail juror={juror} cupId={cupId} onCupChange={onCupChange} onClose={onClose} />}
      </SheetContent>
    </Sheet>
  );
}

function JurorDetail({
  juror,
  cupId,
  onCupChange,
  onClose,
}: {
  juror: DirectoryEntry;
  cupId: string | null;
  onCupChange: (cupId: string) => void;
  onClose: () => void;
}) {
  const panel = displayedPanel(juror);
  const completion = overallCompletion(juror);

  return (
    <div className="space-y-8">
      <SheetHeader className="p-0 pr-8">
        <SheetTitle className="truncate">{juror.name}</SheetTitle>
        <SheetDescription asChild>
          <div className="flex flex-wrap items-center gap-2">
            {panel && (
              <span
                className="n-tag"
                style={panel === "pro" ? { color: "var(--n-text-display)", borderColor: "var(--n-text-display)" } : undefined}
              >
                {panelShortLabel(panel)}
              </span>
            )}
            <a
              href={`mailto:${juror.email}`}
              className="inline-flex min-w-0 items-center gap-1 text-sm"
              style={{ color: "var(--n-interactive)" }}
            >
              <Mail className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{juror.email}</span>
            </a>
          </div>
        </SheetDescription>
      </SheetHeader>

      <dl className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <dt className="n-label">Expertise</dt>
          <dd className="mt-1 text-sm" style={{ color: "var(--n-text-primary)" }}>
            {juror.expertise ?? "Non renseignée"}
          </dd>
        </div>
        <div>
          <dt className="n-label">Cups</dt>
          <dd className="n-font-data mt-1 text-xl" style={{ color: "var(--n-text-display)" }}>
            {juror.cups.length}
          </dd>
        </div>
        <div>
          <dt className="n-label">Complétion</dt>
          <dd className="n-font-data mt-1 text-xl" style={{ color: "var(--n-text-display)" }}>
            {formatRate(completion.rate)}
            {completion.expected > 0 && (
              <span className="ml-2 text-xs" style={{ color: "var(--n-text-secondary)" }}>
                {completion.submitted}/{completion.expected}
              </span>
            )}
          </dd>
        </div>
      </dl>

      <section>
        <h3 className="n-label mb-3" style={{ color: "var(--n-text-display)" }}>
          Historique
        </h3>
        {juror.cups.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--n-text-secondary)" }}>
            Aucune participation : profil juré créé sans cup.
          </p>
        ) : (
          <ul className="space-y-2">
            {juror.cups.map((c) => (
              <li
                key={c.cupJuryId}
                className="flex items-center justify-between gap-3 rounded-lg px-3 py-2"
                style={{ border: "1px solid var(--n-border)", opacity: c.isActive ? 1 : 0.6 }}
              >
                <div className="min-w-0">
                  <Link
                    href={`/dashboard/cups/${c.cupId}/scoring/juries`}
                    className="block truncate text-sm hover:underline"
                    style={{ color: "var(--n-text-primary)" }}
                  >
                    {c.cupName}
                  </Link>
                  <span className="n-label" style={{ fontSize: "10px" }}>
                    {c.year} · {panelLongLabel(c.panel)}
                    {!c.isActive && " · retiré"}
                  </span>
                </div>
                <div className="shrink-0 text-right">
                  <span className="n-font-data text-sm" style={{ color: "var(--n-text-display)" }}>
                    {formatRate(c.completionRate)}
                  </span>
                  <span className="n-label block" style={{ fontSize: "10px" }}>
                    {c.ratings.submitted}/{c.ratings.expected} fiches
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="pt-6" style={{ borderTop: "1px solid var(--n-border)" }}>
        <h3 className="n-label mb-4" style={{ color: "var(--n-text-display)" }}>
          Ajouter à une cup
        </h3>
        <AddToCupForm
          key={juror.userId}
          jurors={[juror]}
          cupId={cupId}
          onCupChange={onCupChange}
          onCancel={onClose}
          initialPanel={panel ?? undefined}
        />
      </section>
    </div>
  );
}
