"use client";

import Link from "next/link";
import { Facebook, Instagram, Twitter, Youtube, Mail, Leaf, Store, Handshake, Newspaper } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { usePortal } from "~/lib/portal/context";

// Navigation labels by locale (same as header)
const navLabels = {
  fr: {
    home: "Accueil",
    cups: "Nos Cups",
    palmares: "Palmarès",
    about: "À Propos",
    articles: "Actualités",
    contact: "Contact",
  },
  en: {
    home: "Home",
    cups: "Our Cups",
    palmares: "Awards",
    about: "About",
    articles: "News",
    contact: "Contact",
  },
} as const;

const navLinks = [
  { href: "/", labelKey: "home" as const },
  { href: "/cups", labelKey: "cups" as const },
  { href: "/palmares", labelKey: "palmares" as const },
  { href: "/about", labelKey: "about" as const },
  { href: "/articles", labelKey: "articles" as const },
  { href: "/contact", labelKey: "contact" as const },
];

// Footer-specific labels by locale
const footerLabels = {
  fr: {
    navigation: "Navigation",
    youAre: "Vous êtes...",
    newsletter: "Newsletter",
    newsletterDescription: "Restez informé des prochaines cups et actualités.",
    emailPlaceholder: "votre@email.com",
    noSpam: "Pas de spam, uniquement les infos importantes.",
    poweredBy: "Propulsé par",
    producer: "Producteur",
    producerDesc: "Participez à nos cups",
    retailer: "Gérant magasin",
    retailerDesc: "Découvrez les lauréats",
    sponsor: "Sponsor",
    sponsorDesc: "Devenez partenaire",
    press: "Journaliste",
    pressDesc: "Espace presse",
    legalNotice: "Mentions légales",
    privacy: "Confidentialité",
    terms: "CGV",
  },
  en: {
    navigation: "Navigation",
    youAre: "You are...",
    newsletter: "Newsletter",
    newsletterDescription: "Stay informed about upcoming cups and news.",
    emailPlaceholder: "your@email.com",
    noSpam: "No spam, only important updates.",
    poweredBy: "Powered by",
    producer: "Producer",
    producerDesc: "Participate in our cups",
    retailer: "Store Manager",
    retailerDesc: "Discover the winners",
    sponsor: "Sponsor",
    sponsorDesc: "Become a partner",
    press: "Journalist",
    pressDesc: "Press room",
    legalNotice: "Legal Notice",
    privacy: "Privacy",
    terms: "Terms",
  },
} as const;

const socialLinks = [
  { href: "#", icon: Facebook, label: "Facebook" },
  { href: "#", icon: Instagram, label: "Instagram" },
  { href: "#", icon: Twitter, label: "X (Twitter)" },
  { href: "#", icon: Youtube, label: "YouTube" },
];

export function PortalFooter() {
  const { organization, theme, locale } = usePortal();
  const currentYear = new Date().getFullYear();

  const nav = navLabels[locale] ?? navLabels.fr;
  const labels = footerLabels[locale] ?? footerLabels.fr;

  // Personas with locale-aware labels
  const personas = [
    { href: "/cups", label: labels.producer, icon: Leaf, description: labels.producerDesc },
    { href: "/palmares", label: labels.retailer, icon: Store, description: labels.retailerDesc },
    { href: "/sponsors", label: labels.sponsor, icon: Handshake, description: labels.sponsorDesc },
    { href: "/press", label: labels.press, icon: Newspaper, description: labels.pressDesc },
  ];

  // Legal links with locale-aware labels
  const legalLinks = [
    { href: "/mentions-legales", label: labels.legalNotice },
    { href: "/confidentialite", label: labels.privacy },
    { href: "/cgv", label: labels.terms },
  ];

  return (
    <footer className="border-t bg-muted/30">
      <div className="container mx-auto py-12 md:py-16 px-4 sm:px-6 lg:px-8">
        {/* Main grid */}
        <div className="grid gap-10 lg:grid-cols-12">
          {/* Organization info - spans 4 columns */}
          <div className="lg:col-span-4">
            <Link href="/" className="flex items-center gap-2">
              {theme.logoUrl ? (
                <img
                  src={theme.logoUrl}
                  alt={organization.name}
                  className="h-10 w-auto object-contain"
                />
              ) : (
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-white font-bold text-lg"
                  style={{ backgroundColor: theme.primaryColor }}
                >
                  {organization.name.charAt(0)}
                </div>
              )}
              <span className="font-bold text-lg">{organization.name}</span>
            </Link>
            <p className="mt-4 text-sm text-muted-foreground max-w-xs">
              {locale === "en"
                ? "Organizer of quality competitions and events. Join our community of enthusiasts and professionals."
                : "Organisateur de concours et événements de qualité. Rejoignez notre communauté de passionnés et de professionnels."}
            </p>
            {/* Social links */}
            <div className="mt-6 flex gap-3">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground transition-all hover:scale-110"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = theme.primaryColor;
                    e.currentTarget.style.color = "white";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "";
                    e.currentTarget.style.color = "";
                  }}
                  aria-label={social.label}
                >
                  <social.icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Navigation links - spans 2 columns */}
          <div className="lg:col-span-2">
            <h3 className="font-semibold mb-4">{labels.navigation}</h3>
            <ul className="space-y-2.5">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {nav[link.labelKey]}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Vous êtes... - spans 3 columns */}
          <div className="lg:col-span-3">
            <h3 className="font-semibold mb-4">{labels.youAre}</h3>
            <ul className="space-y-3">
              {personas.map((persona) => (
                <li key={persona.href}>
                  <Link
                    href={persona.href}
                    className="group flex items-start gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <persona.icon
                      className="h-4 w-4 mt-0.5 shrink-0 transition-colors"
                      style={{ color: theme.primaryColor }}
                    />
                    <div>
                      <span className="font-medium text-foreground">{persona.label}</span>
                      <p className="text-xs text-muted-foreground group-hover:text-muted-foreground/80">
                        {persona.description}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Newsletter - spans 3 columns */}
          <div className="lg:col-span-3">
            <h3 className="font-semibold mb-4">{labels.newsletter}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {labels.newsletterDescription}
            </p>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                // Placeholder - newsletter functionality to be implemented
              }}
            >
              <Input
                type="email"
                placeholder={labels.emailPlaceholder}
                className="h-9 text-sm"
                aria-label="Email"
              />
              <Button
                type="submit"
                size="sm"
                className="shrink-0"
                style={{ backgroundColor: theme.primaryColor }}
              >
                <Mail className="h-4 w-4" />
              </Button>
            </form>
            <p className="text-xs text-muted-foreground mt-2">
              {labels.noSpam}
            </p>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-8 border-t">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {/* Copyright and legal */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
              <span>&copy; {currentYear} {organization.name}</span>
              <span className="hidden sm:inline">•</span>
              {legalLinks.map((link, index) => (
                <span key={link.href} className="flex items-center gap-4">
                  <Link
                    href={link.href}
                    className="hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                  {index < legalLinks.length - 1 && (
                    <span className="hidden sm:inline text-muted-foreground/50">•</span>
                  )}
                </span>
              ))}
            </div>

            {/* Powered by */}
            <p className="text-xs text-muted-foreground">
              {labels.poweredBy}{" "}
              <a
                href="https://cupmetrics.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium underline-offset-4 hover:underline"
                style={{ color: theme.primaryColor }}
              >
                CupMetrics
              </a>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
