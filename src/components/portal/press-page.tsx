"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Newspaper,
  Download,
  Mail,
  Trophy,
  Users,
  Award,
  Scale,
  FileText,
  Calendar,
  Image,
  Link2,
  Copy,
  Check,
  ExternalLink,
  Camera,
  type LucideIcon,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { usePortal } from "~/lib/portal/context";
import { cn } from "~/lib/utils";

interface PressStats {
  totalCups: number;
  totalProducts: number;
  totalParticipants: number;
  totalJuries: number;
  yearsActive?: number;
}

interface PressRelease {
  id: string;
  title: string;
  date: Date;
  summary: string;
  pdfUrl?: string;
}

interface GalleryImage {
  id: string;
  url: string;
  caption: string;
  cupName?: string;
}

interface PressPageProps {
  stats: PressStats;
  pressReleases?: PressRelease[];
  galleryImages?: GalleryImage[];
  mediaKitUrl?: string;
}

// Labels by locale
const pressLabels = {
  fr: {
    title: "Espace Presse & Médias",
    subtitle:
      "Retrouvez toutes les ressources nécessaires pour couvrir nos événements",
    statsTitle: "Nos Chiffres Clés",
    statsSubtitle: "Les données qui parlent",
    cups: "Éditions organisées",
    products: "Produits évalués",
    participants: "Producteurs participants",
    juries: "Jurys experts",
    years: "Années d'expérience",
    mediaKitTitle: "Kit Média",
    mediaKitDesc:
      "Téléchargez notre kit presse complet avec logos, photos HD et informations clés.",
    mediaKitDownload: "Télécharger le kit média",
    mediaKitSoon: "Kit média bientôt disponible",
    mediaKitContains: "Notre kit média contient :",
    mediaKitItems: [
      "Logos en haute résolution (PNG, SVG)",
      "Photos des événements précédents",
      "Présentation de l'organisation",
      "Chiffres clés et historique",
    ],
    pressReleasesTitle: "Communiqués de Presse",
    pressReleasesDesc: "Nos derniers communiqués et annonces officielles.",
    pressReleasesEmpty:
      "Les communiqués de presse seront disponibles prochainement.",
    downloadPdf: "Télécharger PDF",
    galleryTitle: "Galerie Photos",
    galleryDesc: "Photos officielles utilisables pour vos articles.",
    galleryEmpty: "La galerie sera disponible prochainement.",
    contactTitle: "Contact Presse",
    contactDesc:
      "Pour toute demande d'interview, accréditation ou information complémentaire.",
    contactButton: "Contacter le service presse",
    copyLink: "Copier le lien",
    linkCopied: "Lien copié !",
    tabs: {
      overview: "Aperçu",
      releases: "Communiqués",
      gallery: "Galerie",
    },
  },
  en: {
    title: "Press & Media Room",
    subtitle:
      "Find all the resources you need to cover our events",
    statsTitle: "Key Figures",
    statsSubtitle: "Data that speaks",
    cups: "Editions organized",
    products: "Products evaluated",
    participants: "Participating producers",
    juries: "Expert juries",
    years: "Years of experience",
    mediaKitTitle: "Media Kit",
    mediaKitDesc:
      "Download our complete press kit with logos, HD photos, and key information.",
    mediaKitDownload: "Download media kit",
    mediaKitSoon: "Media kit coming soon",
    mediaKitContains: "Our media kit contains:",
    mediaKitItems: [
      "High resolution logos (PNG, SVG)",
      "Photos from previous events",
      "Organization presentation",
      "Key figures and history",
    ],
    pressReleasesTitle: "Press Releases",
    pressReleasesDesc: "Our latest press releases and official announcements.",
    pressReleasesEmpty: "Press releases will be available soon.",
    downloadPdf: "Download PDF",
    galleryTitle: "Photo Gallery",
    galleryDesc: "Official photos available for your articles.",
    galleryEmpty: "Gallery will be available soon.",
    contactTitle: "Press Contact",
    contactDesc:
      "For interview requests, accreditation, or additional information.",
    contactButton: "Contact press team",
    copyLink: "Copy link",
    linkCopied: "Link copied!",
    tabs: {
      overview: "Overview",
      releases: "Releases",
      gallery: "Gallery",
    },
  },
} as const;

/**
 * Animated Stat Card
 */
