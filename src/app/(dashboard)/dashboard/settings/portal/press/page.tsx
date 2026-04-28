"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Switch } from "~/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
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
} from "~/components/ui/alert-dialog";
import { api } from "~/trpc/react";

const titleStyle: React.CSSProperties = {
  fontFamily: "'Doto', 'Space Mono', monospace",
  fontSize: "20px",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  fontWeight: 700,
  color: "var(--n-text-display)",
};

const cardTitleStyle: React.CSSProperties = {
  fontFamily: "'Doto', 'Space Mono', monospace",
  fontSize: "12px",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--n-text-display)",
  fontWeight: 700,
};

function StatusTag({ status }: { status: "draft" | "published" }) {
  if (status === "published") {
    return (
      <span
        className="n-tag"
        style={{ color: "var(--n-success)", borderColor: "var(--n-success)" }}
      >
        PUBLIÉ
      </span>
    );
  }
  return (
    <span className="n-tag" style={{ color: "var(--n-text-secondary)" }}>
      BROUILLON
    </span>
  );
}

export default function PressEditorPage() {
  const utils = api.useUtils();
  const { data: settings, isLoading: settingsLoading } = api.press.getSettings.useQuery();
  const { data: releases, isLoading: releasesLoading } = api.press.listReleases.useQuery();
  const { data: images, isLoading: imagesLoading } = api.press.listImages.useQuery();

  // ── Settings local state ──────────────────────────────────────────
  const [mediaKitUrl, setMediaKitUrl] = useState("");
  const [mediaKitFileName, setMediaKitFileName] = useState("");
  const [pressEmail, setPressEmail] = useState("");
  const [pressPhone, setPressPhone] = useState("");
  const [showPressReleases, setShowPressReleases] = useState(true);
  const [showGallery, setShowGallery] = useState(true);
  const [showMediaKit, setShowMediaKit] = useState(true);
  const [showContact, setShowContact] = useState(true);

  useEffect(() => {
    if (settings) {
      setMediaKitUrl(settings.mediaKitUrl ?? "");
      setMediaKitFileName(settings.mediaKitFileName ?? "");
      setPressEmail(settings.pressEmail ?? "");
      setPressPhone(settings.pressPhone ?? "");
      setShowPressReleases(settings.showPressReleases !== "false");
      setShowGallery(settings.showGallery !== "false");
      setShowMediaKit(settings.showMediaKit !== "false");
      setShowContact(settings.showContact !== "false");
    }
  }, [settings]);

  const updateSettings = api.press.updateSettings.useMutation({
    onSuccess: () => {
      toast.success("Paramètres enregistrés");
      void utils.press.getSettings.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSaveSettings = () => {
    updateSettings.mutate({
      mediaKitUrl: mediaKitUrl || null,
      mediaKitFileName: mediaKitFileName || null,
      pressEmail: pressEmail || "",
      pressPhone: pressPhone || null,
      showPressReleases,
      showGallery,
      showMediaKit,
      showContact,
    });
  };

  // ── Release actions ───────────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newExcerpt, setNewExcerpt] = useState("");
  const [newCover, setNewCover] = useState("");
  const [newPdf, setNewPdf] = useState("");

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const createRelease = api.press.createRelease.useMutation({
    onSuccess: () => {
      toast.success("Communiqué créé");
      setCreateOpen(false);
      setNewTitle("");
      setNewExcerpt("");
      setNewCover("");
      setNewPdf("");
      void utils.press.listReleases.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const publishRelease = api.press.publishRelease.useMutation({
    onSuccess: () => {
      toast.success("Communiqué publié");
      void utils.press.listReleases.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const unpublishRelease = api.press.unpublishRelease.useMutation({
    onSuccess: () => {
      toast.success("Communiqué dépublié");
      void utils.press.listReleases.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteRelease = api.press.deleteRelease.useMutation({
    onSuccess: () => {
      toast.success("Communiqué supprimé");
      setDeleteId(null);
      void utils.press.listReleases.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="space-y-8">
      {/* ── Header ───────────────────────────────────────────────────── */}
      <div>
        <h1 style={titleStyle}>Presse & Médias</h1>
        <p className="n-label" style={{ marginTop: 4, color: "var(--n-text-secondary)" }}>
          PARAMÈTRES, COMMUNIQUÉS ET GALERIE PHOTO DE LA PAGE /PRESS
        </p>
      </div>

      {/* ── Settings ─────────────────────────────────────────────────── */}
      <div className="n-card space-y-6">
        <div className="flex items-center justify-between">
          <p style={cardTitleStyle}>Paramètres de la page presse</p>
          <Button
            onClick={handleSaveSettings}
            disabled={settingsLoading || updateSettings.isPending}
            className="n-btn-primary"
          >
            {updateSettings.isPending ? (
              <span className="n-font-data text-xs">[ENREGISTREMENT...]</span>
            ) : (
              "Enregistrer"
            )}
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label className="n-label">EMAIL PRESSE</Label>
            <Input
              type="email"
              value={pressEmail}
              onChange={(e) => setPressEmail(e.target.value)}
              placeholder="press@platinum-cbd-cup.eu"
            />
          </div>
          <div className="space-y-2">
            <Label className="n-label">TÉLÉPHONE</Label>
            <Input
              value={pressPhone}
              onChange={(e) => setPressPhone(e.target.value)}
              placeholder="+33 …"
            />
          </div>
          <div className="space-y-2">
            <Label className="n-label">MEDIA KIT URL</Label>
            <Input
              value={mediaKitUrl}
              onChange={(e) => setMediaKitUrl(e.target.value)}
              placeholder="https://…/media-kit.zip"
            />
          </div>
          <div className="space-y-2">
            <Label className="n-label">MEDIA KIT FICHIER</Label>
            <Input
              value={mediaKitFileName}
              onChange={(e) => setMediaKitFileName(e.target.value)}
              placeholder="platinum-media-kit-2026.zip"
            />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 pt-2" style={{ borderTop: "1px solid var(--n-border)" }}>
          <div className="flex items-center justify-between pt-3">
            <Label className="n-label">AFFICHER LES COMMUNIQUÉS</Label>
            <Switch checked={showPressReleases} onCheckedChange={setShowPressReleases} />
          </div>
          <div className="flex items-center justify-between pt-3">
            <Label className="n-label">AFFICHER LA GALERIE</Label>
            <Switch checked={showGallery} onCheckedChange={setShowGallery} />
          </div>
          <div className="flex items-center justify-between">
            <Label className="n-label">AFFICHER LE MEDIA KIT</Label>
            <Switch checked={showMediaKit} onCheckedChange={setShowMediaKit} />
          </div>
          <div className="flex items-center justify-between">
            <Label className="n-label">AFFICHER LE CONTACT</Label>
            <Switch checked={showContact} onCheckedChange={setShowContact} />
          </div>
        </div>
      </div>

      {/* ── Releases ─────────────────────────────────────────────────── */}
      <div className="n-card space-y-4">
        <div className="flex items-center justify-between">
          <p style={cardTitleStyle}>
            Communiqués · {String(releases?.length ?? 0).padStart(2, "0")}
          </p>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="n-btn-secondary">
                <Plus className="mr-2 h-3.5 w-3.5" />
                Nouveau communiqué
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newTitle.trim()) return;
                  createRelease.mutate({
                    title: newTitle.trim(),
                    excerpt: newExcerpt || undefined,
                    coverImageUrl: newCover || undefined,
                    pdfUrl: newPdf || undefined,
                  });
                }}
              >
                <DialogHeader>
                  <DialogTitle className="n-font-body">Nouveau communiqué</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label className="n-label">TITRE *</Label>
                    <Input
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="n-label">EXTRAIT</Label>
                    <Textarea
                      value={newExcerpt}
                      onChange={(e) => setNewExcerpt(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="n-label">IMAGE DE COUVERTURE (URL)</Label>
                    <Input value={newCover} onChange={(e) => setNewCover(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label className="n-label">PDF (URL)</Label>
                    <Input value={newPdf} onChange={(e) => setNewPdf(e.target.value)} />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    className="n-btn-secondary"
                    onClick={() => setCreateOpen(false)}
                  >
                    Annuler
                  </Button>
                  <Button
                    type="submit"
                    disabled={createRelease.isPending}
                    className="n-btn-primary"
                  >
                    {createRelease.isPending ? (
                      <span className="n-font-data text-xs">[CRÉATION...]</span>
                    ) : (
                      "Créer"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {releasesLoading ? (
          <p
            style={{
              fontFamily: "'Space Mono', monospace",
              color: "var(--n-text-secondary)",
              padding: "24px 0",
              textAlign: "center",
            }}
          >
            [LOADING...]
          </p>
        ) : !releases || releases.length === 0 ? (
          <p
            style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: 12,
              color: "var(--n-text-secondary)",
              textAlign: "center",
              padding: "24px 0",
            }}
          >
            [AUCUN COMMUNIQUÉ]
          </p>
        ) : (
          <div className="space-y-2">
            {releases.map((r) => (
              <div
                key={r.id}
                style={{
                  border: "1px solid var(--n-border)",
                  borderRadius: 10,
                  padding: 14,
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div
                    className="n-font-data"
                    style={{ fontSize: 14, color: "var(--n-text-display)", fontWeight: 600 }}
                  >
                    {r.title}
                  </div>
                  {r.excerpt && (
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--n-text-secondary)",
                        marginTop: 4,
                        lineHeight: 1.5,
                      }}
                    >
                      {r.excerpt}
                    </div>
                  )}
                </div>
                <StatusTag status={r.status} />
                {r.status === "published" ? (
                  <Button
                    onClick={() => unpublishRelease.mutate({ id: r.id })}
                    variant="outline"
                    size="sm"
                    className="n-btn-secondary"
                  >
                    <EyeOff className="mr-2 h-3.5 w-3.5" />
                    Dépublier
                  </Button>
                ) : (
                  <Button
                    onClick={() => publishRelease.mutate({ id: r.id })}
                    variant="outline"
                    size="sm"
                    className="n-btn-secondary"
                  >
                    <Eye className="mr-2 h-3.5 w-3.5" />
                    Publier
                  </Button>
                )}
                <Button
                  onClick={() => setDeleteId(r.id)}
                  variant="ghost"
                  size="icon"
                  aria-label="Supprimer"
                >
                  <Trash2 className="h-4 w-4" style={{ color: "var(--n-accent)" }} />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Gallery ──────────────────────────────────────────────────── */}
      <div className="n-card space-y-4">
        <p style={cardTitleStyle}>
          Galerie · {String(images?.length ?? 0).padStart(2, "0")}
        </p>

        {imagesLoading ? (
          <p
            style={{
              fontFamily: "'Space Mono', monospace",
              color: "var(--n-text-secondary)",
              padding: "24px 0",
              textAlign: "center",
            }}
          >
            [LOADING...]
          </p>
        ) : !images || images.length === 0 ? (
          <p
            style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: 12,
              color: "var(--n-text-secondary)",
              textAlign: "center",
              padding: "24px 0",
            }}
          >
            [GALERIE VIDE — UPLOAD D'IMAGES À VENIR]
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            {images.map((img) => (
              <div
                key={img.id}
                style={{
                  border: "1px solid var(--n-border)",
                  borderRadius: 10,
                  overflow: "hidden",
                  background: "var(--n-surface)",
                }}
              >
                <div
                  style={{
                    aspectRatio: "4/3",
                    background: `url(${img.thumbnailUrl ?? img.imageUrl}) center/cover no-repeat`,
                  }}
                />
                <div style={{ padding: 10 }}>
                  <div
                    className="n-font-data"
                    style={{
                      fontSize: 12,
                      color: "var(--n-text-display)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {img.title}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Delete release confirm ──────────────────────────────────── */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="n-font-body">Supprimer ce communiqué ?</AlertDialogTitle>
            <AlertDialogDescription className="n-font-body">
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="n-btn-secondary">Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteRelease.mutate({ id: deleteId })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteRelease.isPending ? (
                <span className="n-font-data text-xs">[SUPPRESSION...]</span>
              ) : (
                "Supprimer"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
