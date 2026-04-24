"use client";

import Link from "next/link";
import { Menu, X, LogIn, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "~/components/ui/button";
import { usePortal } from "~/lib/portal/context";
import { cn } from "~/lib/utils";
import { LanguageSelector } from "./language-selector";
import { useSession } from "~/lib/auth-client";
import { UserMenu } from "~/components/layout/user-menu";

// Navigation labels by locale
const navLabels = {
  fr: {
    home: "Accueil",
    cups: "Nos Cups",
    palmares: "Palmarès",
    about: "À Propos",
    articles: "Actualités",
    contact: "Contact",
    participate: "Participer",
    login: "Connexion",
    menu: "Menu",
    close: "Fermer",
  },
  en: {
    home: "Home",
    cups: "Our Cups",
    palmares: "Awards",
    about: "About",
    articles: "News",
    contact: "Contact",
    participate: "Participate",
    login: "Login",
    menu: "Menu",
    close: "Close",
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

/**
 * Portal Header Component - Story 12.1
 * Supports 4 styles: classic, centered, minimal, ultra-premium
 */
export function PortalHeader() {
  const { organization, theme, locale } = usePortal();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { data: session, isPending: isSessionLoading } = useSession();

  const labels = navLabels[locale] ?? navLabels.fr;
  const headerStyle = theme.headerStyle ?? "classic";
  // Ultra-premium header is ALWAYS transparent (inherent design)
  // Other styles depend on the headerTransparent setting
  const shouldBeTransparent = headerStyle === "ultra-premium" ? true : theme.headerTransparent;
  const isTransparent = shouldBeTransparent && !scrolled;
  const isDarkMode = theme.colorMode === "dark";

  // Handle scroll for transparent header
  useEffect(() => {
    // Always listen for scroll on ultra-premium or when headerTransparent is true
    if (headerStyle !== "ultra-premium" && !theme.headerTransparent) return;

    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [headerStyle, theme.headerTransparent]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, []);

  // Render based on header style
  switch (headerStyle) {
    case "centered":
      return (
        <CenteredHeader
          organization={organization}
          theme={theme}
          locale={locale}
          labels={labels}
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
          isTransparent={isTransparent}
          isDarkMode={isDarkMode}
          session={session}
          isSessionLoading={isSessionLoading}
        />
      );
    case "minimal":
      return (
        <MinimalHeader
          organization={organization}
          theme={theme}
          locale={locale}
          labels={labels}
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
          isTransparent={isTransparent}
          isDarkMode={isDarkMode}
          session={session}
          isSessionLoading={isSessionLoading}
        />
      );
    case "ultra-premium":
      return (
        <UltraPremiumHeader
          organization={organization}
          theme={theme}
          locale={locale}
          labels={labels}
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
          isTransparent={isTransparent}
          isDarkMode={isDarkMode}
          session={session}
          isSessionLoading={isSessionLoading}
        />
      );
    case "classic":
    default:
      return (
        <ClassicHeader
          organization={organization}
          theme={theme}
          locale={locale}
          labels={labels}
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
          isTransparent={isTransparent}
          isDarkMode={isDarkMode}
          session={session}
          isSessionLoading={isSessionLoading}
        />
      );
  }
}

// Navigation labels type
type NavLabels = {
  home: string;
  cups: string;
  palmares: string;
  about: string;
  articles: string;
  contact: string;
  participate: string;
  login: string;
  menu: string;
  close: string;
};

// Session type from auth-client
type SessionData = ReturnType<typeof useSession>["data"];

// Common props for all header variants
interface HeaderVariantProps {
  organization: { name: string; slug: string | null; logo: string | null };
  theme: ReturnType<typeof usePortal>["theme"];
  locale: ReturnType<typeof usePortal>["locale"];
  labels: NavLabels;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  isTransparent: boolean;
  isDarkMode: boolean;
  session: SessionData;
  isSessionLoading: boolean;
}

// Logo Component
function HeaderLogo({
  theme,
  organization,
  className,
}: {
  theme: HeaderVariantProps["theme"];
  organization: HeaderVariantProps["organization"];
  className?: string;
}) {
  return (
    <Link href="/" className={cn("flex items-center gap-2", className)}>
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
      <span className="hidden font-bold sm:inline-block">{organization.name}</span>
    </Link>
  );
}

/**
 * Classic Header: Logo left, nav center, CTA right
 */
function ClassicHeader({
  organization,
  theme,
  locale,
  labels,
  mobileMenuOpen,
  setMobileMenuOpen,
  isTransparent,
  isDarkMode,
  session,
  isSessionLoading,
}: HeaderVariantProps) {
  // Text color classes for transparent header based on color mode
  const transparentTextClass = isDarkMode
    ? "text-white/90 hover:text-white"
    : "text-foreground/90 hover:text-foreground";

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b transition-all duration-300",
        isTransparent
          ? cn("bg-transparent border-transparent", isDarkMode ? "text-white" : "text-foreground")
          : "bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      )}
    >
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <HeaderLogo theme={theme} organization={organization} />

        {/* Desktop Navigation - Center */}
        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "text-sm font-medium transition-colors",
                isTransparent
                  ? transparentTextClass
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {labels[link.labelKey]}
            </Link>
          ))}
        </nav>

        {/* CTA Buttons + Language Selector - Right */}
        <div className="hidden md:flex items-center gap-2">
          {theme.showLanguageSelector && theme.enabledLocales.length > 1 && (
            <LanguageSelector
              currentLocale={locale}
              availableLocales={theme.enabledLocales}
            />
          )}
          {isSessionLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : session?.user ? (
            <UserMenu hideSettings />
          ) : (
            <Button asChild variant="outline" size="sm">
              <Link href="/login">
                <LogIn className="mr-2 h-4 w-4" />
                {labels.login}
              </Link>
            </Button>
          )}
          <Button asChild style={{ backgroundColor: theme.primaryColor }}>
            <Link href="/cups">{labels.participate}</Link>
          </Button>
        </div>

        {/* Mobile Menu Button */}
        <button
          type="button"
          className="md:hidden p-2"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? labels.close : labels.menu}
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile Navigation */}
      <MobileMenu
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        theme={theme}
        locale={locale}
        labels={labels}
        session={session}
        isSessionLoading={isSessionLoading}
      />
    </header>
  );
}