function StatCard({
  icon: Icon,
  value,
  label,
  index,
}: {
  icon: LucideIcon;
  value: number;
  label: string;
  index: number;
}) {
  const { theme } = usePortal();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1 }}
    >
      <Card className="text-center hover:shadow-lg transition-shadow">
        <CardContent className="pt-6">
          <motion.div
            initial={{ scale: 0 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.1 + 0.2, type: "spring" }}
            className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full"
            style={{ backgroundColor: `${theme.primaryColor}20` }}
          >
            <Icon className="h-7 w-7" style={{ color: theme.primaryColor }} />
          </motion.div>
          <motion.p
            className="text-4xl font-bold"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.1 + 0.3 }}
          >
            {value.toLocaleString()}
          </motion.p>
          <p className="text-sm text-muted-foreground mt-1">{label}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

/**
 * Press Release Card
 */
function PressReleaseCard({ release, index }: { release: PressRelease; index: number }) {
  const { theme, locale } = usePortal();
  const labels = pressLabels[locale] ?? pressLabels.fr;

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(date));
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1 }}
    >
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <Calendar className="h-4 w-4" />
                <span>{formatDate(release.date)}</span>
              </div>
              <h3 className="font-semibold text-lg mb-2">{release.title}</h3>
              <p className="text-muted-foreground text-sm line-clamp-2">
                {release.summary}
              </p>
            </div>
            {release.pdfUrl && (
              <Button variant="outline" size="sm" asChild>
                <a href={release.pdfUrl} target="_blank" rel="noopener noreferrer">
                  <Download className="h-4 w-4 mr-1" />
                  {labels.downloadPdf}
                </a>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

/**
 * Gallery Image Card
 */
function GalleryImageCard({ image, index }: { image: GalleryImage; index: number }) {
  const { theme, locale } = usePortal();
  const labels = pressLabels[locale] ?? pressLabels.fr;
  const [copied, setCopied] = useState(false);

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(image.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1 }}
      className="group relative"
    >
      <div className="aspect-video rounded-lg overflow-hidden bg-muted">
        <img
          src={image.url}
          alt={image.caption}
          className="w-full h-full object-cover transition-transform group-hover:scale-105"
        />
      </div>
      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={handleCopyLink}
          className="gap-1"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4" />
              {labels.linkCopied}
            </>
          ) : (
            <>
              <Link2 className="h-4 w-4" />
              {labels.copyLink}
            </>
          )}
        </Button>
        <Button size="sm" variant="secondary" asChild>
          <a href={image.url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4" />
          </a>
        </Button>
      </div>
      <div className="mt-2">
        <p className="text-sm font-medium truncate">{image.caption}</p>
        {image.cupName && (
          <p className="text-xs text-muted-foreground">{image.cupName}</p>
        )}
      </div>
    </motion.div>
  );
}

/**
 * Press Page Component - Story 12.15
 */
