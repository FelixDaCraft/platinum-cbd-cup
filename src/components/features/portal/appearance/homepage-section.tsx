"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Loader2,
  Sparkles,
  Image as ImageIcon,
  Video,
  Palette,
  Type,
  Eye,
} from "lucide-react";

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
import { Slider } from "~/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { SectionsManager } from "~/components/features/portal/sections-manager";

// ═══════════════════════════════════════════════════════════════
// HERO TEMPLATES & MEDIA TYPES
// ═══════════════════════════════════════════════════════════════
const heroTemplates = [
  {
    id: "personas",
    name: "Personas",
    description: "4 cartes cliquables pour les differents profils",
    icon: "👥",
  },
  {
    id: "immersive",
    name: "Immersif",
    description: "Video ou image plein ecran avec overlay",
    icon: "🎬",
  },
  {
    id: "story-stats",
    name: "Story + Stats",
    description: "Texte a gauche, statistiques animees a droite",
    icon: "📊",
  },
  {
    id: "minimalist",
    name: "Minimaliste",
    description: "Logo large centre avec CTA unique",
    icon: "✨",
  },
] as const;

const heroMediaTypes = [
  { id: "image", name: "Image", icon: ImageIcon },
  { id: "video", name: "Video", icon: Video },
  { id: "color", name: "Couleur", icon: Palette },
] as const;

// ═══════════════════════════════════════════════════════════════
// FORM SCHEMA
// ═══════════════════════════════════════════════════════════════
const heroConfigSchema = z.object({
  heroTemplate: z.enum(["personas", "immersive", "story-stats", "minimalist"]),
  heroMediaType: z.enum(["image", "video", "color"]),
  heroMediaUrl: z.string().url("URL invalide").or(z.literal("")).optional(),
  heroOverlayOpacity: z.string(),
  heroTitle: z.string().max(200, "Titre trop long").optional(),
  heroSubtitle: z.string().max(500, "Sous-titre trop long").optional(),
  heroCtaText: z.string().max(50, "Texte CTA trop long").optional(),
  heroCtaUrl: z.string().url("URL invalide").or(z.literal("")).optional(),
});

type HeroConfigValues = z.infer<typeof heroConfigSchema>;

// ═══════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════

/**
 * Hero Template Card
 */
function HeroTemplateCard({
  template,
  isSelected,
  onSelect,
}: {
  template: (typeof heroTemplates)[number];
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="relative flex flex-col items-center gap-2 rounded-xl p-4 text-center transition-colors"
      style={{
        border: isSelected ? "1px solid var(--n-accent)" : "1px solid var(--n-border)",
        background: isSelected ? "var(--n-surface-raised)" : "transparent",
      }}
    >
      {isSelected && (
        <span className="absolute right-2 top-2" style={{ display: "inline-flex", alignItems: "center", padding: "1px 6px", borderRadius: "6px", fontSize: "11px", fontFamily: "'Space Mono', monospace", background: "var(--n-accent)", color: "var(--n-black)" }}>
          Actif
        </span>
      )}

      <span className="text-3xl">{template.icon}</span>
      <div>
        <p className="font-medium">{template.name}</p>
        <p className="text-xs" style={{ color: "var(--n-text-secondary)" }}>{template.description}</p>
      </div>
    </button>
  );
}

/**
 * Hero Preview Component
 */