/**
 * Centered Header: Logo centered, nav balanced on sides
 */
function CenteredHeader({
  organization,
  theme,
  locale,
  labels,
  mobileMenuOpen,
  setMobileMenuOpen,
  isTransparent,
  isDarkMode,
  session,
  isSessionLoading,
}: HeaderVariantProps) {
  const leftLinks = navLinks.slice(0, 3);
  const rightLinks = navLinks.slice(3);

  // Text color classes for transparent header based on color mode
  const transparentTextClass = isDarkMode
    ? "text-white/90 hover:text-white"
    : "text-foreground/90 hover:text-foreground";

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b transition-all duration-300",
        isTransparent
          ? cn("bg-transparent border-transparent", isDarkMode ? "text-white" : "text-foreground")
          : "bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      )}
    >
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left Navigation */}
        <nav className="hidden md:flex items-center gap-6 flex-1">
          {leftLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "text-sm font-medium transition-colors",
                isTransparent
                  ? transparentTextClass
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {labels[link.labelKey]}
            </Link>
          ))}
        </nav>

        {/* Centered Logo */}
        <HeaderLogo
          theme={theme}
          organization={organization}
          className="justify-center"
        />

        {/* Right Navigation + CTA */}
        <div className="hidden md:flex items-center gap-6 flex-1 justify-end">
          {rightLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "text-sm font-medium transition-colors",
                isTransparent
                  ? transparentTextClass
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {labels[link.labelKey]}
            </Link>
          ))}
          {theme.showLanguageSelector && theme.enabledLocales.length > 1 && (
            <LanguageSelector
              currentLocale={locale}
              availableLocales={theme.enabledLocales}
            />
          )}
          {isSessionLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : session?.user ? (
            <UserMenu hideSettings />
          ) : (
            <Button asChild variant="outline" size="sm">
              <Link href="/login">
                <LogIn className="mr-2 h-4 w-4" />
                {labels.login}
              </Link>
            </Button>
          )}
          <Button asChild style={{ backgroundColor: theme.primaryColor }}>
            <Link href="/cups">{labels.participate}</Link>
          </Button>
        </div>

        {/* Mobile Menu Button */}
        <button
          type="button"
          className="md:hidden p-2"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? labels.close : labels.menu}
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile Navigation */}
      <MobileMenu
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        theme={theme}
        locale={locale}
        labels={labels}
        session={session}
        isSessionLoading={isSessionLoading}
      />
    </header>
  );
}

/**
 * Minimal Header: Logo + hamburger menu only
 */
