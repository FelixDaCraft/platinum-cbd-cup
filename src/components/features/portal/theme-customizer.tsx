"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Check, Palette, Image as ImageIcon, Code, RefreshCw, Sun, Moon } from "lucide-react";

import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Separator } from "~/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { Label } from "~/components/ui/label";

// Color input schema
const themeFormSchema = z.object({
  primaryColor: z
    .string()
    .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Format hexadécimal requis (#RRGGBB)"),
  secondaryColor: z
    .string()
    .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Format hexadécimal requis (#RRGGBB)"),
  logoUrl: z.string().url("URL invalide").or(z.literal("")).optional(),
});

type ThemeFormValues = z.infer<typeof themeFormSchema>;

// Custom CSS form schema
const customCssSchema = z.object({
  customCss: z.string().max(50000, "CSS trop long (max 50000 caractères)"),
});

type CustomCssValues = z.infer<typeof customCssSchema>;

/**
 * Theme preset card component
 */
function ThemePresetCard({
  preset,
  isSelected,
  onSelect,
  isLoading,
}: {
  preset: {
    id: string;
    name: string;
    description: string;
    primaryColor: string;
    secondaryColor: string;
    backgroundColor: string;
  };
  isSelected: boolean;
  onSelect: () => void;
  isLoading: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={isLoading}
      className="relative flex flex-col items-start gap-2 rounded-xl p-4 text-left transition-colors w-full h-full"
      style={{
        border: isSelected ? "1px solid var(--n-accent)" : "1px solid var(--n-border)",
        background: isSelected ? "var(--n-surface-raised)" : "transparent",
      }}
    >
      {isSelected && (
        <div className="absolute right-2 top-2">
          <div className="flex h-5 w-5 items-center justify-center rounded-full" style={{ background: "var(--n-accent)" }}>
            <Check className="h-3 w-3" style={{ color: "var(--n-black)" }} />
          </div>
        </div>
      )}
      <div className="flex items-center gap-2">
        <div
          className="h-6 w-6 rounded-full"
          style={{ backgroundColor: preset.primaryColor, boxShadow: "0 0 0 1px var(--n-border)" }}
        />
        <div
          className="h-6 w-6 rounded-full"
          style={{ backgroundColor: preset.secondaryColor, boxShadow: "0 0 0 1px var(--n-border)" }}
        />
      </div>
      <div className="flex-1">
        <p className="font-medium">{preset.name}</p>
        <p className="text-xs line-clamp-2" style={{ color: "var(--n-text-secondary)" }}>{preset.description}</p>
      </div>
      <div
        className="mt-auto h-12 w-full rounded-lg"
        style={{ backgroundColor: preset.backgroundColor, boxShadow: "0 0 0 1px var(--n-border)" }}
      >
        <div className="flex h-full items-center justify-center gap-2 p-2">
          <div
            className="h-4 w-12 rounded"
            style={{ backgroundColor: preset.primaryColor }}
          />
          <div
            className="h-4 w-8 rounded"
            style={{ backgroundColor: preset.secondaryColor }}
          />
        </div>
      </div>
    </button>
  );
}

/**
 * Color picker with hex input
 */
function ColorPicker({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-10 cursor-pointer rounded border p-0"
        aria-label={`Sélecteur de couleur ${label}`}
      />
      <div className="flex-1">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
          className="font-mono"
          aria-label={`Code hexadécimal ${label}`}
        />
      </div>
    </div>
  );
}

/**
 * Color mode selector component
 */
function ColorModeSelector({
  value,
  onChange,
  isLoading,
}: {
  value: string;
  onChange: (value: "light" | "dark") => void;
  isLoading: boolean;
}) {
  const options = [
    { value: "light", label: "Clair", icon: Sun, description: "Mode clair" },
    { value: "dark", label: "Sombre", icon: Moon, description: "Mode sombre" },
  ] as const;

  return (
    <RadioGroup
      value={value}
      onValueChange={(v) => onChange(v as "light" | "dark")}
      className="grid grid-cols-2 gap-4"
      disabled={isLoading}
    >
      {options.map((option) => {
        const Icon = option.icon;
        const isSelected = value === option.value;
        return (
          <div key={option.value}>
            <RadioGroupItem
              value={option.value}
              id={`color-mode-${option.value}`}
              className="peer sr-only"
            />
            <Label
              htmlFor={`color-mode-${option.value}`}
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl p-4 transition-colors"
              style={{
                border: isSelected ? "1px solid var(--n-accent)" : "1px solid var(--n-border)",
                background: isSelected ? "var(--n-surface-raised)" : "transparent",
              }}
            >
              <div
                className="flex h-10 w-10 items-center justify-center rounded-lg"
                style={{ border: isSelected ? "1px solid var(--n-accent)" : "1px solid var(--n-border)" }}
              >
                <Icon className="h-5 w-5" style={{ color: isSelected ? "var(--n-accent)" : "var(--n-text-secondary)" }} />
              </div>
              <span className="font-medium">{option.label}</span>
              <span className="text-xs text-center" style={{ color: "var(--n-text-secondary)" }}>
                {option.description}
              </span>
            </Label>
          </div>
        );
      })}
    </RadioGroup>
  );
}

/**
 * Theme preview component
 */
function ThemePreview({
  primaryColor,
  secondaryColor,
  logoUrl,
}: {
  primaryColor: string;
  secondaryColor: string;
  logoUrl?: string | null;
}) {
  return (
    <div style={{ background: "var(--n-surface)", border: "1px solid var(--n-border)", borderRadius: "12px", padding: "20px" }}>
      <div className="mb-4 flex items-center gap-2">
        <ImageIcon className="h-4 w-4" style={{ color: "var(--n-text-secondary)" }} />
        <span className="font-medium">Apercu</span>
      </div>
      <div className="rounded-xl p-4" style={{ border: "1px solid var(--n-border)" }}>
        {/* Header preview */}
        <div className="mb-4 flex items-center gap-3 rounded-lg p-3" style={{ border: "1px solid var(--n-border)" }}>
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="h-8 w-8 object-contain" />
          ) : (
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ backgroundColor: primaryColor }}
            >
              <span className="text-xs font-bold text-white">L</span>
            </div>
          )}
          <div className="flex gap-2">
            <div
              className="h-2 w-16 rounded-full"
              style={{ backgroundColor: secondaryColor, opacity: 0.5 }}
            />
            <div
              className="h-2 w-12 rounded-full"
              style={{ backgroundColor: secondaryColor, opacity: 0.5 }}
            />
          </div>
        </div>

        {/* Content preview */}
        <div className="space-y-3">
          <div
            className="h-3 w-3/4 rounded-full"
            style={{ backgroundColor: primaryColor }}
          />
          <div className="h-2 w-full rounded-full" style={{ background: "var(--n-border-visible)" }} />
          <div className="h-2 w-5/6 rounded-full" style={{ background: "var(--n-border-visible)" }} />
          <div className="flex gap-2 mt-4">
            <button
              type="button"
              className="rounded-lg px-4 py-2 text-xs font-medium text-white"
              style={{ backgroundColor: primaryColor }}
            >
              Bouton primaire
            </button>
            <button
              type="button"
              className="rounded-lg px-4 py-2 text-xs font-medium text-white"
              style={{ backgroundColor: secondaryColor }}
            >
              Bouton secondaire
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Theme customizer component
 */
