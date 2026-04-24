"use client";

import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Megaphone,
  FileText,
  Image,
  Settings,
  Plus,
  Pencil,
  Trash2,
  Save,
  Eye,
  EyeOff,
  Download,
  Upload,
  Mail,
  Phone,
  ExternalLink,
  MoreVertical,
  GripVertical,
  X,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Switch } from "~/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
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
import { toast } from "sonner";
import { FileUpload } from "~/components/ui/file-upload";

// ========================================
// TYPES
// ========================================

interface PressRelease {
  id: string;
  title: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  pdfUrl: string | null;
  status: "draft" | "published";
  publishedAt: Date | null;
  displayOrder: number;
  createdAt: Date;
  author?: {
    id: string;
    name: string | null;
    image: string | null;
  };
}

interface GalleryImage {
  id: string;
  title: string;
  alt: string | null;
  imageUrl: string;
  thumbnailUrl: string | null;
  width: number | null;
  height: number | null;
  fileSize: number | null;
  displayOrder: number;
  createdAt: Date;
}

// ========================================
// SORTABLE IMAGE ITEM
// ========================================

function SortableImageItem({
  image,
  onEdit,
  onDelete,
}: {
  image: GalleryImage;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: image.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      className="group relative aspect-square rounded-xl overflow-hidden"
      style={{
        ...style,
        border: isDragging ? "2px solid var(--n-accent)" : "1px solid var(--n-border)",
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      {/* Image */}
      <img
        src={image.thumbnailUrl ?? image.imageUrl}
        alt={image.alt ?? image.title}
        className="w-full h-full object-cover"
      />

      {/* Overlay */}
      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
        {/* Drag Handle */}
        <button
          className="p-2 bg-white/10 rounded-lg hover:bg-white/20 cursor-grab active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <button
          onClick={onEdit}
          className="p-2 bg-white/10 rounded-lg hover:bg-white/20"
        >
          <Pencil className="h-4 w-4" />
        </button>

        <button
          onClick={onDelete}
          className="p-2 rounded-lg"
          style={{ background: "rgba(229,62,62,0.2)", color: "var(--n-accent)" }}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Title */}
      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
        <p className="text-xs font-medium truncate">{image.title}</p>
      </div>
    </div>
  );
}

// ========================================
// PRESS SETTINGS TAB
// ========================================

function PressSettingsTab() {
  const utils = api.useUtils();
  const { data: settings, isLoading } = api.press.getSettings.useQuery();

  const [formData, setFormData] = useState({
    mediaKitUrl: "",
    mediaKitFileName: "",
    pressEmail: "",
    pressPhone: "",
    showPressReleases: true,
    showGallery: true,
    showMediaKit: true,
    showContact: true,
  });

  const [hasChanges, setHasChanges] = useState(false);

  // Initialize form from settings
  useState(() => {
    if (settings) {
      setFormData({
        mediaKitUrl: settings.mediaKitUrl ?? "",
        mediaKitFileName: settings.mediaKitFileName ?? "",
        pressEmail: settings.pressEmail ?? "",
        pressPhone: settings.pressPhone ?? "",
        showPressReleases: settings.showPressReleases === "true",
        showGallery: settings.showGallery === "true",
        showMediaKit: settings.showMediaKit === "true",
        showContact: settings.showContact === "true",
      });
    }
  });

  // Update form when settings load
  if (settings && !hasChanges) {
    const newData = {
      mediaKitUrl: settings.mediaKitUrl ?? "",
      mediaKitFileName: settings.mediaKitFileName ?? "",
      pressEmail: settings.pressEmail ?? "",
      pressPhone: settings.pressPhone ?? "",
      showPressReleases: settings.showPressReleases === "true",
      showGallery: settings.showGallery === "true",
      showMediaKit: settings.showMediaKit === "true",
      showContact: settings.showContact === "true",
    };
    if (JSON.stringify(newData) !== JSON.stringify(formData)) {
      setFormData(newData);
    }
  }

  const updateMutation = api.press.updateSettings.useMutation({
    onSuccess: () => {
      toast.success("Parametres sauvegardes");
      utils.press.getSettings.invalidate();
      setHasChanges(false);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    updateMutation.mutate({
      mediaKitUrl: formData.mediaKitUrl || null,
      mediaKitFileName: formData.mediaKitFileName || null,
      pressEmail: formData.pressEmail || null,
      pressPhone: formData.pressPhone || null,
      showPressReleases: formData.showPressReleases,
      showGallery: formData.showGallery,
      showMediaKit: formData.showMediaKit,
      showContact: formData.showContact,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <p className="text-sm" style={{ color: "var(--n-text-disabled)" }}>[LOADING...]</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Media Kit Section */}
      <div className="space-y-4" style={{ background: "var(--n-surface)", border: "1px solid var(--n-border)", borderRadius: "12px", padding: "20px" }}>
        <div className="flex items-center gap-2 mb-4">
          <Download className="h-4 w-4" style={{ color: "var(--n-text-secondary)" }} />
          <div>
            <h3 className="font-semibold">Kit Media</h3>
            <p className="text-sm" style={{ color: "var(--n-text-secondary)" }}>
              Fichier telechargeable (ZIP, PDF) pour les journalistes
            </p>
          </div>
        </div>

        <FileUpload
          uploadEndpoint="/api/upload/media-kit"
          currentFileUrl={formData.mediaKitUrl || undefined}
          currentFileName={formData.mediaKitFileName || undefined}
          onUploadComplete={(result) => {
            handleChange("mediaKitUrl", result.url);
            handleChange("mediaKitFileName", result.fileName);
          }}
          onRemove={() => {
            handleChange("mediaKitUrl", "");
            handleChange("mediaKitFileName", "");
          }}
          accept={{
            "application/zip": [".zip"],
            "application/x-zip-compressed": [".zip"],
            "application/pdf": [".pdf"],
            "application/x-rar-compressed": [".rar"],
            "application/x-7z-compressed": [".7z"],
          }}
          maxSize={50 * 1024 * 1024}
          label="Glissez votre kit media ou cliquez pour selectionner"
          description="ZIP, PDF, RAR ou 7Z - max 50 Mo"
        />
      </div>

      {/* Contact Section */}
      <div className="space-y-4" style={{ background: "var(--n-surface)", border: "1px solid var(--n-border)", borderRadius: "12px", padding: "20px" }}>
        <div className="flex items-center gap-2 mb-4">
          <Mail className="h-4 w-4" style={{ color: "var(--n-text-secondary)" }} />
          <div>
            <h3 className="font-semibold">Contact Presse</h3>
            <p className="text-sm" style={{ color: "var(--n-text-secondary)" }}>
              Informations de contact pour les demandes presse
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="pressEmail">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "var(--n-text-disabled)" }} />
              <Input
                id="pressEmail"
                type="email"
                placeholder="presse@example.com"
                value={formData.pressEmail}
                onChange={(e) => handleChange("pressEmail", e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pressPhone">Telephone</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "var(--n-text-disabled)" }} />
              <Input
                id="pressPhone"
                type="tel"
                placeholder="+33 1 23 45 67 89"
                value={formData.pressPhone}
                onChange={(e) => handleChange("pressPhone", e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Visibility Section */}
      <div className="space-y-4" style={{ background: "var(--n-surface)", border: "1px solid var(--n-border)", borderRadius: "12px", padding: "20px" }}>
        <div className="flex items-center gap-2 mb-4">
          <Eye className="h-4 w-4" style={{ color: "var(--n-text-secondary)" }} />
          <div>
            <h3 className="font-semibold">Visibilite des sections</h3>
            <p className="text-sm" style={{ color: "var(--n-text-secondary)" }}>
              Choisissez les sections a afficher sur la page presse publique
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg" style={{ border: "1px solid var(--n-border)" }}>
            <div className="flex items-center gap-3">
              <FileText className="h-4 w-4" style={{ color: "var(--n-text-secondary)" }} />
              <span>Communiques de presse</span>
            </div>
            <Switch
              checked={formData.showPressReleases}
              onCheckedChange={(v) => handleChange("showPressReleases", v)}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg" style={{ border: "1px solid var(--n-border)" }}>
            <div className="flex items-center gap-3">
              <Image className="h-4 w-4" style={{ color: "var(--n-text-secondary)" }} />
              <span>Galerie photos</span>
            </div>
            <Switch
              checked={formData.showGallery}
              onCheckedChange={(v) => handleChange("showGallery", v)}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg" style={{ border: "1px solid var(--n-border)" }}>
            <div className="flex items-center gap-3">
              <Download className="h-4 w-4" style={{ color: "var(--n-text-secondary)" }} />
              <span>Kit Media</span>
            </div>
            <Switch
              checked={formData.showMediaKit}
              onCheckedChange={(v) => handleChange("showMediaKit", v)}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg" style={{ border: "1px solid var(--n-border)" }}>
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4" style={{ color: "var(--n-text-secondary)" }} />
              <span>Contact presse</span>
            </div>
            <Switch
              checked={formData.showContact}
              onCheckedChange={(v) => handleChange("showContact", v)}
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={!hasChanges || updateMutation.isPending}
        >
          {updateMutation.isPending ? (
            "[LOADING...]"
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Sauvegarder
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// ========================================
// PRESS RELEASES TAB
// ========================================

function PressReleasesTab() {
  const utils = api.useUtils();
  const { data: releases, isLoading } = api.press.listReleases.useQuery();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRelease, setEditingRelease] = useState<PressRelease | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    excerpt: "",
    coverImageUrl: "",
    pdfUrl: "",
  });

  const createMutation = api.press.createRelease.useMutation({
    onSuccess: () => {
      toast.success("Communique cree");
      utils.press.listReleases.invalidate();
      setDialogOpen(false);
      resetForm();
    },
    onError: (error) => toast.error(error.message),
  });

  const updateMutation = api.press.updateRelease.useMutation({
    onSuccess: () => {
      toast.success("Communique mis a jour");
      utils.press.listReleases.invalidate();
      setDialogOpen(false);
      setEditingRelease(null);
      resetForm();
    },
    onError: (error) => toast.error(error.message),
  });

  const publishMutation = api.press.publishRelease.useMutation({
    onSuccess: () => {
      toast.success("Communique publie");
      utils.press.listReleases.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const unpublishMutation = api.press.unpublishRelease.useMutation({
    onSuccess: () => {
      toast.success("Communique depublie");
      utils.press.listReleases.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteMutation = api.press.deleteRelease.useMutation({
    onSuccess: () => {
      toast.success("Communique supprime");
      utils.press.listReleases.invalidate();
      setDeleteId(null);
    },
    onError: (error) => toast.error(error.message),
  });

  const resetForm = () => {
    setFormData({ title: "", excerpt: "", coverImageUrl: "", pdfUrl: "" });
  };

  const handleEdit = (release: PressRelease) => {
    setEditingRelease(release);
    setFormData({
      title: release.title,
      excerpt: release.excerpt ?? "",
      coverImageUrl: release.coverImageUrl ?? "",
      pdfUrl: release.pdfUrl ?? "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (editingRelease) {
      updateMutation.mutate({
        id: editingRelease.id,
        title: formData.title,
        excerpt: formData.excerpt || null,
        coverImageUrl: formData.coverImageUrl || null,
        pdfUrl: formData.pdfUrl || null,
      });
    } else {
      createMutation.mutate({
        title: formData.title,
        excerpt: formData.excerpt || undefined,
        coverImageUrl: formData.coverImageUrl || undefined,
        pdfUrl: formData.pdfUrl || undefined,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <p className="text-sm" style={{ color: "var(--n-text-disabled)" }}>[LOADING...]</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: "var(--n-text-secondary)" }}>
          {releases?.length ?? 0} communique(s)
        </p>
        <Button
          onClick={() => {
            setEditingRelease(null);
            resetForm();
            setDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Nouveau communique
        </Button>
      </div>

      {/* List */}
      {releases && releases.length > 0 ? (
        <div className="space-y-3">
          {releases.map((release) => (
            <div
              key={release.id}
              className="p-4 flex items-center gap-4"
              style={{ border: "1px solid var(--n-border)", borderRadius: "12px" }}
            >
              {/* Thumbnail or Icon */}
              {release.coverImageUrl ? (
                <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0" style={{ border: "1px solid var(--n-border)" }}>
                  <img
                    src={release.coverImageUrl}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <FileText className="h-5 w-5 shrink-0" style={{ color: "var(--n-text-secondary)" }} />
              )}

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium truncate">{release.title}</h4>
                  {release.status === "published" ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "1px 8px", borderRadius: "6px", fontSize: "12px", fontFamily: "'Space Mono', monospace", background: "rgba(56,161,105,0.1)", color: "var(--n-success)", border: "1px solid rgba(56,161,105,0.3)" }}>
                      <Eye className="h-3 w-3" /> Publie
                    </span>
                  ) : (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "1px 8px", borderRadius: "6px", fontSize: "12px", fontFamily: "'Space Mono', monospace", background: "var(--n-surface-raised)", color: "var(--n-text-secondary)", border: "1px solid var(--n-border-visible)" }}>
                      <EyeOff className="h-3 w-3" /> Brouillon
                    </span>
                  )}
                </div>
                {release.excerpt && (
                  <p className="text-sm truncate" style={{ color: "var(--n-text-secondary)" }}>
                    {release.excerpt}
                  </p>
                )}
                <p className="text-xs mt-1" style={{ color: "var(--n-text-disabled)" }}>
                  Cree le {format(new Date(release.createdAt), "d MMM yyyy", { locale: fr })}
                </p>
              </div>

              {/* PDF Link */}
              {release.pdfUrl && (
                <a
                  href={release.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg"
                  style={{ border: "1px solid var(--n-border)" }}
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}

              {/* Actions */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="shrink-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleEdit(release)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Modifier
                  </DropdownMenuItem>
                  {release.status === "draft" ? (
                    <DropdownMenuItem
                      onClick={() => publishMutation.mutate({ id: release.id })}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Publier
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      onClick={() => unpublishMutation.mutate({ id: release.id })}
                    >
                      <EyeOff className="h-4 w-4 mr-2" />
                      Depublier
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setDeleteId(release.id)}
                    style={{ color: "var(--n-accent)" }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Supprimer
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-12 text-center" style={{ border: "1px solid var(--n-border)", borderRadius: "12px" }}>
          <FileText className="h-12 w-12 mx-auto mb-4" style={{ color: "var(--n-text-disabled)", opacity: 0.5 }} />
          <h3 className="font-medium mb-1">Aucun communique</h3>
          <p className="text-sm" style={{ color: "var(--n-text-secondary)" }}>
            Creez votre premier communique de presse
          </p>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingRelease ? "Modifier le communique" : "Nouveau communique"}
            </DialogTitle>
            <DialogDescription>
              {editingRelease
                ? "Modifiez les informations du communique de presse"
                : "Ajoutez un nouveau communique de presse"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Image de couverture - EN PREMIER */}
            <div className="space-y-2">
              <Label>Image de couverture</Label>
              {formData.coverImageUrl ? (
                <div className="relative">
                  <div className="h-32 rounded-lg overflow-hidden border">
                    <img
                      src={formData.coverImageUrl}
                      alt="Couverture"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-7 w-7"
                    onClick={() => setFormData((prev) => ({ ...prev, coverImageUrl: "" }))}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div
                  className="h-32 rounded-lg flex flex-col items-center justify-center cursor-pointer transition-colors"
                  style={{ border: "2px dashed var(--n-border-visible)" }}
                  onClick={() => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = "image/*";
                    input.onchange = async (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0];
                      if (!file) return;
                      const formDataUpload = new FormData();
                      formDataUpload.append("file", file);
                      formDataUpload.append("folder", "press");
                      try {
                        const res = await fetch("/api/upload", {
                          method: "POST",
                          body: formDataUpload,
                        });
                        const data = await res.json();
                        if (data.url) {
                          setFormData((prev) => ({ ...prev, coverImageUrl: data.url }));
                        }
                      } catch (err) {
                        toast.error("Erreur lors de l'upload");
                      }
                    };
                    input.click();
                  }}
                >
                  <Upload className="h-6 w-6 mb-2" style={{ color: "var(--n-text-secondary)" }} />
                  <span className="text-sm" style={{ color: "var(--n-text-secondary)" }}>Cliquez pour ajouter une image</span>
                  <span className="text-xs" style={{ color: "var(--n-text-disabled)" }}>JPG, PNG, WebP - max 5 Mo</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Titre *</Label>
              <Input
                id="title"
                placeholder="Titre du communique"
                value={formData.title}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, title: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="excerpt">Resume</Label>
              <Textarea
                id="excerpt"
                placeholder="Bref resume du communique..."
                value={formData.excerpt}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, excerpt: e.target.value }))
                }
                className="min-h-[80px]"
              />
            </div>

            <div className="space-y-2">
              <Label>Fichier PDF (optionnel)</Label>
              <FileUpload
                uploadEndpoint="/api/upload"
                currentFileUrl={formData.pdfUrl || undefined}
                currentFileName={formData.pdfUrl ? formData.pdfUrl.split("/").pop() : undefined}
                onUploadComplete={(result) => {
                  setFormData((prev) => ({ ...prev, pdfUrl: result.url }));
                }}
                onRemove={() => {
                  setFormData((prev) => ({ ...prev, pdfUrl: "" }));
                }}
                accept={{
                  "application/pdf": [".pdf"],
                }}
                maxSize={50 * 1024 * 1024}
                label="Glissez le PDF ou cliquez"
                description="PDF - max 50 Mo"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                !formData.title ||
                createMutation.isPending ||
                updateMutation.isPending
              }
            >
              {(createMutation.isPending || updateMutation.isPending)
                ? "[LOADING...]"
                : editingRelease ? "Mettre a jour" : "Creer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce communique ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irreversible. Le communique sera definitivement
              supprime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}
              style={{ background: "var(--n-accent)" }}
            >
              {deleteMutation.isPending ? "[LOADING...]" : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ========================================
// GALLERY TAB
// ========================================

function GalleryTab() {
  const utils = api.useUtils();
  const { data: images, isLoading } = api.press.listImages.useQuery();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingImage, setEditingImage] = useState<GalleryImage | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    alt: "",
    imageUrl: "",
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const addMutation = api.press.addImage.useMutation({
    onSuccess: () => {
      toast.success("Image ajoutee");
      utils.press.listImages.invalidate();
      setDialogOpen(false);
      resetForm();
    },
    onError: (error) => toast.error(error.message),
  });

  const updateMutation = api.press.updateImage.useMutation({
    onSuccess: () => {
      toast.success("Image mise a jour");
      utils.press.listImages.invalidate();
      setDialogOpen(false);
      setEditingImage(null);
      resetForm();
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteMutation = api.press.deleteImage.useMutation({
    onSuccess: () => {
      toast.success("Image supprimee");
      utils.press.listImages.invalidate();
      setDeleteId(null);
    },
    onError: (error) => toast.error(error.message),
  });

  const reorderMutation = api.press.reorderImages.useMutation({
    onError: (error) => toast.error(error.message),
  });

  const resetForm = () => {
    setFormData({ title: "", alt: "", imageUrl: "" });
  };

  const handleEdit = (image: GalleryImage) => {
    setEditingImage(image);
    setFormData({
      title: image.title,
      alt: image.alt ?? "",
      imageUrl: image.imageUrl,
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (editingImage) {
      updateMutation.mutate({
        id: editingImage.id,
        title: formData.title,
        alt: formData.alt || null,
      });
    } else {
      addMutation.mutate({
        title: formData.title,
        alt: formData.alt || undefined,
        imageUrl: formData.imageUrl,
      });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id && images) {
      const oldIndex = images.findIndex((img) => img.id === active.id);
      const newIndex = images.findIndex((img) => img.id === over.id);
      const newOrder = arrayMove(images, oldIndex, newIndex);

      // Optimistic update
      utils.press.listImages.setData(undefined, newOrder);

      // Save to server
      reorderMutation.mutate({
        orderedIds: newOrder.map((img) => img.id),
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <p className="text-sm" style={{ color: "var(--n-text-disabled)" }}>[LOADING...]</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: "var(--n-text-secondary)" }}>
          {images?.length ?? 0} image(s) - Glissez-deposez pour reordonner
        </p>
        <Button
          onClick={() => {
            setEditingImage(null);
            resetForm();
            setDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Ajouter une image
        </Button>
      </div>

      {/* Gallery Grid */}
      {images && images.length > 0 ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={images.map((img) => img.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {images.map((image) => (
                <SortableImageItem
                  key={image.id}
                  image={image}
                  onEdit={() => handleEdit(image)}
                  onDelete={() => setDeleteId(image.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="p-12 text-center" style={{ border: "1px solid var(--n-border)", borderRadius: "12px" }}>
          <Image className="h-12 w-12 mx-auto mb-4" style={{ color: "var(--n-text-disabled)", opacity: 0.5 }} />
          <h3 className="font-medium mb-1">Aucune image</h3>
          <p className="text-sm" style={{ color: "var(--n-text-secondary)" }}>
            Ajoutez des images a votre galerie presse
          </p>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingImage ? "Modifier l'image" : "Ajouter une image"}
            </DialogTitle>
            <DialogDescription>
              {editingImage
                ? "Modifiez les informations de l'image"
                : "Ajoutez une nouvelle image a la galerie"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="img-title">Titre *</Label>
              <Input
                id="img-title"
                placeholder="Titre de l'image"
                value={formData.title}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, title: e.target.value }))
                }
              />
            </div>

            {!editingImage && (
              <div className="space-y-2">
                <Label htmlFor="img-url">URL de l&apos;image *</Label>
                <Input
                  id="img-url"
                  placeholder="https://..."
                  value={formData.imageUrl}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, imageUrl: e.target.value }))
                  }
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="img-alt">Texte alternatif (accessibilite)</Label>
              <Input
                id="img-alt"
                placeholder="Description de l'image"
                value={formData.alt}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, alt: e.target.value }))
                }
              />
            </div>

            {/* Preview - taille reduite */}
            {formData.imageUrl && (
              <div className="space-y-2">
                <Label>Apercu</Label>
                <div className="h-24 w-32 rounded-lg overflow-hidden border">
                  <img
                    src={formData.imageUrl}
                    alt="Apercu"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23333' width='100' height='100'/%3E%3Ctext fill='%23666' x='50%25' y='50%25' text-anchor='middle' dy='.3em'%3EImage%3C/text%3E%3C/svg%3E";
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                !formData.title ||
                (!editingImage && !formData.imageUrl) ||
                addMutation.isPending ||
                updateMutation.isPending
              }
            >
              {(addMutation.isPending || updateMutation.isPending)
                ? "[LOADING...]"
                : editingImage ? "Mettre a jour" : "Ajouter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette image ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irreversible. L&apos;image sera definitivement
              supprimee de la galerie.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}
              style={{ background: "var(--n-accent)" }}
            >
              {deleteMutation.isPending ? "[LOADING...]" : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ========================================
// MAIN COMPONENT
// ========================================

export function PressManager() {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="settings" className="space-y-6">
        <TabsList>
          <TabsTrigger value="settings">
            <Settings className="h-4 w-4 mr-2" />
            Parametres
          </TabsTrigger>
          <TabsTrigger value="releases">
            <FileText className="h-4 w-4 mr-2" />
            Communiques
          </TabsTrigger>
          <TabsTrigger value="gallery">
            <Megaphone className="h-4 w-4 mr-2" />
            Galerie
          </TabsTrigger>
        </TabsList>

        <TabsContent value="settings">
          <PressSettingsTab />
        </TabsContent>

        <TabsContent value="releases">
          <PressReleasesTab />
        </TabsContent>

        <TabsContent value="gallery">
          <GalleryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