function MinimalHeader({
  organization,
  theme,
  locale,
  labels,
  mobileMenuOpen,
  setMobileMenuOpen,
  isTransparent,
  isDarkMode,
  session,
  isSessionLoading,
}: HeaderVariantProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b transition-all duration-300",
        isTransparent
          ? cn("bg-transparent border-transparent", isDarkMode ? "text-white" : "text-foreground")
          : "bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      )}
    >
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <HeaderLogo theme={theme} organization={organization} />

        {/* Language Selector + Hamburger Menu */}
        <div className="flex items-center gap-2">
          {theme.showLanguageSelector && theme.enabledLocales.length > 1 && (
            <LanguageSelector
              currentLocale={locale}
              availableLocales={theme.enabledLocales}
            />
          )}
          <button
            type="button"
            className="p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? labels.close : labels.menu}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation (always shows on minimal) */}
      <MobileMenu
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        theme={theme}
        locale={locale}
        labels={labels}
        showLanguageSelector={false}
        session={session}
        isSessionLoading={isSessionLoading}
      />
    </header>
  );
}

/**
 * Ultra Premium Header: Transparent, "Menu" text, full-screen overlay
 */
function UltraPremiumHeader({
  organization,
  theme,
  locale,
  labels,
  mobileMenuOpen,
  setMobileMenuOpen,
  isTransparent,
  isDarkMode,
  session,
  isSessionLoading,
}: HeaderVariantProps) {
  // ALWAYS use explicit colors based on dark mode - don't rely on CSS variables
  // Dark mode: white text/bars (visible on dark backgrounds)
  // Light mode: dark text/bars (visible on light backgrounds)
  const barColor = isDarkMode ? "bg-white" : "bg-slate-900";
  const textColorClass = isDarkMode ? "text-white" : "text-slate-900";

  return (
    <>
      <header
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
          isTransparent
            ? "bg-transparent"
            : isDarkMode
              ? "bg-slate-900/95 backdrop-blur"
              : "bg-white/95 backdrop-blur"
        )}
      >
        <div className="container mx-auto flex h-20 items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <HeaderLogo theme={theme} organization={organization} />

          {/* Menu Text Button */}
          <button
            type="button"
            className={cn(
              "flex items-center gap-2 text-sm font-medium tracking-wider uppercase transition-colors",
              textColorClass
            )}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <span>{mobileMenuOpen ? labels.close : labels.menu}</span>
            <div className="flex flex-col gap-1">
              <span
                className={cn(
                  "block h-0.5 w-6 transition-all duration-300",
                  barColor,
                  mobileMenuOpen && "rotate-45 translate-y-1.5"
                )}
              />
              <span
                className={cn(
                  "block h-0.5 w-6 transition-all duration-300",
                  barColor,
                  mobileMenuOpen && "opacity-0"
                )}
              />
              <span
                className={cn(
                  "block h-0.5 w-6 transition-all duration-300",
                  barColor,
                  mobileMenuOpen && "-rotate-45 -translate-y-1.5"
                )}
              />
            </div>
          </button>
        </div>
      </header>

      {/* Full-screen Overlay Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[100]"
            style={{
              backgroundColor: isDarkMode ? "#0f172a" : "#ffffff",
            }}
          >
            {/* Close button at top right */}
            <div className="absolute top-0 right-0 p-6">
              <button
                type="button"
                className="flex items-center gap-2 text-sm font-medium tracking-wider uppercase transition-colors"
                style={{
                  color: isDarkMode ? "#f8fafc" : "#0a0a0f",
                }}
                onClick={() => setMobileMenuOpen(false)}
              >
                <span>{labels.close}</span>
                <X className="h-6 w-6" />
              </button>
            </div>

            <motion.nav
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ delay: 0.1, duration: 0.3 }}
              className="flex flex-col items-center justify-center h-full gap-8"
            >
              {navLinks.map((link, index) => (
                <motion.div
                  key={link.href}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + index * 0.05, duration: 0.3 }}
                >
                  <Link
                    href={link.href}
                    className="text-4xl md:text-6xl font-bold transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                    style={{
                      color: isDarkMode ? "#f8fafc" : "#0a0a0f",
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = theme.primaryColor}
                    onMouseLeave={(e) => e.currentTarget.style.color = isDarkMode ? "#f8fafc" : "#0a0a0f"}
                  >
                    {labels[link.labelKey]}
                  </Link>
                </motion.div>
              ))}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.3 }}
                className="mt-8 flex flex-col sm:flex-row items-center gap-4"
              >
                {isSessionLoading ? (
                  <Loader2 className="h-6 w-6 animate-spin" style={{ color: isDarkMode ? "#f8fafc" : "#0a0a0f" }} />
                ) : session?.user ? (
                  <UserMenu hideSettings />
                ) : (
                  <Button
                    asChild
                    variant="outline"
                    size="lg"
                    className="text-lg px-8"
                    style={{
                      borderColor: isDarkMode ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.2)",
                      color: isDarkMode ? "#f8fafc" : "#0a0a0f",
                    }}
                  >
                    <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                      <LogIn className="mr-2 h-5 w-5" />
                      {labels.login}
                    </Link>
                  </Button>
                )}
                <Button
                  asChild
                  size="lg"
                  className="text-lg px-8"
                  style={{ backgroundColor: theme.primaryColor }}
                >
                  <Link href="/cups" onClick={() => setMobileMenuOpen(false)}>
                    {labels.participate}
                  </Link>
                </Button>
              </motion.div>
              {theme.showLanguageSelector && theme.enabledLocales.length > 1 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5, duration: 0.3 }}
                  className="mt-4"
                >
                  <LanguageSelector
                    currentLocale={locale}
                    availableLocales={theme.enabledLocales}
                    variant="buttons"
                  />
                </motion.div>
              )}

              {/* Personas Bar inside menu for ultra-premium */}
              {theme.showPersonasBar && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6, duration: 0.3 }}
                  className="mt-8 pt-8 border-t"
                  style={{ borderColor: isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)" }}
                >
                  <p
                    className="text-sm font-medium mb-4 text-center"
                    style={{ color: isDarkMode ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.6)" }}
                  >
                    {locale === "en" ? "You are:" : "Vous êtes :"}
                  </p>
                  <div className="flex flex-wrap justify-center gap-4">
                    {[
                      { label: locale === "en" ? "Producer" : "Producteur", href: "/cups" },
                      { label: locale === "en" ? "Retailer" : "Magasin", href: "/palmares" },
                      { label: "Sponsor", href: "/sponsors" },
                      { label: locale === "en" ? "Press" : "Presse", href: "/press" },
                    ].map((persona) => (
                      <Link
                        key={persona.label}
                        href={persona.href}
                        className="px-4 py-2 rounded-full text-sm font-medium transition-all hover:scale-105"
                        style={{
                          backgroundColor: isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
                          color: isDarkMode ? "#f8fafc" : "#0a0a0f",
                        }}
                        onClick={() => setMobileMenuOpen(false)}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = theme.primaryColor;
                          e.currentTarget.style.color = "#ffffff";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)";
                          e.currentTarget.style.color = isDarkMode ? "#f8fafc" : "#0a0a0f";
                        }}
                      >
                        {persona.label}
                      </Link>
                    ))}
                  </div>
                </motion.div>
              )}
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Spacer for fixed header */}
      <div className="h-20" />
    </>
  );
}

