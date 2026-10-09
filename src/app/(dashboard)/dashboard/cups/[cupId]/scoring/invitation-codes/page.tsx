"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarClock, Package, QrCode, ShieldOff, User } from "lucide-react";

import { api } from "~/trpc/react";
import { CategoryQrCard } from "./_components/category-qr-card";
import { GenerateQrDialog } from "./_components/generate-qr-dialog";
import { PrintQrDialog } from "./_components/print-qr-dialog";
import { QrCodesList } from "./_components/qr-codes-list";
import { effectiveCodeStatus } from "~/lib/jury-coverage";
import { formatDate, plural, type PrintableCode } from "./_components/shared";

/**
 * QR codes du jury public. Le QR EST le code d'invitation : il encode
 * /activate?code=…, ouvre une place de juré public dans une ou plusieurs
 * catégories et ne sert qu'une fois. Remplace aussi les anciens « jetons ».
 *
 * Paramètres : ?category=<id> (catégorie présélectionnée / filtrée),
 * ?generate=1 (ouvre le dialogue de génération).
 */
function PublicJuryQrPage() {
  const params = useParams();
  const cupId = params.cupId as string;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const listRef = useRef<HTMLElement>(null);

  const [generateOpen, setGenerateOpen] = useState(false);
  const [generateCategoryIds, setGenerateCategoryIds] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [printJob, setPrintJob] = useState<{ codes: PrintableCode[]; scopeLabel: string } | null>(null);

  const cupQuery = api.cup.getById.useQuery({ id: cupId });
  const coverageQuery = api.jury.getCoverage.useQuery({ cupId });
  const codesQuery = api.juryCodes.list.useQuery({ cupId });
  // Anciens jetons imprimés : seulement pour signaler ceux encore réclamables.
  const legacyTokensQuery = api.jury.listPublicJuryTokens.useQuery(
    { cupId, status: "available" },
    { retry: false }
  );

  const categories = useMemo(
    () => (coverageQuery.data?.categories ?? []).map((c) => ({ id: c.categoryId, name: c.name })),
    [coverageQuery.data]
  );

  // Lieux de distribution, par catégorie et au total.
  const { destinationsByCategory, allDestinations } = useMemo(() => {
    const byCategory = new Map<string, Set<string>>();
    const all = new Set<string>();
    for (const code of codesQuery.data ?? []) {
      const dest = code.destination?.trim();
      if (!dest) continue;
      all.add(dest);
      for (const cat of code.categories) {
        const set = byCategory.get(cat.id) ?? new Set<string>();
        set.add(dest);
        byCategory.set(cat.id, set);
      }
    }
    const sort = (s: Iterable<string>) => [...s].sort((a, b) => a.localeCompare(b, "fr"));
    return {
      destinationsByCategory: new Map([...byCategory].map(([k, v]) => [k, sort(v)])),
      allDestinations: sort(all),
    };
  }, [codesQuery.data]);

  const openGenerate = (categoryId?: string) => {
    const fallback = categories[0]?.id;
    const id = categoryId ?? fallback;
    setGenerateCategoryIds(id ? [id] : []);
    setGenerateOpen(true);
  };

  // Liens entrants : ?category=…&generate=1 (depuis « Jurys & affectation »).
  const handledParams = useRef(false);
  useEffect(() => {
    if (handledParams.current || !coverageQuery.data) return;
    handledParams.current = true;
    const categoryParam = searchParams.get("category");
    const validCategory = categories.some((c) => c.id === categoryParam) ? categoryParam! : undefined;
    const wantsGenerate = searchParams.get("generate") === "1";
    if (validCategory) setCategoryFilter(validCategory);
    if (wantsGenerate) openGenerate(validCategory);
    // Retire ?generate pour qu'un rafraîchissement ne rouvre pas le dialogue.
    if (wantsGenerate || categoryParam) router.replace(pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coverageQuery.data]);

  const printCategory = (categoryId: string, name: string) => {
    const now = new Date();
    const codes = (codesQuery.data ?? [])
      .filter(
        (c) =>
          c.categories.some((cat) => cat.id === categoryId) &&
          effectiveCodeStatus({ status: c.status, expiresAt: c.expiresAt ? new Date(c.expiresAt) : null }, now) ===
            "pending"
      )
      .map((c) => ({ code: c.code, categories: c.categories.map((cat) => cat.name) }));
    setPrintJob({ codes, scopeLabel: name });
  };

  const showCategoryCodes = (categoryId: string) => {
    setCategoryFilter(categoryId);
    listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (cupQuery.isLoading || coverageQuery.isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center" role="status">
        <p className="n-label" style={{ color: "var(--n-text-disabled)" }}>
          [CHARGEMENT…]
        </p>
      </div>
    );
  }

  // Une requête en échec ne doit pas se confondre avec une page vide.
  if (cupQuery.isError || coverageQuery.isError || codesQuery.isError || !cupQuery.data || !coverageQuery.data) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 text-center">
        <span role="alert" className="n-label" style={{ color: "var(--n-text-secondary)" }}>
          [ERREUR] LES QR CODES N&apos;ONT PAS PU ÊTRE CHARGÉS
        </span>
        <button
          type="button"
          className="n-btn-secondary text-xs"
          onClick={() => {
            void cupQuery.refetch();
            void coverageQuery.refetch();
            void codesQuery.refetch();
          }}
        >
          RÉESSAYER
        </button>
      </div>
    );
  }

  const cup = cupQuery.data;
  const coverage = coverageQuery.data;
  const totals = coverage.totals;
  const legacyAvailable = legacyTokensQuery.data?.stats.available ?? 0;

  const tiles = [
    { label: "QR générés", value: String(totals.codes.generated) },
    { label: "En attente", value: String(totals.codes.pending) },
    { label: "Activés", value: String(totals.codes.activated) },
    { label: "Jurés publics actifs", value: String(totals.public.activeJurors) },
    {
      label: "Échantillons reçus",
      value: `${totals.public.samplesReceived}`,
      sub: `/ ${totals.public.activeJurors}`,
    },
  ];

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="n-label" style={{ color: "var(--n-text-disabled)" }}>
            Notation · jury public
          </p>
          <h1
            className="n-font-display mt-1"
            style={{ fontSize: 24, fontWeight: 500, color: "var(--n-text-display)", lineHeight: 1.1 }}
          >
            QR codes · jury public
          </h1>
          <p className="mt-2 text-sm" style={{ color: "var(--n-text-secondary)" }}>
            Consommateurs qui notent chez eux · 1 QR code = 1 place de juré public.
          </p>
        </div>
        <button
          type="button"
          className="n-btn-primary self-start sm:self-auto"
          onClick={() => openGenerate()}
          disabled={categories.length === 0}
        >
          <QrCode className="mr-2 h-4 w-4" aria-hidden="true" />
          Générer des QR codes
        </button>
      </div>

      {/* Mode d'emploi */}
      <section className="n-card" style={{ padding: "16px 20px" }} aria-label="Fonctionnement des QR codes">
        <ul className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2" style={{ color: "var(--n-text-secondary)" }}>
          <li className="flex gap-3">
            <User className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--n-text-primary)" }} aria-hidden="true" />
            <span>
              <strong style={{ color: "var(--n-text-primary)" }}>Une personne, un usage.</strong> Scanné, le QR
              crée le compte juré public et ouvre la ou les catégories du code. Le code imprimé dessous sert si
              la caméra ne lit pas le QR.
            </span>
          </li>
          <li className="flex gap-3">
            <ShieldOff className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--n-text-primary)" }} aria-hidden="true" />
            <span>
              <strong style={{ color: "var(--n-text-primary)" }}>Révocable avant usage.</strong> Un QR perdu ou
              non distribué se révoque tant qu&apos;il n&apos;est pas activé.
            </span>
          </li>
          <li className="flex gap-3">
            <Package className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--n-text-primary)" }} aria-hidden="true" />
            <span>
              <strong style={{ color: "var(--n-text-primary)" }}>Échantillons inclus.</strong> QR glissé dans la
              box : la réception est confirmée à l&apos;activation. Sinon, le juré la confirme lui-même.
            </span>
          </li>
          <li className="flex gap-3">
            <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--n-text-primary)" }} aria-hidden="true" />
            <span>
              <strong style={{ color: "var(--n-text-primary)" }}>Validité.</strong>{" "}
              {cup.ratingEndAt
                ? `Jusqu'à la fin de la notation (${formatDate(cup.ratingEndAt, true)}), date figée à la génération.`
                : "Aucune fin de notation fixée : les codes générés maintenant n'expirent pas."}
            </span>
          </li>
        </ul>
        {legacyAvailable > 0 && (
          <p className="n-label mt-4 border-t pt-3" style={{ borderColor: "var(--n-border)", color: "var(--n-text-disabled)" }}>
            {legacyAvailable} {plural(legacyAvailable, "ancien jeton imprimé reste utilisable", "anciens jetons imprimés restent utilisables")}{" "}
            · les jetons ne se génèrent plus
          </p>
        )}
      </section>

      {/* Totaux */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {tiles.map((tile, i) => (
          <div
            key={tile.label}
            className={`n-card flex flex-col gap-1 ${i === tiles.length - 1 ? "col-span-2 md:col-span-1" : ""}`}
            style={{ padding: "12px 16px" }}
          >
            <span className="n-label" style={{ color: "var(--n-text-disabled)" }}>
              {tile.label}
            </span>
            <span className="n-font-display" style={{ fontSize: 28, color: "var(--n-text-display)", lineHeight: 1.1 }}>
              {tile.value}
              {tile.sub && (
                <span className="n-font-data ml-1 text-sm" style={{ color: "var(--n-text-disabled)" }}>
                  {tile.sub}
                </span>
              )}
            </span>
          </div>
        ))}
      </div>

      {/* Cartes par catégorie */}
      <section aria-labelledby="qr-categories-title" className="space-y-3">
        <h2 id="qr-categories-title" className="n-label" style={{ color: "var(--n-text-secondary)" }}>
          Par catégorie
        </h2>
        {coverage.categories.length === 0 ? (
          <div className="n-card py-10 text-center">
            <p className="text-sm" style={{ color: "var(--n-text-secondary)" }}>
              Aucune catégorie : créez les catégories de la cup avant de générer des QR codes.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {coverage.categories.map((category) => (
              <CategoryQrCard
                key={category.categoryId}
                category={category}
                destinations={destinationsByCategory.get(category.categoryId) ?? []}
                onGenerate={() => openGenerate(category.categoryId)}
                onPrint={() => printCategory(category.categoryId, category.name)}
                onShowCodes={() => showCategoryCodes(category.categoryId)}
              />
            ))}
          </div>
        )}
      </section>

      <QrCodesList
        ref={listRef}
        cupId={cupId}
        codes={codesQuery.data}
        isLoading={codesQuery.isLoading}
        categories={categories}
        categoryFilter={categoryFilter}
        onCategoryFilterChange={setCategoryFilter}
        onPrint={(codes, scopeLabel) => setPrintJob({ codes, scopeLabel })}
      />

      <GenerateQrDialog
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        cupId={cupId}
        categories={categories}
        initialCategoryIds={generateCategoryIds}
        ratingEndAt={cup.ratingEndAt ?? null}
        knownDestinations={allDestinations}
        onGenerated={({ codes, scopeLabel, print }) => {
          if (print) setPrintJob({ codes, scopeLabel });
        }}
      />

      <PrintQrDialog
        open={!!printJob}
        onOpenChange={(open) => !open && setPrintJob(null)}
        cupName={cup.name}
        scopeLabel={printJob?.scopeLabel ?? ""}
        codes={printJob?.codes ?? []}
      />
    </div>
  );
}

export default function InvitationCodesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[400px] items-center justify-center" role="status">
          <p className="n-label" style={{ color: "var(--n-text-disabled)" }}>
            [CHARGEMENT…]
          </p>
        </div>
      }
    >
      <PublicJuryQrPage />
    </Suspense>
  );
}