export function ThemeCustomizer() {
  const [activeTab, setActiveTab] = useState("presets");

  const utils = api.useUtils();

  // Fetch theme config
  const { data: themeConfig, isLoading: isLoadingConfig } =
    api.portal.getThemeConfig.useQuery();

  // Fetch theme presets
  const { data: presets } = api.portal.getThemePresets.useQuery();

  // Update theme mutation
  const updateThemeMutation = api.portal.updateTheme.useMutation({
    onSuccess: () => {
      toast.success("Thème mis à jour avec succès");
      utils.portal.getThemeConfig.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Update custom CSS mutation
  const updateCustomCssMutation = api.portal.updateCustomCss.useMutation({
    onSuccess: () => {
      toast.success("CSS personnalisé mis à jour");
      utils.portal.getThemeConfig.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Remove custom CSS mutation
  const removeCustomCssMutation = api.portal.removeCustomCss.useMutation({
    onSuccess: () => {
      toast.success("CSS personnalisé supprimé");
      utils.portal.getThemeConfig.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Theme form
  const themeForm = useForm<ThemeFormValues>({
    resolver: zodResolver(themeFormSchema),
    values: {
      primaryColor: themeConfig?.primaryColor ?? "#f59e0b",
      secondaryColor: themeConfig?.secondaryColor ?? "#3b82f6",
      logoUrl: themeConfig?.logoUrl ?? "",
    },
  });

  // Custom CSS form
  const customCssForm = useForm<CustomCssValues>({
    resolver: zodResolver(customCssSchema),
    values: {
      customCss: themeConfig?.customCss ?? "",
    },
  });

  const handlePresetSelect = (presetId: string) => {
    const preset = presets?.find((p) => p.id === presetId);
    if (!preset) return;

    updateThemeMutation.mutate({
      themePreset: presetId as "default" | "ocean" | "forest" | "sunset" | "royal" | "midnight" | "classic" | "modern",
      primaryColor: preset.primaryColor,
      secondaryColor: preset.secondaryColor,
    });
  };

  const handleColorsSubmit = (values: ThemeFormValues) => {
    updateThemeMutation.mutate({
      primaryColor: values.primaryColor,
      secondaryColor: values.secondaryColor,
      logoUrl: values.logoUrl || null,
    });
  };

  const handleCustomCssSubmit = (values: CustomCssValues) => {
    updateCustomCssMutation.mutate({
      customCss: values.customCss,
    });
  };

  const handleRemoveCustomCss = () => {
    removeCustomCssMutation.mutate();
    customCssForm.reset({ customCss: "" });
  };

  if (isLoadingConfig) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <p className="text-sm" style={{ color: "var(--n-text-disabled)" }}>[LOADING...]</p>
      </div>
    );
  }

  const watchedPrimary = themeForm.watch("primaryColor");
  const watchedSecondary = themeForm.watch("secondaryColor");
  const watchedLogo = themeForm.watch("logoUrl");

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="presets" className="gap-2">
            <Palette className="h-4 w-4" />
            <span className="hidden sm:inline">Themes</span>
          </TabsTrigger>
          <TabsTrigger value="colors" className="gap-2">
            <ImageIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Couleurs & Logo</span>
          </TabsTrigger>
          <TabsTrigger value="css" className="gap-2">
            <Code className="h-4 w-4" />
            <span className="hidden sm:inline">CSS</span>
            <span className="ml-1" style={{ display: "inline-flex", alignItems: "center", padding: "1px 6px", borderRadius: "6px", fontSize: "11px", fontFamily: "'Space Mono', monospace", color: "var(--n-text-secondary)", border: "1px solid var(--n-border-visible)" }}>
              Enterprise
            </span>
          </TabsTrigger>
        </TabsList>

        {/* Presets Tab */}
        <TabsContent value="presets" className="space-y-4 mt-6">
          <div style={{ background: "var(--n-surface)", border: "1px solid var(--n-border)", borderRadius: "12px", padding: "20px" }}>
            <div className="flex items-center gap-2 mb-4">
              <Sun className="h-4 w-4" style={{ color: "var(--n-text-secondary)" }} />
              <div>
                <h3 className="font-semibold">Mode d&apos;affichage</h3>
                <p className="text-sm" style={{ color: "var(--n-text-secondary)" }}>
                  Choisissez le mode de couleur pour votre portail public.
                </p>
              </div>
            </div>
            <ColorModeSelector
              value={themeConfig?.colorMode ?? "light"}
              onChange={(value) => {
                updateThemeMutation.mutate({ colorMode: value });
              }}
              isLoading={updateThemeMutation.isPending}
            />
          </div>

          <div style={{ background: "var(--n-surface)", border: "1px solid var(--n-border)", borderRadius: "12px", padding: "20px" }}>
            <div className="flex items-center gap-2 mb-6">
              <Palette className="h-4 w-4" style={{ color: "var(--n-text-secondary)" }} />
              <div>
                <h3 className="font-semibold">Thèmes prédéfinis</h3>
                <p className="text-sm" style={{ color: "var(--n-text-secondary)" }}>
                  Sélectionnez un thème pour votre portail. Les aperçus s&apos;adaptent au mode choisi.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-4 w-full">
              {presets?.map((preset) => (
                <div key={preset.id} className="w-full h-full min-w-0">
                  <ThemePresetCard
                    preset={preset}
                    isSelected={themeConfig?.themePreset === preset.id}
                    onSelect={() => handlePresetSelect(preset.id)}
                    isLoading={updateThemeMutation.isPending}
                  />
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* Colors Tab */}
        <TabsContent value="colors" className="space-y-4 mt-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <div style={{ background: "var(--n-surface)", border: "1px solid var(--n-border)", borderRadius: "12px", padding: "20px" }}>
              <div className="flex items-center gap-2 mb-4">
                <Palette className="h-4 w-4" style={{ color: "var(--n-text-secondary)" }} />
                <div>
                  <h3 className="font-semibold">Couleurs personnalisees</h3>
                  <p className="text-sm" style={{ color: "var(--n-text-secondary)" }}>
                    Definissez les couleurs de votre marque pour personnaliser le portail.
                  </p>
                </div>
              </div>
              <Form {...themeForm}>
                <form
                  onSubmit={themeForm.handleSubmit(handleColorsSubmit)}
                  className="space-y-6"
                >
                  <FormField
                    control={themeForm.control}
                    name="primaryColor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Couleur primaire</FormLabel>
                        <FormControl>
                          <ColorPicker
                            value={field.value}
                            onChange={field.onChange}
                            label="Primaire"
                          />
                        </FormControl>
                        <FormDescription>
                          Couleur principale utilisee pour les titres et boutons.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={themeForm.control}
                    name="secondaryColor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Couleur secondaire</FormLabel>
                        <FormControl>
                          <ColorPicker
                            value={field.value}
                            onChange={field.onChange}
                            label="Secondaire"
                          />
                        </FormControl>
                        <FormDescription>
                          Couleur d&apos;accent pour les elements secondaires.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Separator />

                  <FormField
                    control={themeForm.control}
                    name="logoUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>URL du logo</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="https://example.com/logo.png"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          URL de votre logo. Formats recommandes : PNG, SVG.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    disabled={updateThemeMutation.isPending}
                  >
                    {updateThemeMutation.isPending ? "[LOADING...]" : "Enregistrer les couleurs"}
                  </Button>
                </form>
              </Form>
            </div>

            <div>
              <ThemePreview
                primaryColor={watchedPrimary}
                secondaryColor={watchedSecondary}
                logoUrl={watchedLogo}
              />
            </div>
          </div>
        </TabsContent>

        {/* Custom CSS Tab */}
        <TabsContent value="css" className="space-y-4 mt-6">
          <div style={{ background: "var(--n-surface)", border: "1px solid var(--n-border)", borderRadius: "12px", padding: "20px" }}>
            <div className="flex items-center gap-2 mb-4">
              <Code className="h-4 w-4" style={{ color: "var(--n-text-secondary)" }} />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">CSS personnalise</h3>
                  <span style={{ display: "inline-flex", alignItems: "center", padding: "1px 6px", borderRadius: "6px", fontSize: "11px", fontFamily: "'Space Mono', monospace", background: "var(--n-surface-raised)", color: "var(--n-text-secondary)", border: "1px solid var(--n-border-visible)" }}>
                    Enterprise
                  </span>
                </div>
                <p className="text-sm" style={{ color: "var(--n-text-secondary)" }}>
                  Ajoutez du CSS personnalise pour une personnalisation avancee de votre portail.
                  Le CSS est automatiquement nettoye pour des raisons de securite.
                </p>
              </div>
            </div>
            <Form {...customCssForm}>
              <form
                onSubmit={customCssForm.handleSubmit(handleCustomCssSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={customCssForm.control}
                  name="customCss"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Code CSS</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={`/* Exemple de CSS personnalise */
.portal-header {
  background: linear-gradient(90deg, var(--portal-primary-hex), var(--portal-secondary-hex));
}

.portal-button {
  border-radius: 9999px;
}`}
                          className="min-h-[300px] font-mono text-sm"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Utilisez les variables CSS du portail : --portal-primary-hex,
                        --portal-secondary-hex, --portal-background-hex, etc.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-2">
                  <Button
                    type="submit"
                    disabled={updateCustomCssMutation.isPending}
                  >
                    {updateCustomCssMutation.isPending ? "[LOADING...]" : "Enregistrer le CSS"}
                  </Button>
                  {themeConfig?.customCss && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleRemoveCustomCss}
                      disabled={removeCustomCssMutation.isPending}
                    >
                      {removeCustomCssMutation.isPending ? "[LOADING...]" : (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Reinitialiser
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </form>
            </Form>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
