import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Build a portal URL from an organization slug
 * Handles both development (localhost) and production environments
 */
export function buildPortalUrl(slug: string, path: string = "/dashboard"): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  try {
    const url = new URL(baseUrl);
    if (url.hostname === "localhost" || url.hostname.endsWith("localhost")) {
      url.hostname = `${slug}.localhost`;
    } else {
      const baseDomain = url.hostname.replace(/^www\./, "");
      url.hostname = `${slug}.${baseDomain}`;
    }
    url.pathname = path;
    return url.toString();
  } catch {
    return `https://${slug}.cupmetrics.com${path}`;
  }
}