export function PressPage({
  stats,
  pressReleases = [],
  galleryImages = [],
  mediaKitUrl,
}: PressPageProps) {
  const { theme, organization, locale } = usePortal();
  const labels = pressLabels[locale] ?? pressLabels.fr;

  const pressEmail = `presse@${organization.slug ?? organization.name.toLowerCase().replace(/\s+/g, "-")}.com`;

  const statItems: Array<{
    icon: LucideIcon;
    value: number;
    label: string;
  }> = [
    { icon: Trophy, value: stats.totalCups, label: labels.cups },
    { icon: Award, value: stats.totalProducts, label: labels.products },
    { icon: Users, value: stats.totalParticipants, label: labels.participants },
    { icon: Scale, value: stats.totalJuries, label: labels.juries },
  ];

  if (stats.yearsActive) {
    statItems.push({
      icon: Calendar,
      value: stats.yearsActive,
      label: labels.years,
    });
  }

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <div
        className="relative py-16 md:py-24"
        style={{
          background: `linear-gradient(135deg, ${theme.primaryColor} 0%, ${theme.secondaryColor} 100%)`,
        }}
      >
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-32 h-32 rounded-full bg-white blur-3xl" />
          <div className="absolute bottom-10 right-10 w-48 h-48 rounded-full bg-white blur-3xl" />
        </div>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center text-white relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Badge className="mb-4 bg-white/20 text-white border-0">
              <Newspaper className="h-3 w-3 mr-1" />
              Presse
            </Badge>
            <h1 className="text-3xl md:text-5xl font-bold mb-4">
              {labels.title}
            </h1>
            <p className="text-lg text-white/90 max-w-2xl mx-auto">
              {labels.subtitle}
            </p>
          </motion.div>
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Tabs */}
        <Tabs defaultValue="overview" className="space-y-8">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-3">
            <TabsTrigger value="overview">{labels.tabs.overview}</TabsTrigger>
            <TabsTrigger value="releases">{labels.tabs.releases}</TabsTrigger>
            <TabsTrigger value="gallery">{labels.tabs.gallery}</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-12">
            {/* Stats Section */}
            <motion.section
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold mb-2">{labels.statsTitle}</h2>
                <p className="text-muted-foreground">{labels.statsSubtitle}</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
                {statItems.map((stat, index) => (
                  <StatCard
                    key={stat.label}
                    icon={stat.icon}
                    value={stat.value}
                    label={stat.label}
                    index={index}
                  />
                ))}
              </div>
            </motion.section>

            {/* Media Kit Section */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Download
                      className="h-5 w-5"
                      style={{ color: theme.primaryColor }}
                    />
                    {labels.mediaKitTitle}
                  </CardTitle>
                  <CardDescription>{labels.mediaKitDesc}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      {labels.mediaKitContains}
                    </p>
                    <ul className="grid gap-2 text-sm sm:grid-cols-2">
                      {labels.mediaKitItems.map((item, index) => (
                        <li key={index} className="flex items-center gap-2">
                          <div
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: theme.primaryColor }}
                          />
                          {item}
                        </li>
                      ))}
                    </ul>
                    {mediaKitUrl ? (
                      <Button
                        className="mt-4"
                        style={{ backgroundColor: theme.primaryColor }}
                        asChild
                      >
                        <a href={mediaKitUrl} download>
                          <Download className="h-4 w-4 mr-2" />
                          {labels.mediaKitDownload}
                        </a>
                      </Button>
                    ) : (
                      <Button
                        className="mt-4"
                        style={{ backgroundColor: theme.primaryColor }}
                        disabled
                      >
                        <Download className="h-4 w-4 mr-2" />
                        {labels.mediaKitSoon}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.section>

            {/* Contact Section */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center py-12 bg-muted/30 rounded-2xl"
            >
              <Mail
                className="h-10 w-10 mx-auto mb-4"
                style={{ color: theme.primaryColor }}
              />
              <h2 className="text-2xl font-bold mb-2">{labels.contactTitle}</h2>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                {labels.contactDesc}
              </p>
              <Button
                size="lg"
                asChild
                style={{ backgroundColor: theme.primaryColor }}
              >
                <a
                  href={`mailto:${pressEmail}?subject=Demande presse - ${organization.name}`}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  {labels.contactButton}
                </a>
              </Button>
              <p className="text-sm text-muted-foreground mt-4">
                <a
                  href={`mailto:${pressEmail}`}
                  className="underline"
                  style={{ color: theme.primaryColor }}
                >
                  {pressEmail}
                </a>
              </p>
            </motion.section>
          </TabsContent>

          {/* Press Releases Tab */}
          <TabsContent value="releases" className="space-y-6">
            <div className="flex items-center gap-2 mb-6">
              <FileText
                className="h-5 w-5"
                style={{ color: theme.primaryColor }}
              />
              <h2 className="text-xl font-bold">{labels.pressReleasesTitle}</h2>
            </div>

            {pressReleases.length > 0 ? (
              <div className="space-y-4">
                {pressReleases.map((release, index) => (
                  <PressReleaseCard
                    key={release.id}
                    release={release}
                    index={index}
                  />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">
                    {labels.pressReleasesEmpty}
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Gallery Tab */}
          <TabsContent value="gallery" className="space-y-6">
            <div className="flex items-center gap-2 mb-6">
              <Camera
                className="h-5 w-5"
                style={{ color: theme.primaryColor }}
              />
              <h2 className="text-xl font-bold">{labels.galleryTitle}</h2>
            </div>

            {galleryImages.length > 0 ? (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {galleryImages.map((image, index) => (
                  <GalleryImageCard key={image.id} image={image} index={index} />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Image className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">{labels.galleryEmpty}</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
