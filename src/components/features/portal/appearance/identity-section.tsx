"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Loader2,
  Sun,
  Moon,
  Layout,
  Palette,
  Image as ImageIcon,
  Type,
  Check,
  Settings2,
  Globe,
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
import { Switch } from "~/components/ui/switch";
import { Separator } from "~/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { ImageUpload } from "~/components/ui/image-upload";

// ═══════════════════════════════════════════════════════════════
// GOOGLE FONTS LIST
// ═══════════════════════════════════════════════════════════════
const googleFonts = [
  // Sans-serif modernes
  { name: "Inter", value: "Inter", category: "Sans-serif" },
  { name: "Poppins", value: "Poppins", category: "Sans-serif" },
  { name: "Montserrat", value: "Montserrat", category: "Sans-serif" },
  { name: "Open Sans", value: "Open Sans", category: "Sans-serif" },
  { name: "Roboto", value: "Roboto", category: "Sans-serif" },
  { name: "Lato", value: "Lato", category: "Sans-serif" },
  { name: "Nunito", value: "Nunito", category: "Sans-serif" },
  { name: "Source Sans 3", value: "Source Sans 3", category: "Sans-serif" },
  { name: "Outfit", value: "Outfit", category: "Sans-serif" },
  { name: "DM Sans", value: "DM Sans", category: "Sans-serif" },
  // Serif elegantes
  { name: "Playfair Display", value: "Playfair Display", category: "Serif" },
  { name: "Merriweather", value: "Merriweather", category: "Serif" },
  { name: "Lora", value: "Lora", category: "Serif" },
  { name: "Source Serif 4", value: "Source Serif 4", category: "Serif" },
  { name: "Crimson Text", value: "Crimson Text", category: "Serif" },
  // Display / Titres
  { name: "Bebas Neue", value: "Bebas Neue", category: "Display" },
  { name: "Oswald", value: "Oswald", category: "Display" },
  { name: "Raleway", value: "Raleway", category: "Display" },
  { name: "Archivo Black", value: "Archivo Black", category: "Display" },
  { name: "Anton", value: "Anton", category: "Display" },
] as const;

// ═══════════════════════════════════════════════════════════════
// FONT PAIRINGS - Combinaisons recommandees
// ═══════════════════════════════════════════════════════════════
const fontPairings = [
  {
    id: "apple-premium",
    name: "Premium Minimal",
    description: "Style Apple, epure et elegant",
    headingFont: "Inter",
    bodyFont: "Inter",
    style: "premium",
    preview: {
      heading: "Aa",
      body: "Design minimaliste et moderne",
    },
  },
  {
    id: "modern-geometric",
    name: "Moderne Geometrique",
    description: "Poppins + Inter - Clean et contemporain",
    headingFont: "Poppins",
    bodyFont: "Inter",
    style: "modern",
    preview: {
      heading: "Aa",
      body: "Lignes nettes et equilibrees",
    },
  },
  {
    id: "tech-bold",
    name: "Tech & Bold",
    description: "Montserrat + DM Sans - High-tech et percutant",
    headingFont: "Montserrat",
    bodyFont: "DM Sans",
    style: "tech",
    preview: {
      heading: "Aa",
      body: "Impact visuel garanti",
    },
  },
  {
    id: "editorial-elegant",
    name: "Editorial Elegant",
    description: "Playfair + Lora - Style magazine luxe",
    headingFont: "Playfair Display",
    bodyFont: "Lora",
    style: "editorial",
    preview: {
      heading: "Aa",
      body: "Raffinement et sophistication",
    },
  },
  {
    id: "luxury-contrast",
    name: "Luxe & Contraste",
    description: "Playfair + Montserrat - Prestige moderne",
    headingFont: "Playfair Display",
    bodyFont: "Montserrat",
    style: "luxury",
    preview: {
      heading: "Aa",
      body: "Contraste serif / sans-serif",
    },
  },
  {
    id: "sporty-dynamic",
    name: "Sportif & Dynamique",
    description: "Oswald + Roboto - Energie et mouvement",
    headingFont: "Oswald",
    bodyFont: "Roboto",
    style: "sporty",
    preview: {
      heading: "Aa",
      body: "Pour les competitions actives",
    },
  },
  {
    id: "classic-business",
    name: "Classique Pro",
    description: "Merriweather + Source Sans - Serieux et fiable",
    headingFont: "Merriweather",
    bodyFont: "Source Sans 3",
    style: "classic",
    preview: {
      heading: "Aa",
      body: "Credibilite et tradition",
    },
  },
  {
    id: "friendly-warm",
    name: "Chaleureux & Accessible",
    description: "Nunito + Open Sans - Convivial et lisible",
    headingFont: "Nunito",
    bodyFont: "Open Sans",
    style: "friendly",
    preview: {
      heading: "Aa",
      body: "Approchable et sympathique",
    },
  },
  {
    id: "custom",
    name: "Personnalise",
    description: "Choisissez vos propres polices",
    headingFont: null,
    bodyFont: null,
    style: "custom",
    preview: {
      heading: "Aa",
      body: "Votre propre combinaison",
    },
  },
] as const;

