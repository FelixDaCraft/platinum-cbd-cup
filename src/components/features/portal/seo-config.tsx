"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Search,
  Globe,
  Twitter,
  Image,
  BarChart3,
  Save,
  Eye,
  AlertCircle,
} from "lucide-react";
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
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { api } from "~/trpc/react";

/**
 * SEO Config Form Schema
 */
const seoConfigSchema = z.object({
  seoTitle: z.string().max(60, "Le titre ne doit pas dépasser 60 caractères").nullable(),
  seoDescription: z.string().max(160, "La description ne doit pas dépasser 160 caractères").nullable(),
  seoKeywords: z.string().max(500).nullable(),
  ogImage: z.string().url("URL invalide").nullable().or(z.literal("")),
  twitterHandle: z.string().max(15).nullable(),
  googleAnalyticsId: z.string().max(20).nullable(),
  googleSearchConsoleId: z.string().max(100).nullable(),
});

type SeoConfigFormValues = z.infer<typeof seoConfigSchema>;

/**
 * Google Search Preview Component
 */
function GoogleSearchPreview({
  title,
  description,
  url,
}: {
  title: string;
  description: string;
  url: string;
}) {
  return (
    <div className="p-4 rounded-xl" style={{ border: "1px solid var(--n-border)" }}>
      <div className="flex items-center gap-2 mb-3">
        <Eye className="h-3 w-3" style={{ color: "var(--n-text-disabled)" }} />
        <p className="text-xs font-medium" style={{ color: "var(--n-text-secondary)" }}>Aperçu Google</p>
      </div>
      <div className="space-y-1 p-3 rounded-lg" style={{ border: "1px solid var(--n-border)" }}>
        <p className="text-sm truncate" style={{ color: "var(--n-text-secondary)" }}>{url}</p>
        <h3 className="text-lg hover:underline cursor-pointer truncate" style={{ color: "var(--n-interactive)" }}>
          {title || "Titre de votre portail"}
        </h3>
        <p className="text-sm line-clamp-2" style={{ color: "var(--n-text-secondary)" }}>
          {description || "Description de votre organisation et de vos concours..."}
        </p>
      </div>
    </div>
  );
}

/**
 * Social Card Preview Component
 */
