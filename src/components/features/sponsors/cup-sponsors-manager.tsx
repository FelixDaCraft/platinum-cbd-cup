"use client";

import { useState } from "react";
import { Plus, Trash2, GripVertical, ExternalLink, Award } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { api } from "~/trpc/react";

interface CupSponsorsManagerProps {
  cupId: string;
}

type SponsorTier = "bronze" | "silver" | "gold" | "platinum";

const tierConfig: Record<SponsorTier, { label: string }> = {
  platinum: { label: "Platine" },
  gold: { label: "Or" },
  silver: { label: "Argent" },
  bronze: { label: "Bronze" },
};

const tierOrder: SponsorTier[] = ["platinum", "gold", "silver", "bronze"];

export function CupSponsorsManager({ cupId }: CupSponsorsManagerProps) {
  const [selectedSponsor, setSelectedSponsor] = useState<string>("");
  const [selectedTier, setSelectedTier] = useState<SponsorTier>("bronze");

  const utils = api.useUtils();

  const { data: cupSponsors, isLoading: isLoadingCupSponsors } =
    api.sponsors.getByCup.useQuery({ cupId });

  const { data: availableSponsors, isLoading: isLoadingAvailable } =
    api.sponsors.getAvailableForCup.useQuery({ cupId });

  const associateMutation = api.sponsors.associateToCup.useMutation({
    onSuccess: () => {
      void utils.sponsors.getByCup.invalidate({ cupId });
      void utils.sponsors.getAvailableForCup.invalidate({ cupId });
      setSelectedSponsor("");
    },
  });

  const updateMutation = api.sponsors.updateCupSponsor.useMutation({
    onSuccess: () => {
      void utils.sponsors.getByCup.invalidate({ cupId });
    },
  });

  const removeMutation = api.sponsors.removeFromCup.useMutation({
    onSuccess: () => {
      void utils.sponsors.getByCup.invalidate({ cupId });
      void utils.sponsors.getAvailableForCup.invalidate({ cupId });
    },
  });

  const handleAssociate = () => {
    if (!selectedSponsor) return;
    associateMutation.mutate({
      cupId,
      sponsorId: selectedSponsor,
      tier: selectedTier,
    });
  };

  const handleUpdateTier = (id: string, tier: SponsorTier) => {
    updateMutation.mutate({ id, tier });
  };

  const handleRemove = (id: string) => {
    removeMutation.mutate({ id });
  };

  // Group sponsors by tier
  const sponsorsByTier = cupSponsors?.reduce(
    (acc, cs) => {
      const tier = cs.tier as SponsorTier;
      if (!acc[tier]) acc[tier] = [];
      acc[tier].push(cs);
      return acc;
    },
    {} as Record<SponsorTier, typeof cupSponsors>
  );

  if (isLoadingCupSponsors || isLoadingAvailable) {
    return (
      <div className="n-card p-12 flex items-center justify-center">
        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "13px", letterSpacing: "0.08em", color: "var(--n-text-secondary)" }}>
          [LOADING...]
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Add sponsor section */}
      <div className="n-card" style={{ padding: 0 }}>
        <div className="p-4" style={{ borderBottom: "1px solid var(--n-border)" }}>
          <h3 className="font-semibold">Ajouter un sponsor</h3>
          <p className="text-sm text-muted-foreground">
            Sélectionnez un sponsor et définissez son niveau de partenariat.
          </p>
        </div>
        <div className="p-4">
          {availableSponsors && availableSponsors.length > 0 ? (
            <div className="flex flex-col gap-4 sm:flex-row">
              <Select value={selectedSponsor} onValueChange={setSelectedSponsor}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Sélectionner un sponsor..." />
                </SelectTrigger>
                <SelectContent>
                  {availableSponsors.map((sponsor) => (
                    <SelectItem key={sponsor.id} value={sponsor.id}>
                      <div className="flex items-center gap-2">
                        {sponsor.logo && (
                          <img
                            src={sponsor.logo}
                            alt=""
                            className="h-5 w-5 object-contain"
                          />
                        )}
                        {sponsor.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={selectedTier}
                onValueChange={(v) => setSelectedTier(v as SponsorTier)}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tierOrder.map((tier) => (
                    <SelectItem key={tier} value={tier}>
                      {tierConfig[tier].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                onClick={handleAssociate}
                disabled={!selectedSponsor || associateMutation.isPending}
              >
                {associateMutation.isPending ? (
                  <span className="mr-2 text-xs" style={{ fontFamily: "'Space Mono', monospace" }}>[...]</span>
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                Ajouter
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Tous les sponsors sont déjà associés à cette cup, ou vous n&apos;avez
              pas encore créé de sponsors.{" "}
              <a href="/settings/sponsors" className="text-foreground hover:underline">
                Créer un sponsor
              </a>
            </p>
          )}
        </div>
      </div>

      {/* Associated sponsors by tier */}
      {cupSponsors && cupSponsors.length > 0 ? (
        <div className="space-y-6">
          {tierOrder.map((tier) => {
            const sponsors = sponsorsByTier?.[tier];
            if (!sponsors || sponsors.length === 0) return null;

            return (
              <div key={tier} className="n-card" style={{ padding: 0 }}>
                <div className="p-4" style={{ borderBottom: "1px solid var(--n-border)" }}>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg">
                      {tierConfig[tier].label}
                    </h3>
                    <Badge variant="secondary">{sponsors.length}</Badge>
                  </div>
                </div>
                <div className="p-4">
                  <div className="space-y-2">
                    {sponsors.map((cs) => (
                      <div
                        key={cs.id}
                        className="flex items-center justify-between p-3 rounded-lg transition-colors"
                        style={{ border: "1px solid var(--n-border)", background: "var(--n-surface-raised)" }}
                      >
                        <div className="flex items-center gap-3">
                          <GripVertical className="h-4 w-4 cursor-grab" style={{ color: "var(--n-text-secondary)" }} />
                          {cs.sponsor.logo ? (
                            <img
                              src={cs.sponsor.logo}
                              alt={cs.sponsor.name}
                              className="h-10 w-10 object-contain rounded"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded flex items-center justify-center" style={{ background: "var(--n-border)" }}>
                              <Award className="h-5 w-5" style={{ color: "var(--n-text-secondary)" }} />
                            </div>
                          )}
                          <div>
                            <p className="font-medium">{cs.sponsor.name}</p>
                            {cs.sponsor.website && (
                              <a
                                href={cs.sponsor.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs flex items-center gap-1 hover:underline"
                                style={{ color: "var(--n-text-secondary)" }}
                              >
                                <ExternalLink className="h-3 w-3" />
                                Site web
                              </a>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Select
                            value={cs.tier}
                            onValueChange={(v) =>
                              handleUpdateTier(cs.id, v as SponsorTier)
                            }
                          >
                            <SelectTrigger className="w-[120px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {tierOrder.map((t) => (
                                <SelectItem key={t} value={t}>
                                  {tierConfig[t].label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Retirer ce sponsor ?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  {cs.sponsor.name} sera retiré de cette cup. Vous
                                  pourrez le réassocier plus tard si nécessaire.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annuler</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleRemove(cs.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Retirer
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="n-card py-12 text-center">
          <Award className="mx-auto h-12 w-12" style={{ color: "var(--n-text-secondary)" }} />
          <h3 className="mt-4 text-lg font-semibold">Aucun sponsor associé</h3>
          <p className="mt-2 text-muted-foreground">
            Ajoutez des sponsors pour qu&apos;ils apparaissent sur la page
            publique de cette cup.
          </p>
        </div>
      )}
    </div>
  );
}
