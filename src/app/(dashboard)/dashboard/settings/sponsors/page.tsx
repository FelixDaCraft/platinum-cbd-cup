"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, ExternalLink, Image as ImageIcon } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
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
import { SponsorForm } from "~/components/features/sponsors/sponsor-form";

export default function SponsorsSettingsPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingSponsor, setEditingSponsor] = useState<string | null>(null);

  const { data: sponsors, isLoading, refetch } = api.sponsors.list.useQuery();
  const deleteMutation = api.sponsors.delete.useMutation({
    onSuccess: () => {
      void refetch();
    },
  });

  const handleDelete = (id: string) => {
    deleteMutation.mutate({ id });
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 style={{ fontFamily: "'Doto', 'Space Mono', monospace", fontSize: "20px", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 700, color: "var(--n-text-display)" }}>Sponsors</h1>
          <p style={{ fontFamily: "'Space Mono', monospace", color: "var(--n-text-secondary)", marginTop: "4px" }}>[LOADING...]</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 style={{ fontFamily: "'Doto', 'Space Mono', monospace", fontSize: "20px", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 700, color: "var(--n-text-display)" }}>Sponsors</h1>
          <p className="n-label" style={{ marginTop: "4px", color: "var(--n-text-secondary)" }}>
            GEREZ VOS SPONSORS ET PARTENAIRES
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="n-btn-primary">
              <Plus className="mr-2 h-4 w-4" />
              Nouveau sponsor
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="n-font-body">Creer un sponsor</DialogTitle>
              <DialogDescription className="n-font-body">
                Ajoutez un nouveau sponsor a votre organisation.
              </DialogDescription>
            </DialogHeader>
            <SponsorForm
              onSuccess={() => {
                setIsCreateOpen(false);
                void refetch();
              }}
              onCancel={() => setIsCreateOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {!sponsors || sponsors.length === 0 ? (
        <div className="n-card p-12 text-center">
          <div className="flex flex-col items-center">
            <ImageIcon className="h-8 w-8 mb-4" style={{ color: "var(--n-text-secondary)" }} />
            <p style={{ fontFamily: "'Space Mono', monospace", color: "var(--n-text-secondary)", marginBottom: "4px" }}>[AUCUN SPONSOR]</p>
            <p className="n-font-body text-sm mb-6" style={{ color: "var(--n-text-secondary)" }}>
              Commencez par creer votre premier sponsor
            </p>
            <Button className="n-btn-primary" onClick={() => setIsCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Creer un sponsor
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sponsors.map((sponsor) => (
            <div
              key={sponsor.id}
              className="n-card overflow-hidden group"
            >
              {sponsor.logo && (
                <div
                  className="h-32 flex items-center justify-center p-4"
                  style={{ borderBottom: "1px solid var(--n-border)" }}
                >
                  <img
                    src={sponsor.logo}
                    alt={sponsor.name}
                    className="max-h-full max-w-full object-contain"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = "none";
                      const parent = target.parentElement;
                      if (parent && !parent.querySelector(".fallback-icon")) {
                        const fallback = document.createElement("div");
                        fallback.className = "fallback-icon flex flex-col items-center gap-2";
                        fallback.style.color = "var(--n-text-secondary)";
                        fallback.innerHTML =
                          '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg><span class="text-xs">Image non disponible</span>';
                        parent.appendChild(fallback);
                      }
                    }}
                  />
                </div>
              )}
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <h3 className="n-font-body font-medium">{sponsor.name}</h3>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Dialog
                      open={editingSponsor === sponsor.id}
                      onOpenChange={(open) => setEditingSponsor(open ? sponsor.id : null)}
                    >
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle className="n-font-body">Modifier le sponsor</DialogTitle>
                          <DialogDescription className="n-font-body">
                            Modifiez les informations du sponsor.
                          </DialogDescription>
                        </DialogHeader>
                        <SponsorForm
                          sponsorId={sponsor.id}
                          onSuccess={() => {
                            setEditingSponsor(null);
                            void refetch();
                          }}
                          onCancel={() => setEditingSponsor(null)}
                        />
                      </DialogContent>
                    </Dialog>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle className="n-font-body">Supprimer ce sponsor ?</AlertDialogTitle>
                          <AlertDialogDescription className="n-font-body">
                            Cette action est irreversible. Le sponsor sera egalement
                            retire de toutes les cups auxquelles il est associe.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="n-btn-secondary">Annuler</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(sponsor.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Supprimer
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>

                {sponsor.description && (
                  <p className="n-font-body text-sm mt-1 line-clamp-2" style={{ color: "var(--n-text-secondary)" }}>
                    {sponsor.description}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-3 mt-3">
                  {sponsor.website && (
                    <a
                      href={sponsor.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 n-font-data text-xs transition-colors"
                      style={{ color: "var(--n-text-secondary)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--n-text-primary)")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--n-text-secondary)")}
                    >
                      <ExternalLink className="h-3 w-3" />
                      Site web
                    </a>
                  )}
                  {sponsor.gallery && (sponsor.gallery as string[]).length > 0 && (
                    <span className="n-tag">
                      {(sponsor.gallery as string[]).length} PHOTO{(sponsor.gallery as string[]).length > 1 ? "S" : ""}
                    </span>
                  )}
                  {sponsor.testimonials && (sponsor.testimonials as unknown[]).length > 0 && (
                    <span className="n-tag">
                      {(sponsor.testimonials as unknown[]).length} TEMOIGNAGE{(sponsor.testimonials as unknown[]).length > 1 ? "S" : ""}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
