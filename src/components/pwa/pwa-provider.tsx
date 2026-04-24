"use client";

import { useEffect } from "react";

type PortalType = "producer" | "jury" | "organizer" | "admin";

interface PWAProviderProps {
  portal: PortalType;
  themeColor?: string;
  logoUrl?: string | null;
  children: React.ReactNode;
}

// Default theme colors per portal (fallback when the caller doesn't pass one)
const defaultThemeColors: Record<PortalType, string> = {
  producer: "#d4af37",
  jury: "#d4af37",
  organizer: "#d4af37",
  admin: "#d4af37",
};

/**
 * PWA Provider Component (single-tenant).
 *
 * Registers the service worker and wires up the static `/manifest.json`
 * shipped under `public/`. The dynamic `/api/pwa/manifest/[portal]` route
 * that this component used to hit no longer exists.
 */
export function PWAProvider({
  portal,
  themeColor,
  logoUrl,
  children,
}: PWAProviderProps) {
  const finalThemeColor = themeColor || defaultThemeColors[portal];

  useEffect(() => {
    // Register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Service worker registration failed silently
      });
    }

    // Update theme-color meta tag dynamically
    let metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (!metaThemeColor) {
      metaThemeColor = document.createElement("meta");
      metaThemeColor.setAttribute("name", "theme-color");
      document.head.appendChild(metaThemeColor);
    }
    metaThemeColor.setAttribute("content", finalThemeColor);

    // Ensure the manifest link points at our static single-tenant manifest
    let manifestLink = document.querySelector('link[rel="manifest"]');
    if (!manifestLink) {
      manifestLink = document.createElement("link");
      manifestLink.setAttribute("rel", "manifest");
      document.head.appendChild(manifestLink);
    }
    manifestLink.setAttribute("href", "/manifest.json");

    // Add apple-touch-icon if logo URL is available
    if (logoUrl) {
      let appleTouchIcon = document.querySelector('link[rel="apple-touch-icon"]');
      if (!appleTouchIcon) {
        appleTouchIcon = document.createElement("link");
        appleTouchIcon.setAttribute("rel", "apple-touch-icon");
        document.head.appendChild(appleTouchIcon);
      }
      appleTouchIcon.setAttribute("href", logoUrl);
    }

    // Add mobile-web-app-capable meta
    let mobileWebApp = document.querySelector('meta[name="mobile-web-app-capable"]');
    if (!mobileWebApp) {
      mobileWebApp = document.createElement("meta");
      mobileWebApp.setAttribute("name", "mobile-web-app-capable");
      mobileWebApp.setAttribute("content", "yes");
      document.head.appendChild(mobileWebApp);
    }

    // Add apple-mobile-web-app-capable meta
    let appleMobileWebApp = document.querySelector('meta[name="apple-mobile-web-app-capable"]');
    if (!appleMobileWebApp) {
      appleMobileWebApp = document.createElement("meta");
      appleMobileWebApp.setAttribute("name", "apple-mobile-web-app-capable");
      appleMobileWebApp.setAttribute("content", "yes");
      document.head.appendChild(appleMobileWebApp);
    }

    // Add apple-mobile-web-app-status-bar-style
    let appleStatusBar = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (!appleStatusBar) {
      appleStatusBar = document.createElement("meta");
      appleStatusBar.setAttribute("name", "apple-mobile-web-app-status-bar-style");
      appleStatusBar.setAttribute("content", "black-translucent");
      document.head.appendChild(appleStatusBar);
    }
  }, [finalThemeColor, logoUrl]);

  return <>{children}</>;
}
