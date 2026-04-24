"use client";

import { useEffect } from "react";

interface FontLoaderProps {
  fonts: string[];
}

/**
 * Client component to dynamically load Google Fonts
 * This ensures fonts are loaded correctly in the browser
 */
export function FontLoader({ fonts }: FontLoaderProps) {
  useEffect(() => {
    // Filter out generic fonts
    const genericFonts = ["system-ui", "sans-serif", "serif", "monospace", "cursive", "fantasy"];
    const fontsToLoad = fonts.filter(f => f && !genericFonts.includes(f));

    if (fontsToLoad.length === 0) return;

    // Check if fonts are already loaded
    const existingLinks = document.querySelectorAll('link[data-font-loader]');
    const loadedFonts = new Set(
      Array.from(existingLinks).map(link => link.getAttribute('data-font'))
    );

    fontsToLoad.forEach(fontName => {
      if (loadedFonts.has(fontName)) return;

      // Add preconnect links if not already present
      if (!document.querySelector('link[href="https://fonts.googleapis.com"]')) {
        const preconnect1 = document.createElement("link");
        preconnect1.rel = "preconnect";
        preconnect1.href = "https://fonts.googleapis.com";
        document.head.appendChild(preconnect1);

        const preconnect2 = document.createElement("link");
        preconnect2.rel = "preconnect";
        preconnect2.href = "https://fonts.gstatic.com";
        preconnect2.crossOrigin = "anonymous";
        document.head.appendChild(preconnect2);
      }

      // Create link element for the font
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName).replace(/%20/g, '+')}:wght@400;500;600;700&display=swap`;
      link.setAttribute("data-font-loader", "true");
      link.setAttribute("data-font", fontName);
      document.head.appendChild(link);
    });
  }, [fonts]);

  return null;
}
