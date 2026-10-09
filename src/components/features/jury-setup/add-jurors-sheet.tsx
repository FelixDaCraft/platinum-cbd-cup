"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { History, Mail, QrCode, UserCheck, Users } from "lucide-react";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "~/components/ui/sheet";
import { api } from "~/trpc/react";
import { ExistingJurorsPicker } from "./existing-jurors-picker";
import { InviteEmailForm } from "./invite-email-form";
import { type AddJurorsPreset, type JuryPanel, qrCodesHref } from "./shared";

type Method = "email" | "existing" | "qr";

const METHODS: Record<JuryPanel, { value: Method; title: string; desc: string; Icon: typeof Mail }[]> = {
  pro: [
    {
      value: "existing",
      title: "Juré existant",
      desc: "A déjà jugé ou a un profil juré. Ajout immédiat, sans nouvelle invitation.",
      Icon: History,
    },
    {
      value: "email",
      title: "Inviter par e-mail",
      desc: "Nouvelle personne. Lien personnel 14 jours, un par un ou par CSV.",
      Icon: Mail,
    },
  ],
  public: [
    {
      value: "qr",
      title: "QR codes",
      desc: "Un QR par box d'échantillons. Anonyme, révocable, activé par le juré.",
      Icon: QrCode,
    },
    {
      value: "existing",
      title: "Juré existant",
      desc: "Un juré déjà connu rejoint le jury public de cette cup.",
      Icon: History,
    },
  ],
};

function ChoiceCard({
  name,
  checked,
  onSelect,
  title,
  desc,
  icon,
  kicker,
}: {
  name: string;
  checked: boolean;
  onSelect: () => void;
  title: string;
  desc: string;
  icon: React.ReactNode;
  kicker?: string;
}) {
  return (
    <label
      className="flex cursor-pointer flex-col gap-1.5 rounded-lg border p-3 transition-colors focus-within:ring-2 focus-within:ring-[var(--n-text-secondary)]"
      style={{
        borderColor: checked ? "var(--n-text-display)" : "var(--n-border-visible)",
        background: checked ? "var(--n-surface-raised)" : "transparent",
      }}
    >
      <span className="flex items-center justify-between">
        <span style={{ color: checked ? "var(--n-text-display)" : "var(--n-text-secondary)" }}>{icon}</span>
        <input type="radio" name={name} checked={checked} onChange={onSelect} className="accent-white" />
      </span>
      {kicker && <span className="n-label" style={{ fontSize: 10 }}>{kicker}</span>}
      <span className="n-font-body text-sm font-medium text-[var(--n-text-display)]">{title}</span>
      <span className="n-label" style={{ textTransform: "none", letterSpacing: "0.02em" }}>{desc}</span>
    </label>
  );
}

/**
 * Tiroir unifié « Ajouter des jurés » : on choisit d'abord le jury (pro /
 * public), puis la méthode (invitation e-mail, juré existant, QR codes).
 */