// ═══════════════════════════════════════════════════════════════
// GOOGLE FONTS LOADER - For preview in dashboard
// ═══════════════════════════════════════════════════════════════

// Track which fonts have been loaded to avoid duplicate loads
const loadedFonts = new Set<string>();

/**
 * Dynamically load Google Fonts for preview
 */
function loadGoogleFont(fontName: string): void {
  if (!fontName || loadedFonts.has(fontName)) return;

  // Generic CSS fonts don't need loading
  const genericFonts = ["system-ui", "sans-serif", "serif", "monospace", "cursive", "fantasy"];
  if (genericFonts.includes(fontName)) return;

  loadedFonts.add(fontName);

  // Create link element for Google Fonts
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName)}:wght@400;500;600;700&display=swap`;
  document.head.appendChild(link);
}

/**
 * Preload all fonts used in font pairings
 */
function preloadAllPairingFonts(): void {
  const allFonts = new Set<string>();
  fontPairings.forEach(pairing => {
    if (pairing.headingFont) allFonts.add(pairing.headingFont);
    if (pairing.bodyFont) allFonts.add(pairing.bodyFont);
  });

  allFonts.forEach(font => loadGoogleFont(font));
}

// ═══════════════════════════════════════════════════════════════
// HEADER STYLES
// ═══════════════════════════════════════════════════════════════
const headerStyles = [
  {
    id: "classic",
    name: "Classique",
    description: "Logo a gauche, navigation a droite",
    preview: "left",
  },
  {
    id: "centered",
    name: "Centre",
    description: "Logo centre avec navigation de part et d'autre",
    preview: "center",
  },
  {
    id: "minimal",
    name: "Minimaliste",
    description: "Logo seul avec menu hamburger",
    preview: "minimal",
  },
  {
    id: "ultra-premium",
    name: "Ultra Premium",
    description: "Header transparent avec effet glassmorphism",
    preview: "premium",
  },
] as const;

// ═══════════════════════════════════════════════════════════════
// FORM SCHEMAS
// ═══════════════════════════════════════════════════════════════
const identityFormSchema = z.object({
  // Color mode
  colorMode: z.enum(["light", "dark"]),
  // Header
  headerStyle: z.enum(["classic", "centered", "minimal", "ultra-premium"]),
  headerTransparent: z.boolean(),
  showPersonasBar: z.boolean(),
  hidePersonasOnScroll: z.boolean(),
  // Theme & Colors
  themePreset: z.string(),
  primaryColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Format hexadecimal requis"),
  secondaryColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Format hexadecimal requis"),
  logoUrl: z.string().optional(),
  faviconUrl: z.string().optional(),
  // Typography
  headingFont: z.string(),
  bodyFont: z.string(),
});

type IdentityFormValues = z.infer<typeof identityFormSchema>;

// ═══════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════

/**
 * Color Mode Selector
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
    { value: "light", label: "Clair", icon: Sun, description: "Fond clair, texte sombre" },
    { value: "dark", label: "Sombre", icon: Moon, description: "Fond sombre, texte clair" },
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
 * Header Style Card
 */
function HeaderStyleCard({
  style,
  isSelected,
  onSelect,
  colorMode,
}: {
  style: (typeof headerStyles)[number];
  isSelected: boolean;
  onSelect: () => void;
  colorMode: "light" | "dark";
}) {
  const bgStyle = colorMode === "dark" ? { background: "#1e293b" } : { background: "#f1f5f9" };
  const elementStyle = colorMode === "dark" ? { background: "rgba(255,255,255,0.3)" } : { background: "#9ca3af" };

  return (
    <button
      type="button"
      onClick={onSelect}
      className="relative flex flex-col items-start gap-2 rounded-xl p-4 text-left transition-colors"
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

      {/* Preview adaptatif au mode clair/sombre */}
      <div className="w-full h-12 rounded-lg flex items-center px-3" style={{ ...bgStyle, border: "1px solid var(--n-border)" }}>
        {style.preview === "left" && (
          <>
            <div className="h-4 w-4 rounded" style={{ background: "var(--n-accent)" }} />
            <div className="ml-auto flex gap-2">
              <div className="h-2 w-8 rounded" style={elementStyle} />
              <div className="h-2 w-8 rounded" style={elementStyle} />
            </div>
          </>
        )}
        {style.preview === "center" && (
          <>
            <div className="h-2 w-8 rounded" style={elementStyle} />
            <div className="mx-auto h-4 w-4 rounded" style={{ background: "var(--n-accent)" }} />
            <div className="h-2 w-8 rounded" style={elementStyle} />
          </>
        )}
        {style.preview === "minimal" && (
          <>
            <div className="h-4 w-4 rounded" style={{ background: "var(--n-accent)" }} />
            <div className="ml-auto h-4 w-4 rounded" style={elementStyle} />
          </>
        )}
        {style.preview === "premium" && (
          <div className="w-full h-full rounded flex items-center justify-between px-2" style={{ background: "rgba(255,255,255,0.05)" }}>
            <div className="h-3 w-3 rounded" style={{ background: "rgba(255,255,255,0.8)" }} />
            <div className="flex gap-1">
              <div className="h-1.5 w-6 rounded" style={{ background: "rgba(255,255,255,0.6)" }} />
              <div className="h-1.5 w-6 rounded" style={{ background: "rgba(255,255,255,0.6)" }} />
            </div>
          </div>
        )}
      </div>

      <div>
        <p className="font-medium">{style.name}</p>
        <p className="text-xs" style={{ color: "var(--n-text-secondary)" }}>{style.description}</p>
      </div>
    </button>
  );
}

/**
 * Theme Preset Card with adaptive preview
 */
function ThemePresetCard({
  preset,
  isSelected,
  onSelect,
  isLoading,
  colorMode,
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
  colorMode: "light" | "dark";
}) {
  const previewBg = colorMode === "dark" ? "#0f172a" : "#ffffff";

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
      <div>
        <p className="font-medium">{preset.name}</p>
        <p className="text-xs" style={{ color: "var(--n-text-secondary)" }}>{preset.description}</p>
      </div>
      {/* Preview adaptatif */}
      <div
        className="mt-2 h-12 w-full rounded-lg"
        style={{ backgroundColor: previewBg, boxShadow: "0 0 0 1px var(--n-border)" }}
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
        className="h-10 w-10 cursor-pointer rounded border-0 p-0"
        aria-label={`Selecteur de couleur ${label}`}
      />
      <div className="flex-1">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
          className="font-mono"
          aria-label={`Code hexadecimal ${label}`}
        />
      </div>
    </div>
  );
}

/**
 * Font Pairing Card component with live preview
 */
function FontPairingCard({
  pairing,
  isSelected,
  onSelect,
  isLoading,
}: {
  pairing: typeof fontPairings[number];
  isSelected: boolean;
  onSelect: () => void;
  isLoading: boolean;
}) {
  const isCustom = pairing.style === "custom";

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={isLoading}
      className="relative flex flex-col items-start gap-3 rounded-xl p-4 text-left transition-colors w-full"
      style={{
        border: isSelected ? "1px solid var(--n-accent)" : "1px solid var(--n-border)",
        background: isSelected ? "var(--n-surface-raised)" : "transparent",
      }}
    >
      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute right-3 top-3">
          <div className="flex h-5 w-5 items-center justify-center rounded-full" style={{ background: "var(--n-accent)" }}>
            <Check className="h-3 w-3" style={{ color: "var(--n-black)" }} />
          </div>
        </div>
      )}

      {/* Font Preview */}
      <div className="w-full">
        <div
          className="text-3xl font-bold mb-1"
          style={{ fontFamily: `"${pairing.headingFont || "Inter"}", Inter, sans-serif` }}
        >
          {pairing.preview.heading}
        </div>
        <div
          className="text-sm"
          style={{ fontFamily: `"${pairing.bodyFont || "Inter"}", Inter, sans-serif`, color: "var(--n-text-secondary)" }}
        >
          {pairing.preview.body}
        </div>
      </div>

      {/* Info */}
      <div className="w-full">
        <div className="flex items-center gap-2">
          <p className="font-medium">{pairing.name}</p>
          {isCustom && (
            <Settings2 className="h-3.5 w-3.5" style={{ color: "var(--n-text-secondary)" }} />
          )}
        </div>
        <p className="text-xs mt-0.5" style={{ color: "var(--n-text-secondary)" }}>{pairing.description}</p>
      </div>

      {/* Font names */}
      {!isCustom && (
        <div className="flex gap-2 text-[10px]" style={{ color: "var(--n-text-disabled)" }}>
          <span>{pairing.headingFont}</span>
          <span>+</span>
          <span>{pairing.bodyFont}</span>
        </div>
      )}
    </button>
  );
}

/**
 * Font Selector dropdown
 */
function FontSelector({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  const groupedFonts = googleFonts.reduce((acc, font) => {
    const category = font.category;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category]!.push(font);
    return acc;
  }, {} as Record<string, typeof googleFonts[number][]>);

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="Choisir une police" />
      </SelectTrigger>
      <SelectContent className="max-h-[300px]">
        {Object.entries(groupedFonts).map(([category, fonts]) => (
          <div key={category}>
            <div className="px-2 py-1.5 text-xs font-semibold" style={{ color: "var(--n-text-secondary)" }}>
              {category}
            </div>
            {fonts.map((font) => (
              <SelectItem key={font.value} value={font.value}>
                <span style={{ fontFamily: font.value }}>{font.name}</span>
              </SelectItem>
            ))}
          </div>
        ))}
      </SelectContent>
    </Select>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export function IdentitySection() {
  const utils = api.useUtils();

  // Fetch data
  const { data: themeConfig, isLoading: isLoadingTheme } = api.portal.getThemeConfig.useQuery();
  const { data: presets } = api.portal.getThemePresets.useQuery();

  // Mutations
  const updateThemeMutation = api.portal.updateTheme.useMutation({
    onSuccess: () => {
      toast.success("Theme mis a jour");
      void utils.portal.getThemeConfig.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const updateHeaderMutation = api.portal.updateHeaderConfig.useMutation({
    onSuccess: () => {
      toast.success("Configuration header mise a jour");
      void utils.portal.getThemeConfig.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  // Form
  const form = useForm<IdentityFormValues>({
    resolver: zodResolver(identityFormSchema),
    values: {
      colorMode: (themeConfig?.colorMode as "light" | "dark") ?? "light",
      headerStyle: (themeConfig?.headerStyle as IdentityFormValues["headerStyle"]) ?? "classic",
      headerTransparent: themeConfig?.headerTransparent ?? false,
      showPersonasBar: themeConfig?.showPersonasBar ?? false,
      hidePersonasOnScroll: themeConfig?.hidePersonasOnScroll ?? true,
      themePreset: themeConfig?.themePreset ?? "default",
      primaryColor: themeConfig?.primaryColor ?? "#f59e0b",
      secondaryColor: themeConfig?.secondaryColor ?? "#3b82f6",
      logoUrl: themeConfig?.logoUrl ?? "",
      faviconUrl: (themeConfig as { faviconUrl?: string })?.faviconUrl ?? "",
      headingFont: (themeConfig as { headingFont?: string })?.headingFont ?? "Inter",
      bodyFont: (themeConfig as { bodyFont?: string })?.bodyFont ?? "Inter",
    },
  });

  const watchedColorMode = form.watch("colorMode");
  const watchedHeaderStyle = form.watch("headerStyle");
  const watchedShowPersonasBar = form.watch("showPersonasBar");
  const watchedHeadingFont = form.watch("headingFont");
  const watchedBodyFont = form.watch("bodyFont");

  // State for explicit custom font mode
  const [isCustomFontMode, setIsCustomFontMode] = useState(false);

  // Preload all Google Fonts for preview on mount
  useEffect(() => {
    preloadAllPairingFonts();
  }, []);

  // Load selected fonts when they change
  useEffect(() => {
    if (watchedHeadingFont) loadGoogleFont(watchedHeadingFont);
    if (watchedBodyFont) loadGoogleFont(watchedBodyFont);
  }, [watchedHeadingFont, watchedBodyFont]);

  // Handlers
  const handleColorModeChange = (value: "light" | "dark") => {
    form.setValue("colorMode", value);
    updateThemeMutation.mutate({ colorMode: value });
  };

  const handlePresetSelect = (presetId: string) => {
    const preset = presets?.find((p) => p.id === presetId);
    if (!preset) return;

    form.setValue("themePreset", presetId);
    form.setValue("primaryColor", preset.primaryColor);
    form.setValue("secondaryColor", preset.secondaryColor);

    updateThemeMutation.mutate({
      themePreset: presetId as "default" | "ocean" | "forest" | "sunset" | "royal" | "midnight" | "classic" | "modern",
      primaryColor: preset.primaryColor,
      secondaryColor: preset.secondaryColor,
    });
  };

  const handleSaveColors = () => {
    updateThemeMutation.mutate({
      primaryColor: form.getValues("primaryColor"),
      secondaryColor: form.getValues("secondaryColor"),
      logoUrl: form.getValues("logoUrl") || null,
      faviconUrl: form.getValues("faviconUrl") || null,
    });
  };

  // Generate favicon from logo
  const handleLogoChange = async (logoUrl: string) => {
    form.setValue("logoUrl", logoUrl);

    if (logoUrl && logoUrl.startsWith("/uploads/")) {
      try {
        const response = await fetch("/api/upload/favicon", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ logoUrl }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.faviconUrl) {
            form.setValue("faviconUrl", data.faviconUrl);
            toast.success("Favicon genere automatiquement");
          }
        }
      } catch {
        console.error("Favicon generation failed");
      }
    }
  };

  const handleSaveHeader = () => {
    updateHeaderMutation.mutate({
      headerStyle: form.getValues("headerStyle"),
      headerTransparent: watchedHeaderStyle === "ultra-premium" ? true : form.getValues("headerTransparent"),
      showPersonasBar: form.getValues("showPersonasBar"),
      hidePersonasOnScroll: form.getValues("hidePersonasOnScroll"),
    });
  };

  const handleSaveFonts = () => {
    updateThemeMutation.mutate({
      headingFont: form.getValues("headingFont"),
      bodyFont: form.getValues("bodyFont"),
    });
  };

  if (isLoadingTheme) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-sm" style={{ color: "var(--n-text-disabled)" }}>[LOADING...]</p>
      </div>
    );
  }

  return (
    <Form {...form}>
      <div className="space-y-6">
        {/* ═══ 1. MODE D'AFFICHAGE ═══ */}
        <div style={{ background: "var(--n-surface)", border: "1px solid var(--n-border)", borderRadius: "12px", padding: "20px" }}>
          <div className="flex items-center gap-2 mb-4">
            <Sun className="h-4 w-4" style={{ color: "var(--n-text-secondary)" }} />
            <div>
              <h3 className="font-semibold">Mode d'affichage</h3>
              <p className="text-sm" style={{ color: "var(--n-text-secondary)" }}>
                Choisissez le mode de couleur pour votre portail public
              </p>
            </div>
          </div>
          <ColorModeSelector
            value={watchedColorMode}
            onChange={handleColorModeChange}
            isLoading={updateThemeMutation.isPending}
          />
        </div>

        {/* ═══ 2. STYLE DU HEADER ═══ */}
        <div style={{ background: "var(--n-surface)", border: "1px solid var(--n-border)", borderRadius: "12px", padding: "20px" }}>
          <div className="flex items-center gap-2 mb-4">
            <Layout className="h-4 w-4" style={{ color: "var(--n-text-secondary)" }} />
            <div>
              <h3 className="font-semibold">Style du Header</h3>
              <p className="text-sm" style={{ color: "var(--n-text-secondary)" }}>
                Choisissez le style de navigation pour votre portail
              </p>
            </div>
          </div>

          <FormField
            control={form.control}
            name="headerStyle"
            render={({ field }) => (
              <FormItem>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {headerStyles.map((style) => (
                    <HeaderStyleCard
                      key={style.id}
                      style={style}
                      isSelected={field.value === style.id}
                      onSelect={() => field.onChange(style.id)}
                      colorMode={watchedColorMode}
                    />
                  ))}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Header Options */}
          <div className="mt-6 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Settings2 className="h-4 w-4" style={{ color: "var(--n-text-secondary)" }} />
              <span className="text-sm font-medium">Options</span>
            </div>

            {watchedHeaderStyle !== "ultra-premium" ? (
              <FormField
                control={form.control}
                name="headerTransparent"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-xl p-4" style={{ border: "1px solid var(--n-border)" }}>
                    <div className="space-y-0.5">
                      <FormLabel>Header transparent</FormLabel>
                      <FormDescription>
                        Le header sera transparent sur le hero
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            ) : (
              <div className="rounded-xl p-4" style={{ border: "1px solid var(--n-border)" }}>
                <p className="text-sm">Le header Ultra Premium est toujours transparent par design.</p>
              </div>
            )}

            <FormField
              control={form.control}
              name="showPersonasBar"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-xl p-4" style={{ border: "1px solid var(--n-border)" }}>
                  <div className="space-y-0.5">
                    <FormLabel>Barre Personas</FormLabel>
                    <FormDescription>
                      Afficher une barre avec les profils (Producteur, Magasin, Sponsor, Presse)
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            {watchedShowPersonasBar && watchedHeaderStyle !== "ultra-premium" && (
              <FormField
                control={form.control}
                name="hidePersonasOnScroll"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-xl p-4 ml-4" style={{ border: "1px solid var(--n-border)" }}>
                    <div className="space-y-0.5">
                      <FormLabel>Masquer au scroll</FormLabel>
                      <FormDescription>
                        La barre personas disparait lors du defilement
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            )}

            <div className="flex justify-end pt-2">
              <Button
                type="button"
                onClick={handleSaveHeader}
                disabled={updateHeaderMutation.isPending}
              >
                {updateHeaderMutation.isPending ? "[LOADING...]" : "Enregistrer le header"}
              </Button>
            </div>
          </div>
        </div>

        {/* ═══ 3. THEMES PREDEFINIS ═══ */}
        <div style={{ background: "var(--n-surface)", border: "1px solid var(--n-border)", borderRadius: "12px", padding: "20px" }}>
          <div className="flex items-center gap-2 mb-4">
            <Palette className="h-4 w-4" style={{ color: "var(--n-text-secondary)" }} />
            <div>
              <h3 className="font-semibold">Themes predefinis</h3>
              <p className="text-sm" style={{ color: "var(--n-text-secondary)" }}>
                Selectionnez un theme pour votre portail. Les apercu s'adaptent au mode choisi.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {presets?.map((preset) => (
              <ThemePresetCard
                key={preset.id}
                preset={preset}
                isSelected={form.watch("themePreset") === preset.id}
                onSelect={() => handlePresetSelect(preset.id)}
                isLoading={updateThemeMutation.isPending}
                colorMode={watchedColorMode}
              />
            ))}
          </div>
        </div>

        {/* ═══ 4. LOGO & COULEURS ═══ */}
        <div style={{ background: "var(--n-surface)", border: "1px solid var(--n-border)", borderRadius: "12px", padding: "20px" }}>
          <div className="flex items-center gap-2 mb-4">
            <ImageIcon className="h-4 w-4" style={{ color: "var(--n-text-secondary)" }} />
            <div>
              <h3 className="font-semibold">Logo & Couleurs</h3>
              <p className="text-sm" style={{ color: "var(--n-text-secondary)" }}>
                Personnalisez les couleurs de votre marque
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <FormField
              control={form.control}
              name="logoUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Logo de l'organisation</FormLabel>
                  <FormControl>
                    <ImageUpload
                      value={field.value}
                      onChange={handleLogoChange}
                      folder="logos"
                      placeholder="Glissez votre logo ou cliquez pour selectionner"
                      aspectRatio="square"
                      maxSize={2}
                    />
                  </FormControl>
                  <FormDescription>
                    Formats recommandes : PNG, SVG. Le favicon sera genere automatiquement.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Favicon Preview */}
            {form.watch("faviconUrl") && (
              <div className="flex items-center gap-3 p-3 rounded-lg" style={{ border: "1px solid var(--n-border)" }}>
                <div className="flex items-center justify-center w-8 h-8 rounded" style={{ border: "1px solid var(--n-border)" }}>
                  <img
                    src={form.watch("faviconUrl")}
                    alt="Favicon"
                    className="w-6 h-6 object-contain"
                  />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Globe className="h-4 w-4" style={{ color: "var(--n-text-secondary)" }} />
                    Favicon genere
                  </p>
                  <p className="text-xs" style={{ color: "var(--n-text-secondary)" }}>
                    Apparaitra dans l'onglet du navigateur
                  </p>
                </div>
              </div>
            )}

            <Separator />

            <div className="grid gap-6 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="primaryColor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Couleur primaire</FormLabel>
                    <FormControl>
                      <ColorPicker value={field.value} onChange={field.onChange} label="Primaire" />
                    </FormControl>
                    <FormDescription>Titres et boutons principaux</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="secondaryColor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Couleur secondaire</FormLabel>
                    <FormControl>
                      <ColorPicker value={field.value} onChange={field.onChange} label="Secondaire" />
                    </FormControl>
                    <FormDescription>Elements d'accent</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="button"
                onClick={handleSaveColors}
                disabled={updateThemeMutation.isPending}
              >
                {updateThemeMutation.isPending ? "[LOADING...]" : "Enregistrer les couleurs"}
              </Button>
            </div>
          </div>
        </div>

        {/* ═══ 5. TYPOGRAPHIE ═══ */}
        <div style={{ background: "var(--n-surface)", border: "1px solid var(--n-border)", borderRadius: "12px", padding: "20px" }}>
          <div className="flex items-center gap-2 mb-4">
            <Type className="h-4 w-4" style={{ color: "var(--n-text-secondary)" }} />
            <div>
              <h3 className="font-semibold">Typographie</h3>
              <p className="text-sm" style={{ color: "var(--n-text-secondary)" }}>
                Choisissez une combinaison de polices harmonieuse pour votre portail
              </p>
            </div>
          </div>

          {/* Font Pairings Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-6">
            {fontPairings.map((pairing) => {
              const matchesCurrentFonts = pairing.style !== "custom" &&
                pairing.headingFont === watchedHeadingFont &&
                pairing.bodyFont === watchedBodyFont;

              const fontsMatchSomePreset = fontPairings.some(
                (p) =>
                  p.style !== "custom" &&
                  p.headingFont === watchedHeadingFont &&
                  p.bodyFont === watchedBodyFont
              );

              const isSelected = pairing.style === "custom"
                ? isCustomFontMode || !fontsMatchSomePreset
                : !isCustomFontMode && matchesCurrentFonts;

              return (
                <FontPairingCard
                  key={pairing.id}
                  pairing={pairing}
                  isSelected={isSelected}
                  onSelect={() => {
                    if (pairing.style === "custom") {
                      setIsCustomFontMode(true);
                    } else if (pairing.headingFont && pairing.bodyFont) {
                      setIsCustomFontMode(false);
                      form.setValue("headingFont", pairing.headingFont);
                      form.setValue("bodyFont", pairing.bodyFont);
                    }
                  }}
                  isLoading={updateThemeMutation.isPending}
                />
              );
            })}
          </div>

          {/* Custom Font Selectors - Show when custom mode is active */}
          {(isCustomFontMode || !fontPairings.some(
            (p) =>
              p.style !== "custom" &&
              p.headingFont === watchedHeadingFont &&
              p.bodyFont === watchedBodyFont
          )) && (
            <div className="rounded-xl p-4 mb-4" style={{ border: "1px solid var(--n-border)" }}>
              <div className="flex items-center gap-2 mb-4">
                <Settings2 className="h-4 w-4" style={{ color: "var(--n-text-secondary)" }} />
                <span className="text-sm font-medium">Selection personnalisee</span>
              </div>
              <div className="grid gap-6 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="headingFont"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Police des titres</FormLabel>
                      <FormControl>
                        <FontSelector value={field.value} onChange={field.onChange} label="Titres" />
                      </FormControl>
                      <FormDescription>Pour les titres et headers</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="bodyFont"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Police du corps</FormLabel>
                      <FormControl>
                        <FontSelector value={field.value} onChange={field.onChange} label="Corps" />
                      </FormControl>
                      <FormDescription>Pour le texte courant</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          )}

          {/* Live Preview */}
          <div className="rounded-xl p-4 mb-4" style={{ border: "1px solid var(--n-border)" }}>
            <div className="text-xs mb-2" style={{ color: "var(--n-text-secondary)" }}>Apercu en direct</div>
            <div
              className="text-2xl font-bold mb-1"
              style={{ fontFamily: `"${watchedHeadingFont}", Inter, sans-serif` }}
            >
              Titre de votre portail
            </div>
            <div
              className="text-sm"
              style={{ fontFamily: `"${watchedBodyFont}", Inter, sans-serif`, color: "var(--n-text-secondary)" }}
            >
              Voici un exemple de texte courant qui apparaitra sur votre portail public.
              Les visiteurs verront ce style de police pour tous les paragraphes.
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="button"
              onClick={handleSaveFonts}
              disabled={updateThemeMutation.isPending}
            >
              {updateThemeMutation.isPending ? "[LOADING...]" : "Enregistrer les polices"}
            </Button>
          </div>
        </div>
      </div>
    </Form>
  );
}
