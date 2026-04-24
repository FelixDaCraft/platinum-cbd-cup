"use client";

import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { Wine, Store, Handshake, Newspaper } from "lucide-react";
import { usePortal } from "~/lib/portal/context";
import { cn } from "~/lib/utils";

// Persona labels by locale
const personaLabels = {
  fr: {
    prefix: "Vous \u00eates :",
    producer: "Producteur",
    store: "Magasin",
    sponsor: "Sponsor",
    press: "Presse",
  },
  en: {
    prefix: "You are:",
    producer: "Producer",
    store: "Retailer",
    sponsor: "Sponsor",
    press: "Press",
  },
} as const;

/**
 * Personas Bar Component - Story 12.3
 * Sticky bar below header with quick navigation by user type
 * Shows "Vous \u00eates: Producteur | Magasin | Sponsor | Presse"
 */
export function PersonasBar() {
  const { theme, locale } = usePortal();
  const [visible, setVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  const labels = personaLabels[locale] ?? personaLabels.fr;

  // Handle scroll to hide/show bar
  useEffect(() => {
    if (!theme.hidePersonasOnScroll) return;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // Hide when scrolling down, show when scrolling up
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setVisible(false);
      } else {
        setVisible(true);
      }

      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY, theme.hidePersonasOnScroll]);

  // Don't render if showPersonasBar is false
  // Also don't render if header style is ultra-premium (personas are inside the menu)
  if (!theme.showPersonasBar || theme.headerStyle === "ultra-premium") {
    return null;
  }

  const personas = [
    {
      icon: Wine,
      label: labels.producer,
      href: "/cups",
    },
    {
      icon: Store,
      label: labels.store,
      href: "/palmares",
    },
    {
      icon: Handshake,
      label: labels.sponsor,
      href: "/sponsors",
    },
    {
      icon: Newspaper,
      label: labels.press,
      href: "/press",
    },
  ];

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="sticky top-16 z-40 w-full border-b bg-muted/50 backdrop-blur-sm"
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-center gap-2 py-2 text-sm">
              {/* Prefix */}
              <span className="text-muted-foreground font-medium hidden sm:inline">
                {labels.prefix}
              </span>

              {/* Persona Links */}
              <nav className="flex items-center">
                {personas.map((persona, index) => {
                  const Icon = persona.icon;
                  return (
                    <div key={persona.label} className="flex items-center">
                      {index > 0 && (
                        <span className="mx-2 text-muted-foreground/50 hidden sm:inline">
                          |
                        </span>
                      )}
                      <Link
                        href={persona.href}
                        className={cn(
                          "group flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all",
                          "text-muted-foreground hover:text-foreground",
                          "hover:bg-primary/10"
                        )}
                      >
                        <Icon className="h-4 w-4 transition-transform group-hover:scale-110" />
                        <span className="font-medium">{persona.label}</span>
                      </Link>
                    </div>
                  );
                })}
              </nav>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