export function AddJurorsSheet({
  cupId,
  open,
  onOpenChange,
  preset,
  onOpenCsvImport,
}: {
  cupId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preset: AddJurorsPreset | null;
  onOpenCsvImport: () => void;
}) {
  const [panel, setPanel] = useState<JuryPanel>("pro");
  const [method, setMethod] = useState<Method>("existing");
  const { data: coverage } = api.jury.getCoverage.useQuery({ cupId }, { enabled: open });
  const presetCategory = coverage?.categories.find((c) => c.categoryId === preset?.categoryId);

  useEffect(() => {
    if (!open) return;
    const p = preset?.panel ?? "pro";
    setPanel(p);
    const wanted = preset?.method;
    setMethod(wanted && METHODS[p].some((m) => m.value === wanted) ? wanted : p === "pro" ? "existing" : "qr");
  }, [open, preset]);

  const choosePanel = (p: JuryPanel) => {
    setPanel(p);
    if (!METHODS[p].some((m) => m.value === method)) setMethod(METHODS[p][0]!.value);
  };

  const close = () => onOpenChange(false);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-xl">
        <SheetHeader className="border-b border-[var(--n-border)] p-5 pr-12">
          <span className="n-label" style={{ fontSize: 10 }}>
            {coverage?.cup.name ? `${coverage.cup.name.toUpperCase()} · ` : ""}JURYS &amp; AFFECTATION
          </span>
          <SheetTitle>Ajouter des jurés</SheetTitle>
          <SheetDescription className="n-label" style={{ textTransform: "none", letterSpacing: "0.02em" }}>
            Choisissez d&apos;abord le jury : c&apos;est ici qu&apos;il est fixé.
            {presetCategory && (
              <>
                {" "}
                Catégorie présélectionnée : <strong className="text-[var(--n-text-primary)]">{presetCategory.name}</strong>.
              </>
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 p-5">
          <div role="radiogroup" aria-label="Jury" className="grid grid-cols-2 gap-2">
            <ChoiceCard
              name="add-jurors-panel"
              checked={panel === "pro"}
              onSelect={() => choosePanel("pro")}
              icon={<UserCheck className="h-4 w-4" />}
              title="Jury professionnel"
              desc="Experts nominatifs"
            />
            <ChoiceCard
              name="add-jurors-panel"
              checked={panel === "public"}
              onSelect={() => choosePanel("public")}
              icon={<Users className="h-4 w-4" />}
              title="Jury public"
              desc="Box à domicile, QR codes"
            />
          </div>

          <div role="radiogroup" aria-label="Méthode d'ajout" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {METHODS[panel].map((m) => (
              <ChoiceCard
                key={m.value}
                name="add-jurors-method"
                checked={method === m.value}
                onSelect={() => setMethod(m.value)}
                icon={<m.Icon className="h-4 w-4" />}
                kicker={panel === "pro" ? "JURY PRO" : "JURY PUBLIC"}
                title={m.title}
                desc={m.desc}
              />
            ))}
          </div>

          <div className="border-t border-[var(--n-border)] pt-5">
            {method === "email" && panel === "pro" && (
              <InviteEmailForm
                cupId={cupId}
                onDone={close}
                onOpenCsvImport={() => {
                  close();
                  onOpenCsvImport();
                }}
              />
            )}

            {method === "existing" && (
              <ExistingJurorsPicker
                key={`${panel}-${preset?.categoryId ?? ""}`}
                cupId={cupId}
                panel={panel}
                presetCategoryId={preset?.categoryId}
                onDone={close}
              />
            )}

            {method === "qr" && panel === "public" && (
              <div className="space-y-4">
                <p className="n-font-body text-sm text-[var(--n-text-primary)]">
                  Le jury public est recruté par QR codes : chaque box d&apos;échantillons contient un QR (et son code
                  lisible en secours). En le scannant, le juré crée son compte et rejoint le jury public des
                  catégories du code.
                </p>
                <ul className="n-label list-disc space-y-1 pl-4" style={{ textTransform: "none", letterSpacing: "0.02em" }}>
                  <li>Générez un lot de codes pour une ou plusieurs catégories.</li>
                  <li>Si le QR est glissé dans la box, indiquez-le à la génération : la réception des échantillons est alors confirmée à l&apos;activation.</li>
                  <li>Un code non utilisé reste révocable à tout moment.</li>
                </ul>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Link
                    href={qrCodesHref(cupId, { generate: true, categoryId: preset?.categoryId })}
                    className="n-btn-primary"
                    style={{ gap: 8 }}
                    onClick={close}
                  >
                    <QrCode className="h-4 w-4" aria-hidden />
                    Générer des QR codes
                  </Link>
                  <Link
                    href={qrCodesHref(cupId, { categoryId: preset?.categoryId })}
                    className="n-btn-secondary"
                    onClick={close}
                  >
                    Voir les codes
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