function SocialCardPreview({
  title,
  description,
  imageUrl,
  siteName,
}: {
  title: string;
  description: string;
  imageUrl: string | null;
  siteName: string;
}) {
  return (
    <div className="p-4 rounded-xl" style={{ border: "1px solid var(--n-border)" }}>
      <div className="flex items-center gap-2 mb-3">
        <Eye className="h-3 w-3" style={{ color: "var(--n-text-disabled)" }} />
        <p className="text-xs font-medium" style={{ color: "var(--n-text-secondary)" }}>Aperçu réseaux sociaux</p>
      </div>
      <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--n-border)" }}>
        {/* Image */}
        <div className="aspect-[1.91/1] flex items-center justify-center" style={{ background: "var(--n-surface-raised)" }}>
          {imageUrl ? (
            <img
              src={imageUrl}
              alt="OG Image"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="text-center">
              <Image className="h-12 w-12 mx-auto mb-2" style={{ color: "var(--n-text-disabled)", opacity: 0.5 }} />
              <p className="text-sm" style={{ color: "var(--n-text-secondary)" }}>Aucune image</p>
            </div>
          )}
        </div>
        {/* Content */}
        <div className="p-3" style={{ borderTop: "1px solid var(--n-border)" }}>
          <p className="text-xs uppercase" style={{ color: "var(--n-text-secondary)" }}>{siteName}</p>
          <h4 className="font-semibold text-sm mt-1 truncate">
            {title || "Titre de votre portail"}
          </h4>
          <p className="text-xs mt-1 line-clamp-2" style={{ color: "var(--n-text-secondary)" }}>
            {description || "Description de votre organisation..."}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Character Counter Component
 */
function CharacterCounter({
  current,
  max,
  warning,
}: {
  current: number;
  max: number;
  warning?: number;
}) {
  const isOver = current > max;
  const isWarning = warning && current > warning;

  return (
    <span
      className="text-xs"
      style={{ color: isOver ? "var(--n-accent)" : isWarning ? "var(--n-warning)" : "var(--n-text-disabled)" }}
    >
      {current}/{max}
    </span>
  );
}

/**
 * SEO Config Component - Story 12.20
 * Dashboard for configuring portal SEO settings
 */
export function SeoConfig() {
  const utils = api.useUtils();
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Fetch current theme config
  const { data: themeConfig, isLoading } = api.portal.getThemeConfig.useQuery();
  const { data: org } = api.portal.getOrganizationInfo.useQuery();

  // Form setup
  const form = useForm<SeoConfigFormValues>({
    resolver: zodResolver(seoConfigSchema),
    defaultValues: {
      seoTitle: null,
      seoDescription: null,
      seoKeywords: null,
      ogImage: null,
      twitterHandle: null,
      googleAnalyticsId: null,
      googleSearchConsoleId: null,
    },
  });

  // Update form when config loads
  useEffect(() => {
    if (themeConfig) {
      form.reset({
        seoTitle: themeConfig.seoTitle ?? null,
        seoDescription: themeConfig.seoDescription ?? null,
        seoKeywords: themeConfig.seoKeywords ?? null,
        ogImage: themeConfig.ogImage ?? null,
        twitterHandle: themeConfig.twitterHandle ?? null,
        googleAnalyticsId: themeConfig.googleAnalyticsId ?? null,
        googleSearchConsoleId: themeConfig.googleSearchConsoleId ?? null,
      });
    }
  }, [themeConfig, form]);

  // Update mutation
  const updateMutation = api.portal.updateSeoConfig.useMutation({
    onSuccess: () => {
      setSaveMessage({ type: "success", text: "Configuration SEO sauvegardée avec succès" });
      utils.portal.getThemeConfig.invalidate();
      setTimeout(() => setSaveMessage(null), 3000);
    },
    onError: (error) => {
      setSaveMessage({ type: "error", text: error.message });
      setTimeout(() => setSaveMessage(null), 5000);
    },
  });

  const onSubmit = (values: SeoConfigFormValues) => {
    updateMutation.mutate({
      seoTitle: values.seoTitle || null,
      seoDescription: values.seoDescription || null,
      seoKeywords: values.seoKeywords || null,
      ogImage: values.ogImage || null,
      twitterHandle: values.twitterHandle || null,
      googleAnalyticsId: values.googleAnalyticsId || null,
      googleSearchConsoleId: values.googleSearchConsoleId || null,
    });
  };

  // Watch form values for preview
  const watchedValues = form.watch();
  const portalUrl = org?.portalDomain
    ? `https://${org.portalDomain}`
    : `https://${org?.slug}.cupmetrics.com`;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <p className="text-sm" style={{ color: "var(--n-text-disabled)" }}>[LOADING...]</p>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Tabs defaultValue="meta" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="meta" className="gap-2">
              <Search className="h-4 w-4" />
              Meta Tags
            </TabsTrigger>
            <TabsTrigger value="social" className="gap-2">
              <Globe className="h-4 w-4" />
              Réseaux Sociaux
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Analytics
            </TabsTrigger>
          </TabsList>

          {/* Meta Tags Tab */}
          <TabsContent value="meta" className="space-y-6">
            <div style={{ background: "var(--n-surface)", border: "1px solid var(--n-border)", borderRadius: "12px", padding: "20px" }}>
              <div className="flex items-center gap-3 mb-6">
                <Search className="h-5 w-5" style={{ color: "var(--n-text-secondary)" }} />
                <div>
                  <h3 className="font-semibold">Balises Meta SEO</h3>
                  <p className="text-sm" style={{ color: "var(--n-text-secondary)" }}>
                    Ces informations apparaissent dans les résultats de recherche Google
                  </p>
                </div>
              </div>
              <div className="space-y-6">
                {/* Title */}
                <FormField
                  control={form.control}
                  name="seoTitle"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel>Titre SEO</FormLabel>
                        <CharacterCounter
                          current={field.value?.length ?? 0}
                          max={60}
                          warning={50}
                        />
                      </div>
                      <FormControl>
                        <Input
                          placeholder="Titre de votre organisation | Concours"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormDescription>
                        Titre affiché dans les résultats Google. Optimal: 50-60 caractères.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Description */}
                <FormField
                  control={form.control}
                  name="seoDescription"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel>Meta Description</FormLabel>
                        <CharacterCounter
                          current={field.value?.length ?? 0}
                          max={160}
                          warning={150}
                        />
                      </div>
                      <FormControl>
                        <Textarea
                          placeholder="Description de votre organisation et de vos concours..."
                          className="resize-none"
                          rows={3}
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormDescription>
                        Description affichée sous le titre dans Google. Optimal: 150-160 caractères.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Keywords */}
                <FormField
                  control={form.control}
                  name="seoKeywords"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mots-clés</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="concours, vin, gastronomie, dégustation"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormDescription>
                        Mots-clés séparés par des virgules (moins important pour le SEO moderne)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Separator />

                {/* Google Preview */}
                <GoogleSearchPreview
                  title={watchedValues.seoTitle ?? org?.name ?? ""}
                  description={watchedValues.seoDescription ?? ""}
                  url={portalUrl}
                />
              </div>
            </div>
          </TabsContent>

          {/* Social Tab */}
          <TabsContent value="social" className="space-y-6">
            <div style={{ background: "var(--n-surface)", border: "1px solid var(--n-border)", borderRadius: "12px", padding: "20px" }}>
              <div className="flex items-center gap-3 mb-6">
                <Globe className="h-5 w-5" style={{ color: "var(--n-text-secondary)" }} />
                <div>
                  <h3 className="font-semibold">Open Graph & Twitter</h3>
                  <p className="text-sm" style={{ color: "var(--n-text-secondary)" }}>
                    Contrôlez l&apos;apparence lors du partage sur les réseaux sociaux
                  </p>
                </div>
              </div>
              <div className="space-y-6">
                {/* OG Image */}
                <FormField
                  control={form.control}
                  name="ogImage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Image Open Graph</FormLabel>
                      <FormControl>
                        <div className="flex gap-2">
                          <Input
                            placeholder="https://example.com/image.jpg"
                            {...field}
                            value={field.value ?? ""}
                          />
                        </div>
                      </FormControl>
                      <FormDescription>
                        Image affichée lors du partage (ratio recommandé: 1200x630px)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Twitter Handle */}
                <FormField
                  control={form.control}
                  name="twitterHandle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Twitter className="h-4 w-4" />
                        Compte Twitter
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--n-text-disabled)" }}>
                            @
                          </span>
                          <Input
                            className="pl-7"
                            placeholder="votre_compte"
                            {...field}
                            value={field.value ?? ""}
                          />
                        </div>
                      </FormControl>
                      <FormDescription>
                        Compte Twitter associé pour les Twitter Cards
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Separator />

                {/* Social Preview */}
                <SocialCardPreview
                  title={watchedValues.seoTitle ?? org?.name ?? ""}
                  description={watchedValues.seoDescription ?? ""}
                  imageUrl={watchedValues.ogImage}
                  siteName={org?.name ?? "Organisation"}
                />
              </div>
            </div>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <div style={{ background: "var(--n-surface)", border: "1px solid var(--n-border)", borderRadius: "12px", padding: "20px" }}>
              <div className="flex items-center gap-3 mb-6">
                <BarChart3 className="h-5 w-5" style={{ color: "var(--n-text-secondary)" }} />
                <div>
                  <h3 className="font-semibold">Analytics & Vérification</h3>
                  <p className="text-sm" style={{ color: "var(--n-text-secondary)" }}>
                    Intégrez vos outils de suivi et vérifiez votre propriété
                  </p>
                </div>
              </div>
              <div className="space-y-6">
                {/* Google Analytics */}
                <FormField
                  control={form.control}
                  name="googleAnalyticsId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Google Analytics 4</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="G-XXXXXXXXXX"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormDescription>
                        ID de mesure Google Analytics 4 (commence par G-)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Google Search Console */}
                <FormField
                  control={form.control}
                  name="googleSearchConsoleId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Google Search Console</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Balise meta de vérification"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormDescription>
                        Contenu de la balise meta &quot;google-site-verification&quot;
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex items-start gap-3 p-4 rounded-xl" style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.3)" }}>
                  <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" style={{ color: "var(--n-interactive)" }} />
                  <div className="text-sm" style={{ color: "var(--n-interactive)" }}>
                    <p className="font-medium">Conseil</p>
                    <p className="mt-1">
                      Après avoir configuré Google Search Console, soumettez votre sitemap :
                      <code className="mx-1 px-1.5 py-0.5 rounded" style={{ background: "rgba(59,130,246,0.2)", fontFamily: "'Space Mono', monospace" }}>
                        {portalUrl}/sitemap.xml
                      </code>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Save Button */}
        <div className="flex items-center justify-between">
          <div>
            {saveMessage && (
              <div
                className="text-sm px-4 py-2 rounded-xl"
                style={saveMessage.type === "success"
                  ? { background: "rgba(56,161,105,0.1)", color: "var(--n-success)" }
                  : { background: "rgba(229,62,62,0.1)", color: "var(--n-accent)" }}
              >
                {saveMessage.text}
              </div>
            )}
          </div>
          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? (
              "[LOADING...]"
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Sauvegarder la configuration SEO
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
