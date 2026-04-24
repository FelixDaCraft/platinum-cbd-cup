"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Mail, Phone, MapPin } from "lucide-react";
import { Button } from "~/components/ui/button";
import { usePortal } from "~/lib/portal/context";

interface CtaSectionProps {
  variant?: "default" | "newsletter" | "contact";
  title?: string;
  subtitle?: string;
  ctaText?: string;
  ctaUrl?: string;
}

// Labels by locale
const ctaLabels = {
  fr: {
    default: {
      title: "Pr\u00eat \u00e0 participer ?",
      subtitle:
        "Rejoignez notre prochain concours et faites reconna\u00eetre l'excellence de vos produits.",
      cta: "D\u00e9couvrir nos cups",
    },
    newsletter: {
      title: "Restez inform\u00e9",
      subtitle:
        "Inscrivez-vous \u00e0 notre newsletter pour ne manquer aucun \u00e9v\u00e9nement.",
      cta: "S'inscrire",
      placeholder: "Votre email",
    },
    contact: {
      title: "Une question ?",
      subtitle: "Notre \u00e9quipe est l\u00e0 pour vous accompagner.",
      cta: "Nous contacter",
    },
  },
  en: {
    default: {
      title: "Ready to participate?",
      subtitle:
        "Join our next competition and get your products recognized for excellence.",
      cta: "Discover our cups",
    },
    newsletter: {
      title: "Stay informed",
      subtitle: "Subscribe to our newsletter to not miss any event.",
      cta: "Subscribe",
      placeholder: "Your email",
    },
    contact: {
      title: "Have a question?",
      subtitle: "Our team is here to help you.",
      cta: "Contact us",
    },
  },
} as const;

/**
 * CTA Section - Story 12.9
 * Final call-to-action section before footer
 */
export function CtaSection({
  variant = "default",
  title,
  subtitle,
  ctaText,
  ctaUrl,
}: CtaSectionProps) {
  const { theme, locale } = usePortal();
  const variantLabels = ctaLabels[locale]?.[variant] ?? ctaLabels.fr[variant];

  const displayTitle = title ?? variantLabels.title;
  const displaySubtitle = subtitle ?? variantLabels.subtitle;
  const displayCta = ctaText ?? variantLabels.cta;
  const displayUrl = ctaUrl ?? (variant === "contact" ? "/contact" : "/cups");

  return (
    <section className="py-16 md:py-24 relative overflow-hidden">
      {/* Background */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(135deg, ${theme.primaryColor} 0%, ${theme.secondaryColor} 100%)`,
        }}
      />

      {/* Decorative elements */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-10 left-10 w-32 h-32 rounded-full bg-white blur-3xl" />
        <div className="absolute bottom-10 right-10 w-48 h-48 rounded-full bg-white blur-3xl" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="max-w-3xl mx-auto text-center text-white"
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-4">
            {displayTitle}
          </h2>
          <p className="text-lg md:text-xl text-white/90 mb-8">
            {displaySubtitle}
          </p>

          {variant === "newsletter" ? (
            <NewsletterForm
              placeholder={
                (ctaLabels[locale]?.newsletter as { placeholder?: string })
                  ?.placeholder ?? "Votre email"
              }
              buttonText={displayCta}
            />
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <Button
                size="lg"
                asChild
                className="bg-white text-black hover:bg-white/90 font-semibold shadow-lg px-8 group"
              >
                <Link href={displayUrl}>
                  {displayCta}
                  <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
            </motion.div>
          )}
        </motion.div>
      </div>
    </section>
  );
}

/**
 * Newsletter Form Component
 */
function NewsletterForm({
  placeholder,
  buttonText,
}: {
  placeholder: string;
  buttonText: string;
}) {
  return (
    <form
      className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto"
      onSubmit={(e) => e.preventDefault()}
    >
      <input
        type="email"
        placeholder={placeholder}
        className="flex-1 px-4 py-3 rounded-lg text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-white/50"
        required
      />
      <Button
        type="submit"
        className="bg-white text-black hover:bg-white/90 font-semibold"
      >
        {buttonText}
        <Mail className="ml-2 h-4 w-4" />
      </Button>
    </form>
  );
}

/**
 * Contact Info Section (alternative CTA)
 */
export function ContactInfoSection() {
  const { theme, locale } = usePortal();

  const contactItems = [
    {
      icon: Mail,
      label: "Email",
      value: "contact@example.com",
      href: "mailto:contact@example.com",
    },
    {
      icon: Phone,
      label: "T\u00e9l\u00e9phone",
      value: "+33 1 23 45 67 89",
      href: "tel:+33123456789",
    },
    {
      icon: MapPin,
      label: "Adresse",
      value: "Paris, France",
      href: "#",
    },
  ];

  return (
    <section className="py-12">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap justify-center gap-8 md:gap-16">
          {contactItems.map((item) => {
            const Icon = item.icon;
            return (
              <a
                key={item.label}
                href={item.href}
                className="flex items-center gap-3 text-muted-foreground hover:text-foreground transition-colors"
              >
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full"
                  style={{ backgroundColor: `${theme.primaryColor}15` }}
                >
                  <Icon className="h-5 w-5" style={{ color: theme.primaryColor }} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="font-medium">{item.value}</p>
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}
