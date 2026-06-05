"use client";

import { useParams } from "next/navigation";
import {
  Eye,
  EyeOff,
  Award,
  Medal,
  BarChart3,
  AlertCircle,
  Info,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Label } from "~/components/ui/label";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
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

type ResultsVisibility = "podium" | "labels" | "labels_and_podium" | "all";

const visibilityOptions: {
  value: ResultsVisibility;
  label: string;
  description: string;
  icon: typeof Trophy;
}[] = [
  {
    value: "all",
    label: "Tous les résultats",
    description: "Afficher tous les produits avec leurs scores complets",
    icon: BarChart3,
  },
  {
    value: "labels_and_podium",
    label: "Labels et podium",
    description: "Afficher le top 3 et tous les produits labellisés (Or, Argent, Bronze)",
    icon: Trophy,
  },
  {
    value: "labels",
    label: "Labels uniquement",
    description: "Afficher uniquement les produits ayant obtenu un label",
    icon: Award,
  },
  {
    value: "podium",
    label: "Podium uniquement",
    description: "Afficher seulement le top 3 de chaque catégorie",
    icon: Medal,
  },
];

export default function PublicationPage() {
  const params = useParams();
  const cupId = params.cupId as string;

  const utils = api.useUtils();

  const { data, isLoading, error } = api.cup.getResultsSettings.useQuery(
    { cupId },
    { enabled: !!cupId }
  );

  const publishResults = api.cup.publishResults.useMutation({
    onSuccess: () => {
      toast.success("Résultats publiés");
      void utils.cup.getResultsSettings.invalidate({ cupId });
      void utils.cup.getById.invalidate({ id: cupId });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const unpublishResults = api.cup.unpublishResults.useMutation({
    onSuccess: () => {
      toast.success("Résultats retirés de la publication");
      void utils.cup.getResultsSettings.invalidate({ cupId });
      void utils.cup.getById.invalidate({ id: cupId });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateVisibility = api.cup.updateResultsVisibility.useMutation({
    onSuccess: () => {
      toast.success("Visibilité mise à jour");
      void utils.cup.getResultsSettings.invalidate({ cupId });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const isPending =
    publishResults.isPending ||
    unpublishResults.isPending ||
    updateVisibility.isPending;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <span
          style={{
            fontFamily: "'Space Mono', monospace",
            fontSize: "13px",
            letterSpacing: "0.08em",
            color: "var(--n-text-disabled)",
          }}
        >
          [LOADING...]
        </span>
      </div>
    );
  }

  if (error ?? !data) {
    return null;
  }

  const isPublished = !!data.resultsPublishedAt;
  const canPublish = data.canPublishResults;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1
            style={{
              fontFamily: "'Doto', 'Space Mono', monospace",
              fontSize: "20px",
              fontWeight: 700,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "var(--n-text-display)",
              marginBottom: "4px",
            }}
          >
            PUBLICATION DES RÉSULTATS
          </h1>
          <p className="n-label">Gérez la visibilité des résultats</p>
        </div>
        {isPublished && (
          <span
            className="n-tag success"
            style={{ fontFamily: "'Space Mono', monospace" }}
          >
            PUBLIÉS
          </span>
        )}
      </div>

      {/* Warning if notation not closed */}
      {!canPublish && (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "12px",
            padding: "16px",
            borderRadius: "8px",
            background: "rgba(215,25,33,0.08)",
            border: "1px solid rgba(215,25,33,0.25)",
          }}
        >
          <AlertCircle
            className="h-5 w-5 flex-shrink-0 mt-0.5"
            style={{ color: "var(--n-accent)" }}
          />
          <div>
            <p
              style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: "12px",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--n-accent)",
                fontWeight: 700,
                marginBottom: "4px",
              }}
            >
              [NOTATION NON CLÔTURÉE]
            </p>
            <p
              style={{
                fontSize: "13px",
                color: "var(--n-text-secondary)",
              }}
            >
              Vous devez clôturer la phase de notation avant de pouvoir publier
              les résultats. La cup doit être en statut &quot;Terminée&quot;.
            </p>
          </div>
        </div>
      )}

      {/* Publication Status Card */}
      <div
        style={{
          background: "var(--n-surface)",
          border: "1px solid var(--n-border)",
          borderRadius: "12px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--n-border)",
          }}
        >
          <p
            style={{
              fontFamily: "'Doto', 'Space Mono', monospace",
              fontSize: "12px",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--n-text-display)",
              fontWeight: 700,
              marginBottom: "2px",
            }}
          >
            STATUT DE PUBLICATION
          </p>
          <p className="n-label">
            Contrôlez si les résultats sont visibles sur la page publique
          </p>
        </div>
        <div style={{ padding: "20px" }}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {isPublished ? (
                <Eye
                  className="h-5 w-5 flex-shrink-0"
                  style={{ color: "var(--n-success)" }}
                />
              ) : (
                <EyeOff
                  className="h-5 w-5 flex-shrink-0"
                  style={{ color: "var(--n-text-disabled)" }}
                />
              )}
              <div>
                <p
                  style={{
                    fontSize: "14px",
                    fontWeight: 500,
                    color: isPublished ? "var(--n-success)" : "var(--n-text-primary)",
                    marginBottom: "2px",
                  }}
                >
                  {isPublished
                    ? "Les résultats sont publiés"
                    : "Les résultats ne sont pas publiés"}
                </p>
                <p
                  style={{
                    fontFamily: "'Space Mono', monospace",
                    fontSize: "11px",
                    color: "var(--n-text-disabled)",
                  }}
                >
                  {isPublished
                    ? `Publiés le ${new Intl.DateTimeFormat("fr-FR", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(new Date(data.resultsPublishedAt!))}`
                    : "Les visiteurs ne peuvent pas voir les résultats"}
                </p>
              </div>
            </div>

            {isPublished ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" disabled={isPending}>
                    {unpublishResults.isPending ? (
                      "[...]"
                    ) : (
                      <>
                        <EyeOff className="mr-2 h-4 w-4" />
                        Masquer
                      </>
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Masquer les résultats ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Les résultats ne seront plus visibles sur la page publique.
                      Vous pourrez les republier à tout moment.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => unpublishResults.mutate({ cupId })}
                    >
                      Masquer
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button disabled={isPending || !canPublish}>
                    {publishResults.isPending ? (
                      "[PUBLICATION...]"
                    ) : (
                      <>
                        <Eye className="mr-2 h-4 w-4" />
                        Publier les résultats
                      </>
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Publier les résultats ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Les résultats seront visibles sur la page publique de la cup.
                      Les visiteurs pourront voir les lauréats selon le niveau de
                      visibilité configuré.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() =>
                        publishResults.mutate({
                          cupId,
                          visibility: data.resultsVisibility as ResultsVisibility,
                        })
                      }
                    >
                      Publier
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </div>

      {/* Visibility — "pro" cups pick a display mode; "public" (public-jury)
          cups follow a fixed public policy (top 3 scored, medalists label-only),
          so the per-cup selector is replaced by an explanatory note for them. */}
      {data.type === "pro" ? (
      <div
        style={{
          background: "var(--n-surface)",
          border: "1px solid var(--n-border)",
          borderRadius: "12px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--n-border)",
          }}
        >
          <p
            style={{
              fontFamily: "'Doto', 'Space Mono', monospace",
              fontSize: "12px",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--n-text-display)",
              fontWeight: 700,
              marginBottom: "2px",
            }}
          >
            NIVEAU DE VISIBILITÉ
          </p>
          <p className="n-label">
            Choisissez ce que les visiteurs peuvent voir sur la page publique
          </p>
        </div>
        <div style={{ padding: "20px" }}>
          <RadioGroup
            value={data.resultsVisibility}
            onValueChange={(value) =>
              updateVisibility.mutate({
                cupId,
                visibility: value as ResultsVisibility,
              })
            }
            disabled={isPending}
            className="space-y-3"
          >
            {visibilityOptions.map((option) => {
              const Icon = option.icon;
              const isSelected = data.resultsVisibility === option.value;
              return (
                <div
                  key={option.value}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "16px",
                    padding: "16px",
                    borderRadius: "8px",
                    border: `1px solid ${isSelected ? "var(--n-border-visible)" : "var(--n-border)"}`,
                    background: isSelected ? "var(--n-surface-raised)" : "transparent",
                    cursor: "pointer",
                    transition: "border-color 150ms ease, background 150ms ease",
                  }}
                >
                  <RadioGroupItem
                    value={option.value}
                    id={option.value}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <Label
                      htmlFor={option.value}
                      className="flex items-center gap-2 cursor-pointer"
                      style={{
                        fontFamily: "'Doto', 'Space Mono', monospace",
                        fontSize: "12px",
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                        color: isSelected ? "var(--n-text-display)" : "var(--n-text-primary)",
                        fontWeight: 700,
                        marginBottom: "4px",
                      }}
                    >
                      <Icon
                        className="h-4 w-4"
                        style={{
                          color: isSelected
                            ? "var(--n-text-display)"
                            : "var(--n-text-disabled)",
                        }}
                      />
                      {option.label}
                    </Label>
                    <p
                      style={{
                        fontSize: "13px",
                        color: "var(--n-text-secondary)",
                      }}
                    >
                      {option.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </RadioGroup>
        </div>
      </div>
      ) : (
        <div
          style={{
            background: "var(--n-surface)",
            border: "1px solid var(--n-border)",
            borderRadius: "12px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid var(--n-border)",
            }}
          >
            <p
              style={{
                fontFamily: "'Doto', 'Space Mono', monospace",
                fontSize: "12px",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--n-text-display)",
                fontWeight: 700,
                marginBottom: "2px",
              }}
            >
              AFFICHAGE PUBLIC DES RÉSULTATS
            </p>
            <p className="n-label">
              Règle standard, identique pour toutes les éditions à jury public
            </p>
          </div>
          <div style={{ padding: "20px" }}>
            <div
              style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}
            >
              <Trophy
                className="h-4 w-4 flex-shrink-0 mt-0.5"
                style={{ color: "var(--n-text-display)" }}
              />
              <div
                className="space-y-3"
                style={{ fontSize: "13px", color: "var(--n-text-secondary)" }}
              >
                <p>
                  <strong style={{ color: "var(--n-text-primary)" }}>
                    Top 3 de chaque catégorie
                  </strong>{" "}
                  — affiché avec sa note finale.
                </p>
                <p>
                  <strong style={{ color: "var(--n-text-primary)" }}>
                    Producteurs médaillés (hors top 3)
                  </strong>{" "}
                  — affichés avec leur label, sans la note.
                </p>
                <p>
                  <strong style={{ color: "var(--n-text-primary)" }}>
                    Autres produits
                  </strong>{" "}
                  — non affichés sur la page publique.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Info note */}
      <div
        style={{
          background: "var(--n-surface)",
          border: "1px solid var(--n-border)",
          borderRadius: "8px",
          padding: "16px 20px",
          display: "flex",
          alignItems: "flex-start",
          gap: "12px",
        }}
      >
        <Info
          className="h-4 w-4 flex-shrink-0 mt-0.5"
          style={{ color: "var(--n-text-disabled)" }}
        />
        <div
          style={{
            fontSize: "13px",
            color: "var(--n-text-secondary)",
          }}
          className="space-y-1"
        >
          <p>
            <strong style={{ color: "var(--n-text-primary)" }}>Note :</strong>{" "}
            La publication des résultats affiche les lauréats sur la page publique de votre cup.
          </p>
          <p>
            Les producteurs peuvent toujours accéder à leurs propres résultats détaillés
            depuis leur espace producteur, indépendamment de la publication publique.
          </p>
        </div>
      </div>
    </div>
  );
}
