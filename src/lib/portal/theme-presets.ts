/**
 * Theme preset definitions for organization portals
 * Each preset defines a cohesive color scheme and style
 */

export interface ThemePresetConfig {
  id: string;
  name: string;
  description: string;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  foregroundColor: string;
  mutedColor: string;
  accentColor: string;
  borderRadius: string;
  fontFamily: string;
}

/**
 * Available theme presets
 */
export const themePresets: Record<string, ThemePresetConfig> = {
  default: {
    id: "default",
    name: "CupMetrics",
    description: "Le thème signature CupMetrics avec des tons ambrés chaleureux",
    primaryColor: "#f59e0b",
    secondaryColor: "#3b82f6",
    backgroundColor: "#ffffff",
    foregroundColor: "#0f172a",
    mutedColor: "#64748b",
    accentColor: "#fbbf24",
    borderRadius: "0.5rem",
    fontFamily: "Inter, system-ui, sans-serif",
  },
  ocean: {
    id: "ocean",
    name: "Océan",
    description: "Tons bleus apaisants inspirés de la mer",
    primaryColor: "#0ea5e9",
    secondaryColor: "#06b6d4",
    backgroundColor: "#f0f9ff",
    foregroundColor: "#0c4a6e",
    mutedColor: "#64748b",
    accentColor: "#38bdf8",
    borderRadius: "0.75rem",
    fontFamily: "Inter, system-ui, sans-serif",
  },
  forest: {
    id: "forest",
    name: "Forêt",
    description: "Verts naturels pour une ambiance organique",
    primaryColor: "#22c55e",
    secondaryColor: "#10b981",
    backgroundColor: "#f0fdf4",
    foregroundColor: "#14532d",
    mutedColor: "#6b7280",
    accentColor: "#4ade80",
    borderRadius: "0.5rem",
    fontFamily: "Inter, system-ui, sans-serif",
  },
  sunset: {
    id: "sunset",
    name: "Coucher de soleil",
    description: "Oranges et rouges chaleureux",
    primaryColor: "#f97316",
    secondaryColor: "#ef4444",
    backgroundColor: "#fffbeb",
    foregroundColor: "#7c2d12",
    mutedColor: "#78716c",
    accentColor: "#fb923c",
    borderRadius: "0.5rem",
    fontFamily: "Inter, system-ui, sans-serif",
  },
  royal: {
    id: "royal",
    name: "Royal",
    description: "Violets élégants pour un look premium",
    primaryColor: "#8b5cf6",
    secondaryColor: "#a855f7",
    backgroundColor: "#faf5ff",
    foregroundColor: "#3b0764",
    mutedColor: "#6b7280",
    accentColor: "#c084fc",
    borderRadius: "0.75rem",
    fontFamily: "Inter, system-ui, sans-serif",
  },
  midnight: {
    id: "midnight",
    name: "Minuit",
    description: "Mode sombre élégant avec accents bleus",
    primaryColor: "#60a5fa",
    secondaryColor: "#818cf8",
    backgroundColor: "#0f172a",
    foregroundColor: "#f8fafc",
    mutedColor: "#94a3b8",
    accentColor: "#38bdf8",
    borderRadius: "0.5rem",
    fontFamily: "Inter, system-ui, sans-serif",
  },
  classic: {
    id: "classic",
    name: "Classique",
    description: "Tons neutres intemporels",
    primaryColor: "#6b7280",
    secondaryColor: "#4b5563",
    backgroundColor: "#fafafa",
    foregroundColor: "#171717",
    mutedColor: "#737373",
    accentColor: "#a3a3a3",
    borderRadius: "0.25rem",
    fontFamily: "Georgia, Times New Roman, serif",
  },
  modern: {
    id: "modern",
    name: "Moderne",
    description: "Design épuré avec dégradés subtils",
    primaryColor: "#ec4899",
    secondaryColor: "#8b5cf6",
    backgroundColor: "#ffffff",
    foregroundColor: "#18181b",
    mutedColor: "#71717a",
    accentColor: "#f472b6",
    borderRadius: "1rem",
    fontFamily: "Inter, system-ui, sans-serif",
  },
};

// Default theme configuration (used as fallback)
const defaultTheme: ThemePresetConfig = {
  id: "default",
  name: "CupMetrics",
  description: "Le thème signature CupMetrics avec des tons ambrés chaleureux",
  primaryColor: "#f59e0b",
  secondaryColor: "#3b82f6",
  backgroundColor: "#ffffff",
  foregroundColor: "#0f172a",
  mutedColor: "#64748b",
  accentColor: "#fbbf24",
  borderRadius: "0.5rem",
  fontFamily: "Inter, system-ui, sans-serif",
};

/**
 * Get a theme preset by ID
 */
export function getThemePreset(presetId: string): ThemePresetConfig {
  return themePresets[presetId] ?? defaultTheme;
}

/**
 * Get all available theme presets as an array
 */
export function getAllThemePresets(): ThemePresetConfig[] {
  return Object.values(themePresets);
}

/**
 * Validate if a preset ID is valid
 */
export function isValidPresetId(presetId: string): boolean {
  return presetId in themePresets;
}