function HeroPreview({
  template,
  mediaType,
  mediaUrl,
  overlayOpacity,
  title,
  subtitle,
  ctaText,
}: {
  template: string;
  mediaType: string;
  mediaUrl?: string;
  overlayOpacity: string;
  title?: string;
  subtitle?: string;
  ctaText?: string;
}) {
  const opacity = parseFloat(overlayOpacity) / 100;

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--n-border)" }}>
      <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid var(--n-border)" }}>
        <Eye className="h-3 w-3" style={{ color: "var(--n-text-disabled)" }} />
        <span className="text-sm font-medium">Apercu Hero</span>
      </div>
      <div
        className="relative h-40 flex items-center justify-center"
        style={{
          background:
            mediaType === "image" && mediaUrl
              ? `url(${mediaUrl}) center/cover`
              : mediaType === "color"
                ? "linear-gradient(135deg, #f59e0b 0%, #3b82f6 100%)"
                : "#1f2937",
        }}
      >
        {/* Overlay */}
        <div
          className="absolute inset-0 bg-black"
          style={{ opacity }}
        />

        {/* Content Preview */}
        <div className="relative z-10 text-center text-white p-4">
          {template === "personas" && (
            <div className="flex gap-2 justify-center">
              {["👤", "🏪", "🤝", "📰"].map((icon, i) => (
                <div
                  key={i}
                  className="h-8 w-8 rounded-lg bg-white/20 flex items-center justify-center text-sm"
                >
                  {icon}
                </div>
              ))}
            </div>
          )}
          {template === "immersive" && (
            <>
              <p className="text-sm font-bold truncate">{title || "Titre"}</p>
              <p className="text-xs opacity-80 truncate">{subtitle || "Sous-titre"}</p>
              {ctaText && (
                <div className="mt-2 px-3 py-1 bg-white/20 rounded-lg text-xs inline-block">
                  {ctaText}
                </div>
              )}
            </>
          )}
          {template === "story-stats" && (
            <div className="flex gap-4">
              <div className="text-left">
                <p className="text-xs font-medium">{title || "Notre histoire"}</p>
              </div>
              <div className="flex gap-2">
                <div className="h-6 w-6 rounded-lg bg-white/20" />
                <div className="h-6 w-6 rounded-lg bg-white/20" />
              </div>
            </div>
          )}
          {template === "minimalist" && (
            <div className="h-8 w-8 rounded-full bg-white/20 mx-auto" />
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export function HomepageSection() {
  const utils = api.useUtils();

  // Fetch theme config
  const { data: themeConfig, isLoading } = api.portal.getThemeConfig.useQuery();

  // Update hero mutation
  const updateHeroMutation = api.portal.updateHeroConfig.useMutation({
    onSuccess: () => {
      toast.success("Configuration hero mise a jour");
      void utils.portal.getThemeConfig.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  // Hero form
  const heroForm = useForm<HeroConfigValues>({
    resolver: zodResolver(heroConfigSchema),
    values: {
      heroTemplate: (themeConfig?.heroTemplate as HeroConfigValues["heroTemplate"]) ?? "personas",
      heroMediaType: (themeConfig?.heroMediaType as HeroConfigValues["heroMediaType"]) ?? "color",
      heroMediaUrl: themeConfig?.heroMediaUrl ?? "",
      heroOverlayOpacity: themeConfig?.heroOverlayOpacity ?? "40",
      heroTitle: themeConfig?.heroTitle ?? "",
      heroSubtitle: themeConfig?.heroSubtitle ?? "",
      heroCtaText: themeConfig?.heroCtaText ?? "",
      heroCtaUrl: themeConfig?.heroCtaUrl ?? "",
    },
  });

  const handleHeroSubmit = (values: HeroConfigValues) => {
    updateHeroMutation.mutate({
      ...values,
      heroMediaUrl: values.heroMediaUrl || null,
      heroTitle: values.heroTitle || null,
      heroSubtitle: values.heroSubtitle || null,
      heroCtaText: values.heroCtaText || null,
      heroCtaUrl: values.heroCtaUrl || null,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <p className="text-sm" style={{ color: "var(--n-text-disabled)" }}>[LOADING...]</p>
      </div>
    );
  }

  const watchedHero = heroForm.watch();

  return (
    <div className="space-y-6">
      {/* ═══ HERO SECTION ═══ */}
      <Form {...heroForm}>
        <form onSubmit={heroForm.handleSubmit(handleHeroSubmit)} className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-6">
              {/* Hero Template Selection */}
              <div style={{ background: "var(--n-surface)", border: "1px solid var(--n-border)", borderRadius: "12px", padding: "20px" }}>
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="h-4 w-4" style={{ color: "var(--n-text-secondary)" }} />
                  <div>
                    <h3 className="font-semibold">Template Hero</h3>
                    <p className="text-sm" style={{ color: "var(--n-text-secondary)" }}>
                      Choisissez le template pour votre section hero
                    </p>
                  </div>
                </div>
                <FormField
                  control={heroForm.control}
                  name="heroTemplate"
                  render={({ field }) => (
                    <FormItem>
                      <div className="grid gap-4 grid-cols-2">
                        {heroTemplates.map((template) => (
                          <HeroTemplateCard
                            key={template.id}
                            template={template}
                            isSelected={field.value === template.id}
                            onSelect={() => field.onChange(template.id)}
                          />
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Media Configuration */}
              <div style={{ background: "var(--n-surface)", border: "1px solid var(--n-border)", borderRadius: "12px", padding: "20px" }}>
                <div className="flex items-center gap-2 mb-4">
                  <ImageIcon className="h-4 w-4" style={{ color: "var(--n-text-secondary)" }} />
                  <h3 className="font-semibold">Media de fond</h3>
                </div>
                <div className="space-y-4">
                  <FormField
                    control={heroForm.control}
                    name="heroMediaType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type de media</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {heroMediaTypes.map((type) => (
                              <SelectItem key={type.id} value={type.id}>
                                <div className="flex items-center gap-2">
                                  <type.icon className="h-4 w-4" />
                                  {type.name}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {heroForm.watch("heroMediaType") !== "color" && (
                    <FormField
                      control={heroForm.control}
                      name="heroMediaUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            URL {heroForm.watch("heroMediaType") === "video" ? "de la video" : "de l'image"}
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder={
                                heroForm.watch("heroMediaType") === "video"
                                  ? "https://example.com/video.mp4"
                                  : "https://example.com/image.jpg"
                              }
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={heroForm.control}
                    name="heroOverlayOpacity"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between">
                          <FormLabel>Opacite overlay</FormLabel>
                          <span className="text-sm" style={{ color: "var(--n-text-secondary)" }}>
                            {field.value}%
                          </span>
                        </div>
                        <FormControl>
                          <Slider
                            value={[parseInt(field.value)]}
                            onValueChange={(v: number[]) => field.onChange(String(v[0]))}
                            min={0}
                            max={80}
                            step={5}
                          />
                        </FormControl>
                        <FormDescription>
                          Assombrit le media de fond pour ameliorer la lisibilite
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Text Content */}
              <div style={{ background: "var(--n-surface)", border: "1px solid var(--n-border)", borderRadius: "12px", padding: "20px" }}>
                <div className="flex items-center gap-2 mb-4">
                  <Type className="h-4 w-4" style={{ color: "var(--n-text-secondary)" }} />
                  <h3 className="font-semibold">Contenu texte</h3>
                </div>
                <div className="space-y-4">
                  <FormField
                    control={heroForm.control}
                    name="heroTitle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Titre principal</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Bienvenue sur notre portail"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={heroForm.control}
                    name="heroSubtitle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sous-titre</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Decouvrez nos concours et participez a l'excellence"
                            rows={2}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={heroForm.control}
                    name="heroCtaText"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Texte du bouton CTA</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Decouvrir nos cups"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={heroForm.control}
                    name="heroCtaUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Lien du CTA</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="/cups"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </div>

            {/* Preview */}
            <div className="space-y-6">
              <HeroPreview
                template={watchedHero.heroTemplate}
                mediaType={watchedHero.heroMediaType}
                mediaUrl={watchedHero.heroMediaUrl}
                overlayOpacity={watchedHero.heroOverlayOpacity}
                title={watchedHero.heroTitle}
                subtitle={watchedHero.heroSubtitle}
                ctaText={watchedHero.heroCtaText}
              />

              <div style={{ background: "var(--n-surface)", border: "1px solid var(--n-border)", borderRadius: "12px", padding: "20px" }}>
                <div className="flex items-center gap-2 mb-3">
                  <Eye className="h-3 w-3" style={{ color: "var(--n-text-disabled)" }} />
                  <h4 className="text-sm font-medium">Conseils</h4>
                </div>
                <div className="text-sm space-y-2" style={{ color: "var(--n-text-secondary)" }}>
                  <p>• Le template <strong>Personas</strong> est ideal pour diriger les visiteurs vers les sections appropriees.</p>
                  <p>• Le template <strong>Immersif</strong> avec video cree un impact fort.</p>
                  <p>• Utilisez une opacite de 30-50% pour un bon equilibre visuel.</p>
                  <p>• Les images doivent etre en haute resolution (min. 1920x1080).</p>
                </div>
              </div>
            </div>
          </div>

          <Button
            type="submit"
            disabled={updateHeroMutation.isPending}
          >
            {updateHeroMutation.isPending ? (
              <>[LOADING...] Enregistrement...</>
            ) : (
              "Enregistrer la configuration hero"
            )}
          </Button>
        </form>
      </Form>

      {/* ═══ SECTIONS MANAGER ═══ */}
      <SectionsManager />
    </div>
  );
}
