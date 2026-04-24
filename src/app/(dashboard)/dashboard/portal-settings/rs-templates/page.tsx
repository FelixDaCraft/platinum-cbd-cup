"use client";

import { useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Star,
  FileImage,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import { api } from "~/trpc/react";
import { rsTemplateStyleEnum, type RSTemplateStyle, type RSTemplateColors } from "~/server/db/schema/rs-templates";
import { getDefaultColorsForStyle, getDefaultTextTemplate, getDefaultCaptionTemplate } from "~/lib/portal/image-generator";

const styleLabels: Record<RSTemplateStyle, string> = {
  classic: "Classique",
  modern: "Moderne",
  minimal: "Minimaliste",
  vibrant: "Vibrant",
  elegant: "Élégant",
};

interface TemplateFormData {
  name: string;
  style: RSTemplateStyle;
  textTemplate: string;
  captionTemplate: string;
  colors: RSTemplateColors;
  isDefault: boolean;
}

const defaultFormData: TemplateFormData = {
  name: "",
  style: "classic",
  textTemplate: getDefaultTextTemplate(),
  captionTemplate: getDefaultCaptionTemplate(),
  colors: getDefaultColorsForStyle("classic"),
  isDefault: false,
};

export default function RSTemplatesPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [formData, setFormData] = useState<TemplateFormData>(defaultFormData);

  const { data: templates, isLoading, refetch } = api.rsTemplates.list.useQuery();

  const createMutation = api.rsTemplates.create.useMutation({
    onSuccess: () => {
      setIsCreateOpen(false);
      setFormData(defaultFormData);
      void refetch();
    },
  });

  const updateMutation = api.rsTemplates.update.useMutation({
    onSuccess: () => {
      setEditingTemplate(null);
      setFormData(defaultFormData);
      void refetch();
    },
  });

  const deleteMutation = api.rsTemplates.delete.useMutation({
    onSuccess: () => {
      void refetch();
    },
  });

  const handleStyleChange = (style: RSTemplateStyle) => {
    setFormData({ ...formData, style, colors: getDefaultColorsForStyle(style) });
  };

  const handleCreate = () => {
    createMutation.mutate({
      name: formData.name,
      style: formData.style,
      textTemplate: formData.textTemplate,
      captionTemplate: formData.captionTemplate,
      colors: formData.colors,
      isDefault: formData.isDefault,
    });
  };

  const handleUpdate = () => {
    if (!editingTemplate) return;
    updateMutation.mutate({
      id: editingTemplate,
      name: formData.name,
      style: formData.style,
      textTemplate: formData.textTemplate,
      captionTemplate: formData.captionTemplate,
      colors: formData.colors,
      isDefault: formData.isDefault,
    });
  };

  const handleEdit = (template: NonNullable<typeof templates>[number]) => {
    setFormData({
      name: template.name,
      style: template.style as RSTemplateStyle,
      textTemplate: template.textTemplate,
      captionTemplate: template.captionTemplate ?? getDefaultCaptionTemplate(),
      colors: template.colors as RSTemplateColors,
      isDefault: template.isDefault,
    });
    setEditingTemplate(template.id);
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate({ id });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <span className="n-font-data text-muted-foreground">[LOADING...]</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="n-font-body text-2xl font-semibold">Templates Réseaux Sociaux</h1>
          <p className="n-label text-muted-foreground mt-1">
            Créez des templates pour générer automatiquement des posts pour vos sponsors.
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="n-btn-primary" onClick={() => setFormData(defaultFormData)}>
              <Plus className="mr-2 h-4 w-4" />
              Nouveau template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="n-font-body">Créer un template</DialogTitle>
              <DialogDescription className="n-label">
                Personnalisez le style et le texte de vos posts sponsors.
              </DialogDescription>
            </DialogHeader>
            <TemplateForm
              formData={formData}
              setFormData={setFormData}
              onStyleChange={handleStyleChange}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Annuler
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!formData.name || createMutation.isPending}
              >
                {createMutation.isPending ? "[...]" : "Créer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Variables Help */}
      <div className="n-card p-4">
        <p className="n-label font-medium mb-3">Variables disponibles</p>
        <div className="flex flex-wrap gap-2">
          <span className="n-tag n-font-data">{"{sponsor.name}"}</span>
          <span className="n-tag n-font-data">{"{sponsor.level}"}</span>
          <span className="n-tag n-font-data">{"{cup.name}"}</span>
          <span className="n-tag n-font-data">{"{cup.hashtag}"}</span>
          <span className="n-tag n-font-data">{"{org.name}"}</span>
        </div>
      </div>

      {/* Templates List */}
      {!templates || templates.length === 0 ? (
        <div className="n-card p-12 text-center">
          <FileImage className="mx-auto h-10 w-10 text-muted-foreground/40 mb-4" />
          <h3 className="n-font-body text-lg font-semibold mb-2">Aucun template</h3>
          <p className="n-label text-muted-foreground mb-4">
            Créez votre premier template pour générer des posts sponsors.
          </p>
          <Button className="n-btn-primary" onClick={() => setIsCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Créer un template
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <div key={template.id} className="n-card overflow-hidden group">
              {/* Color Preview */}
              <div
                className="h-24 flex items-center justify-center"
                style={{
                  backgroundColor: (template.colors as RSTemplateColors)?.background ?? "#1a1a2e",
                }}
              >
                <div
                  className="text-center px-4"
                  style={{ color: (template.colors as RSTemplateColors)?.text ?? "#ffffff" }}
                >
                  <p className="n-font-body font-bold">Aperçu</p>
                  <p
                    className="n-label text-sm"
                    style={{ color: (template.colors as RSTemplateColors)?.accent ?? "#f59e0b" }}
                  >
                    {styleLabels[template.style as RSTemplateStyle]}
                  </p>
                </div>
              </div>

              <div className="p-4">
                {/* Title row */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <p className="n-font-body font-semibold">{template.name}</p>
                    {template.isDefault && (
                      <Star className="h-4 w-4 text-yellow-500 fill-yellow-500 shrink-0" />
                    )}
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Dialog
                      open={editingTemplate === template.id}
                      onOpenChange={(open) => {
                        if (!open) {
                          setEditingTemplate(null);
                          setFormData(defaultFormData);
                        }
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(template)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle className="n-font-body">Modifier le template</DialogTitle>
                          <DialogDescription className="n-label">
                            Modifiez le style et le texte du template.
                          </DialogDescription>
                        </DialogHeader>
                        <TemplateForm
                          formData={formData}
                          setFormData={setFormData}
                          onStyleChange={handleStyleChange}
                        />
                        <DialogFooter>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setEditingTemplate(null);
                              setFormData(defaultFormData);
                            }}
                          >
                            Annuler
                          </Button>
                          <Button
                            onClick={handleUpdate}
                            disabled={!formData.name || updateMutation.isPending}
                          >
                            {updateMutation.isPending ? "[...]" : "Sauvegarder"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle className="n-font-body">
                            Supprimer ce template ?
                          </AlertDialogTitle>
                          <AlertDialogDescription className="n-label">
                            Cette action est irréversible.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(template.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Supprimer
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>

                <p className="n-label text-muted-foreground text-sm line-clamp-2 mb-3">
                  {template.textTemplate}
                </p>

                <span className="n-tag">
                  {styleLabels[template.style as RSTemplateStyle]}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface TemplateFormProps {
  formData: TemplateFormData;
  setFormData: (data: TemplateFormData) => void;
  onStyleChange: (style: RSTemplateStyle) => void;
}

function TemplateForm({ formData, setFormData, onStyleChange }: TemplateFormProps) {
  return (
    <div className="space-y-6 py-4">
      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="name" className="n-label">Nom du template</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Mon template sponsor"
        />
      </div>

      {/* Style */}
      <div className="space-y-2">
        <Label className="n-label">Style visuel</Label>
        <Select value={formData.style} onValueChange={onStyleChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {rsTemplateStyleEnum.map((style) => (
              <SelectItem key={style} value={style}>
                <span className="n-label">{styleLabels[style]}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Colors */}
      <div className="space-y-2">
        <Label className="n-label">Couleurs</Label>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label htmlFor="bg-color" className="n-label text-xs text-muted-foreground">
              Fond
            </Label>
            <div className="flex gap-2">
              <input
                type="color"
                id="bg-color"
                value={formData.colors.background}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    colors: { ...formData.colors, background: e.target.value },
                  })
                }
                className="h-9 w-12 rounded border cursor-pointer"
              />
              <Input
                value={formData.colors.background}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    colors: { ...formData.colors, background: e.target.value },
                  })
                }
                className="flex-1 n-font-data text-xs"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="text-color" className="n-label text-xs text-muted-foreground">
              Texte
            </Label>
            <div className="flex gap-2">
              <input
                type="color"
                id="text-color"
                value={formData.colors.text}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    colors: { ...formData.colors, text: e.target.value },
                  })
                }
                className="h-9 w-12 rounded border cursor-pointer"
              />
              <Input
                value={formData.colors.text}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    colors: { ...formData.colors, text: e.target.value },
                  })
                }
                className="flex-1 n-font-data text-xs"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="accent-color" className="n-label text-xs text-muted-foreground">
              Accent
            </Label>
            <div className="flex gap-2">
              <input
                type="color"
                id="accent-color"
                value={formData.colors.accent}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    colors: { ...formData.colors, accent: e.target.value },
                  })
                }
                className="h-9 w-12 rounded border cursor-pointer"
              />
              <Input
                value={formData.colors.accent}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    colors: { ...formData.colors, accent: e.target.value },
                  })
                }
                className="flex-1 n-font-data text-xs"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Text Template */}
      <div className="space-y-2">
        <Label htmlFor="textTemplate" className="n-label">Texte sur l&apos;image</Label>
        <Textarea
          id="textTemplate"
          value={formData.textTemplate}
          onChange={(e) => setFormData({ ...formData, textTemplate: e.target.value })}
          placeholder="Bienvenue à {sponsor.name} comme sponsor {sponsor.level}..."
          rows={2}
        />
      </div>

      {/* Caption Template */}
      <div className="space-y-2">
        <Label htmlFor="captionTemplate" className="n-label">Légende du post</Label>
        <Textarea
          id="captionTemplate"
          value={formData.captionTemplate}
          onChange={(e) => setFormData({ ...formData, captionTemplate: e.target.value })}
          placeholder="Texte d'accompagnement avec #hashtags..."
          rows={4}
        />
      </div>

      {/* Default */}
      <div className="flex items-center justify-between rounded-sm border p-4">
        <div className="space-y-0.5">
          <Label className="n-label font-medium">Template par défaut</Label>
          <p className="n-label text-sm text-muted-foreground">
            Utilisé automatiquement pour les nouveaux sponsors
          </p>
        </div>
        <Switch
          checked={formData.isDefault}
          onCheckedChange={(checked) => setFormData({ ...formData, isDefault: checked })}
        />
      </div>
    </div>
  );
}