/**
 * Mobile Menu Component (for classic, centered, minimal)
 */
function MobileMenu({
  mobileMenuOpen,
  setMobileMenuOpen,
  theme,
  locale,
  labels,
  showLanguageSelector = true,
  session,
  isSessionLoading,
}: {
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  theme: HeaderVariantProps["theme"];
  locale: HeaderVariantProps["locale"];
  labels: HeaderVariantProps["labels"];
  showLanguageSelector?: boolean;
  session: SessionData;
  isSessionLoading: boolean;
}) {
  return (
    <AnimatePresence>
      {mobileMenuOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="border-t overflow-hidden"
        >
          <nav className="container mx-auto py-4 px-4 sm:px-6 lg:px-8 flex flex-col gap-2">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => setMobileMenuOpen(false)}
              >
                {labels[link.labelKey]}
              </Link>
            ))}
            {showLanguageSelector &&
              theme.showLanguageSelector &&
              theme.enabledLocales.length > 1 && (
                <div className="py-2">
                  <LanguageSelector
                    currentLocale={locale}
                    availableLocales={theme.enabledLocales}
                    variant="buttons"
                  />
                </div>
              )}
            <div className="flex flex-col gap-2 mt-2">
              {isSessionLoading ? (
                <div className="flex justify-center py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : session?.user ? (
                <div className="py-2">
                  <UserMenu hideSettings />
                </div>
              ) : (
                <Button asChild variant="outline" className="w-full">
                  <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                    <LogIn className="mr-2 h-4 w-4" />
                    {labels.login}
                  </Link>
                </Button>
              )}
              <Button
                asChild
                style={{ backgroundColor: theme.primaryColor }}
              >
                <Link href="/cups" onClick={() => setMobileMenuOpen(false)}>
                  {labels.participate}
                </Link>
              </Button>
            </div>
          </nav>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
