/**
 * Image generation utilities for RS (social media) posts
 * Provides template variable replacement and format specifications
 */

import type { RSTemplateColors, RSTemplateStyle } from "~/server/db/schema/rs-templates";

export interface SponsorPostData {
  sponsor: {
    name: string;
    logo: string | null;
    level: string;
  };
  cup: {
    name: string;
    logo?: string | null;
    hashtag: string;
  };
  organization: {
    name: string;
    logo: string | null;
  };
}

export interface RSPostFormat {
  name: string;
  width: number;
  height: number;
  aspectRatio: string;
  platform: string;
}

export const RS_POST_FORMATS: Record<"instagram" | "twitter", RSPostFormat> = {
  instagram: {
    name: "Instagram / Facebook",
    width: 1080,
    height: 1080,
    aspectRatio: "1:1",
    platform: "instagram",
  },
  twitter: {
    name: "Twitter / LinkedIn",
    width: 1200,
    height: 675,
    aspectRatio: "16:9",
    platform: "twitter",
  },
};

/**
 * Get label for sponsor tier level
 */
export function getTierLabel(tier: string): string {
  const labels: Record<string, string> = {
    platinum: "Platine",
    gold: "Or",
    silver: "Argent",
    bronze: "Bronze",
  };
  return labels[tier] ?? tier;
}

/**
 * Template variables that can be used in RS post templates
 */
export interface TemplateVariables {
  "{sponsor.name}": string;
  "{sponsor.level}": string;
  "{cup.name}": string;
  "{cup.hashtag}": string;
  "{org.name}": string;
}

/**
 * Build template variables from post data
 */
export function buildTemplateVariables(data: SponsorPostData): TemplateVariables {
  return {
    "{sponsor.name}": data.sponsor.name,
    "{sponsor.level}": data.sponsor.level,
    "{cup.name}": data.cup.name,
    "{cup.hashtag}": data.cup.hashtag,
    "{org.name}": data.organization.name,
  };
}

/**
 * Replace template variables in a text string
 */
export function replaceTemplateVariables(
  template: string,
  variables: TemplateVariables
): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replaceAll(key, value);
  }
  return result;
}

/**
 * Generate caption text from template
 */
export function generateCaption(
  captionTemplate: string,
  data: SponsorPostData
): string {
  const variables = buildTemplateVariables(data);
  return replaceTemplateVariables(captionTemplate, variables);
}

/**
 * Get style-specific design tokens
 */
export function getStyleDesignTokens(style: RSTemplateStyle) {
  const styles = {
    classic: {
      borderRadius: "0.5rem",
      fontWeight: "bold",
      textTransform: "none" as const,
      shadowStrength: "medium",
    },
    modern: {
      borderRadius: "1rem",
      fontWeight: "semibold",
      textTransform: "uppercase" as const,
      shadowStrength: "strong",
    },
    minimal: {
      borderRadius: "0",
      fontWeight: "normal",
      textTransform: "none" as const,
      shadowStrength: "none",
    },
    vibrant: {
      borderRadius: "1.5rem",
      fontWeight: "bold",
      textTransform: "uppercase" as const,
      shadowStrength: "strong",
    },
    elegant: {
      borderRadius: "0.25rem",
      fontWeight: "light",
      textTransform: "none" as const,
      shadowStrength: "soft",
    },
  };

  return styles[style] ?? styles.classic;
}

/**
 * Default colors for each template style
 */
export function getDefaultColorsForStyle(style: RSTemplateStyle): RSTemplateColors {
  const colorSchemes: Record<RSTemplateStyle, RSTemplateColors> = {
    classic: {
      background: "#1a1a2e",
      text: "#ffffff",
      accent: "#f59e0b",
    },
    modern: {
      background: "#0f172a",
      text: "#f8fafc",
      accent: "#3b82f6",
    },
    minimal: {
      background: "#ffffff",
      text: "#1f2937",
      accent: "#111827",
    },
    vibrant: {
      background: "#7c3aed",
      text: "#ffffff",
      accent: "#fbbf24",
    },
    elegant: {
      background: "#18181b",
      text: "#fafafa",
      accent: "#a78bfa",
    },
  };

  return colorSchemes[style];
}

/**
 * Generate default text template
 */
export function getDefaultTextTemplate(): string {
  return "Bienvenue \u00e0 {sponsor.name} comme sponsor {sponsor.level} de {cup.name} !";
}

/**
 * Generate default caption template
 */
export function getDefaultCaptionTemplate(): string {
  return `Nous sommes ravis d'accueillir {sponsor.name} comme partenaire {sponsor.level} de {cup.name} !

Merci pour votre soutien.

#sponsor #{cup.hashtag} #{org.name}`;
}

/**
 * Validate image URL (basic check)
 */
export function isValidImageUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}
