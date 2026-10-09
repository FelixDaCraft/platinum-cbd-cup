"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { UserPlus } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  AddJurorsSheet,
  type AddJurorsPreset,
  type AssignRequest,
  CoverageMatrix,
  CsvImportDialog,
  DOTO_TITLE,
  effectiveInvitationStatus,
  ErrorState,
  InvitationsTab,
  JurorsTab,
  LoadingState,
} from "~/components/features/jury-setup";
import { api } from "~/trpc/react";

type Tab = "categories" | "jurors" | "invitations";

/** « Jurys & affectation » : couverture par catégorie, jurés, invitations. */
export default function JuriesPage() {
  const params = useParams();
  const cupId = params.cupId as string;

  const [tab, setTab] = useState<Tab>("categories");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [preset, setPreset] = useState<AddJurorsPreset | null>(null);
  const [csvOpen, setCsvOpen] = useState(false);
  const [assignRequest, setAssignRequest] = useState<AssignRequest | null>(null);

  const { data: cup, isLoading, isError, refetch } = api.cup.getById.useQuery({ id: cupId });
  const { data: coverage } = api.jury.getCoverage.useQuery({ cupId }, { enabled: !!cup });
  const { data: invitations } = api.jury.listInvitations.useQuery({ cupId, status: "all" }, { enabled: !!cup });

  const openSheet = (p: AddJurorsPreset | null = null) => {
    setPreset(p);
    setSheetOpen(true);
  };

  if (isLoading) return <LoadingState minHeight={400} />;
  if (isError) {
    return <ErrorState message="LE JURY DE CETTE CUP N'A PAS PU ÊTRE CHARGÉ" onRetry={() => void refetch()} />;
  }
  if (!cup) return null;

  const expiredCount = invitations?.filter((i) => effectiveInvitationStatus(i) === "expired").length ?? 0;

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <h1 style={DOTO_TITLE}>Jurys &amp; affectation</h1>
          <p className="n-label mt-1" style={{ textTransform: "none", letterSpacing: "0.02em" }}>
            Chaque catégorie doit être notée par assez de jurés pro et de jurés public. Objectifs réglables par catégorie.
          </p>
        </div>
        <Button onClick={() => openSheet()} className="shrink-0">
          <UserPlus className="mr-2 h-4 w-4" />
          Ajouter des jurés
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="space-y-4">
        <div className="-mx-1 overflow-x-auto px-1">
          <TabsList>
            <TabsTrigger value="categories" className="n-label">Par catégorie</TabsTrigger>
            <TabsTrigger value="jurors" className="n-label">
              Par juré
              {coverage && (
                <span className="ml-1 text-[var(--n-text-disabled)]">
                  · {coverage.totals.pro.activeJurors} pro · {coverage.totals.public.activeJurors} public
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="invitations" className="n-label">
              Invitations
              {expiredCount > 0 && (
                <span className="ml-1" style={{ color: "var(--n-warning)" }}>
                  · {expiredCount} expirée{expiredCount > 1 ? "s" : ""}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="categories">
          <CoverageMatrix
            cupId={cupId}
            onAdd={openSheet}
            onAssignUnassigned={(ids) => {
              setAssignRequest({ cupJuryIds: ids, nonce: Date.now() });
              setTab("jurors");
            }}
          />
        </TabsContent>

        {/* forceMount : la demande d'affectation venue de l'onglet catégories est reçue même onglet fermé. */}
        <TabsContent value="jurors" forceMount className="data-[state=inactive]:hidden">
          <JurorsTab cupId={cupId} assignRequest={assignRequest} onAddJurors={() => openSheet()} />
        </TabsContent>

        <TabsContent value="invitations">
          <InvitationsTab cupId={cupId} onInvite={() => openSheet({ panel: "pro", method: "email" })} />
        </TabsContent>
      </Tabs>

      <AddJurorsSheet
        cupId={cupId}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        preset={preset}
        onOpenCsvImport={() => setCsvOpen(true)}
      />
      <CsvImportDialog cupId={cupId} open={csvOpen} onOpenChange={setCsvOpen} />
    </div>
  );
}
