import { getThemePreset, type ThemePresetConfig } from "./theme-presets";

/**
 * Theme configuration for CSS variable generation
 */
export interface ThemeConfig {
  themePreset: string;
  colorMode?: "light" | "dark";
  primaryColor?: string | null;
  secondaryColor?: string | null;
  customCss?: string | null;
  // Typography - Google Fonts
  headingFont?: string | null;
  bodyFont?: string | null;
}

/**
 * Validate hex color format
 */
export function isValidHexColor(color: string): boolean {
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
}

/**
 * Convert hex to HSL values for CSS
 */
function hexToHSL(hex: string): { h: number; s: number; l: number } {
  // Remove # if present
  const cleanHex = hex.replace("#", "");

  // Parse RGB values
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/**
 * Light mode color palette
 */
const lightModeColors = {
  backgroundColor: "#ffffff",      // White
  foregroundColor: "#0a0a0f",      // Near black
  mutedBg: "#f4f4f5",              // Zinc 100 - muted background
  mutedForeground: "#71717a",      // Zinc 500 - muted text
  cardColor: "#ffffff",            // White
  borderColor: "#e4e4e7",          // Zinc 200
};

/**
 * Dark mode color palette
 */
const darkModeColors = {
  backgroundColor: "#0f172a",      // Slate 900
  foregroundColor: "#f8fafc",      // Slate 50
  mutedBg: "#27272a",              // Zinc 800 - muted background
  mutedForeground: "#a1a1aa",      // Zinc 400 - muted text
  cardColor: "#18181b",            // Zinc 900
  borderColor: "#3f3f46",          // Zinc 700
};

/**
 * Generate CSS variables from theme configuration
 */
export function generateCssVariables(config: ThemeConfig): Record<string, string> {
  const preset = getThemePreset(config.themePreset);
  const isDarkMode = config.colorMode === "dark";
  const palette = isDarkMode ? darkModeColors : lightModeColors;

  // Use custom colors if provided, otherwise use preset
  const primaryColor = (config.primaryColor && isValidHexColor(config.primaryColor))
    ? config.primaryColor
    : preset.primaryColor;
  const secondaryColor = (config.secondaryColor && isValidHexColor(config.secondaryColor))
    ? config.secondaryColor
    : preset.secondaryColor;

  // Use palette colors for consistent light/dark theming
  const backgroundColor = palette.backgroundColor;
  const foregroundColor = palette.foregroundColor;
  const mutedBg = palette.mutedBg;
  const mutedFg = palette.mutedForeground;
  const cardColor = palette.cardColor;
  const borderColor = palette.borderColor;

  const primaryHSL = hexToHSL(primaryColor);
  const secondaryHSL = hexToHSL(secondaryColor);
  const bgHSL = hexToHSL(backgroundColor);
  const fgHSL = hexToHSL(foregroundColor);
  const mutedBgHSL = hexToHSL(mutedBg);
  const mutedFgHSL = hexToHSL(mutedFg);
  const accentHSL = hexToHSL(preset.accentColor);
  const cardHSL = hexToHSL(cardColor);
  const borderHSL = hexToHSL(borderColor);

  return {
    "--portal-primary": `${primaryHSL.h} ${primaryHSL.s}% ${primaryHSL.l}%`,
    "--portal-primary-hex": primaryColor,
    "--portal-secondary": `${secondaryHSL.h} ${secondaryHSL.s}% ${secondaryHSL.l}%`,
    "--portal-secondary-hex": secondaryColor,
    "--portal-background": `${bgHSL.h} ${bgHSL.s}% ${bgHSL.l}%`,
    "--portal-background-hex": backgroundColor,
    "--portal-foreground": `${fgHSL.h} ${fgHSL.s}% ${fgHSL.l}%`,
    "--portal-foreground-hex": foregroundColor,
    "--portal-muted": `${mutedBgHSL.h} ${mutedBgHSL.s}% ${mutedBgHSL.l}%`,
    "--portal-muted-hex": mutedBg,
    "--portal-accent": `${accentHSL.h} ${accentHSL.s}% ${accentHSL.l}%`,
    "--portal-card": `${cardHSL.h} ${cardHSL.s}% ${cardHSL.l}%`,
    "--portal-card-hex": cardColor,
    "--portal-border": `${borderHSL.h} ${borderHSL.s}% ${borderHSL.l}%`,
    "--portal-border-hex": borderColor,
    "--portal-radius": preset.borderRadius,
    "--portal-font-family": preset.fontFamily,
    // Custom typography - Google Fonts
    "--portal-heading-font": config.headingFont ? `"${config.headingFont}", ${preset.fontFamily}` : preset.fontFamily,
    "--portal-body-font": config.bodyFont ? `"${config.bodyFont}", ${preset.fontFamily}` : preset.fontFamily,
    // Portal-scoped muted foreground for text
    "--portal-muted-foreground": `${mutedFgHSL.h} ${mutedFgHSL.s}% ${mutedFgHSL.l}%`,
  };
}

/**
 * Generate inline style object from CSS variables
 */
export function generateStyleObject(config: ThemeConfig): React.CSSProperties {
  const variables = generateCssVariables(config);
  return variables as unknown as React.CSSProperties;
}

/**
 * Generate CSS string from theme configuration
 */
export function generateCssString(config: ThemeConfig): string {
  const variables = generateCssVariables(config);

  const cssVars = Object.entries(variables)
    .map(([key, value]) => `  ${key}: ${value};`)
    .join("\n");

  return `:root {\n${cssVars}\n}`;
}

/**
 * Sanitize custom CSS to prevent XSS attacks
 * Removes potentially dangerous patterns
 */
export function sanitizeCustomCss(css: string): string {
  if (!css) return "";

  // Remove JavaScript-related patterns
  let sanitized = css
    // Remove javascript: URLs
    .replace(/javascript\s*:/gi, "")
    // Remove expression() (IE)
    .replace(/expression\s*\(/gi, "")
    // Remove behavior: (IE)
    .replace(/behavior\s*:/gi, "")
    // Remove -moz-binding (Firefox)
    .replace(/-moz-binding\s*:/gi, "")
    // Remove @import (prevent external resource loading)
    .replace(/@import\s+/gi, "")
    // Remove url() with data: or javascript:
    .replace(/url\s*\(\s*['"]?\s*(data|javascript)\s*:/gi, "url(blocked:")
    // Remove HTML comments that could contain script
    .replace(/<!--[\s\S]*?-->/g, "");

  // Limit length to prevent abuse
  const maxLength = 50000;
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized.trim();
}

/**
 * Combine preset CSS with custom CSS
 */
export function getCombinedCss(config: ThemeConfig): string {
  const presetCss = generateCssString(config);

  if (config.customCss) {
    const sanitizedCustom = sanitizeCustomCss(config.customCss);
    return `${presetCss}\n\n/* Custom CSS */\n${sanitizedCustom}`;
  }

  return presetCss;
}
