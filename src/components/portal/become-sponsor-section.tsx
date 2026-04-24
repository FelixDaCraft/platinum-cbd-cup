"use client";

import { Eye, Target, Users, Handshake, Mail, Star, Award, Trophy } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { usePortal } from "~/lib/portal/context";

interface BecomeSponsorSectionProps {
  organizationEmail?: string | null;
  stats?: {
    totalCups: number;
    totalProducts: number;
    totalParticipants: number;
  };
}

const benefitsData = [
  {
    icon: Eye,
    title: "Visibilité",
    description: "Votre logo sur nos supports de communication, événements et plateformes digitales.",
  },
  {
    icon: Target,
    title: "Audience Qualifiée",
    description: "Accédez à une communauté de producteurs, professionnels et passionnés du secteur.",
  },
  {
    icon: Handshake,
    title: "Réseau Professionnel",
    description: "Connectez-vous avec les acteurs clés de l'industrie lors de nos événements.",
  },
];

const tiersData = [
  {
    name: "Bronze",
    color: "bg-amber-700",
    benefits: ["Logo sur le footer", "Mention dans les communications"],
    featured: false,
  },
  {
    name: "Argent",
    color: "bg-gray-400",
    benefits: ["Logo sur le site", "Présence sur les réseaux", "Mention événement"],
    featured: false,
  },
  {
    name: "Or",
    color: "bg-yellow-500",
    benefits: ["Logo en homepage", "Présence événement", "Stand partenaire", "Page dédiée"],
    featured: true,
  },
  {
    name: "Platine",
    color: "bg-cyan-500",
    benefits: ["Visibilité maximale", "Stand premium", "Prise de parole", "Contenu exclusif"],
    featured: false,
  },
];

export function BecomeSponsorSection({ organizationEmail, stats }: BecomeSponsorSectionProps) {
  const { organization, theme } = usePortal();

  const contactEmail = organizationEmail ?? `partenariats@${organization.name.toLowerCase().replace(/\s+/g, "")}.com`;

  return (
    <div className="space-y-16">
      {/* Hero Section */}
      <section
        className="relative py-16 rounded-3xl overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${theme.primaryColor} 0%, ${theme.secondaryColor} 100%)`,
        }}
      >
        <div className="absolute inset-0 bg-black/20" />
        <div className="relative z-10 text-center text-white px-6">
          <Badge className="mb-4 bg-white/20 text-white border-0">
            <Star className="h-3 w-3 mr-1" />
            Devenir Partenaire
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Associez votre marque à l&apos;excellence
          </h1>
          <p className="text-lg text-white/90 max-w-2xl mx-auto">
            Rejoignez nos partenaires et bénéficiez d&apos;une visibilité unique auprès d&apos;une communauté passionnée.
          </p>
        </div>
      </section>

      {/* Stats Section */}
      {stats && (stats.totalCups > 0 || stats.totalProducts > 0) && (
        <section className="grid gap-4 sm:grid-cols-3">
          <Card className="text-center">
            <CardContent className="pt-6">
              <Trophy className="h-8 w-8 mx-auto mb-2" style={{ color: theme.primaryColor }} />
              <p className="text-3xl font-bold">{stats.totalCups}</p>
              <p className="text-sm text-muted-foreground">Cups organisées</p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="pt-6">
              <Award className="h-8 w-8 mx-auto mb-2" style={{ color: theme.primaryColor }} />
              <p className="text-3xl font-bold">{stats.totalProducts}</p>
              <p className="text-sm text-muted-foreground">Produits évalués</p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="pt-6">
              <Users className="h-8 w-8 mx-auto mb-2" style={{ color: theme.primaryColor }} />
              <p className="text-3xl font-bold">{stats.totalParticipants}</p>
              <p className="text-sm text-muted-foreground">Participants</p>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Benefits Section */}
      <section>
        <h2 className="text-2xl font-bold mb-6 text-center">Pourquoi nous rejoindre ?</h2>
        <div className="grid gap-6 sm:grid-cols-3">
          {benefitsData.map((benefit) => (
            <Card key={benefit.title} className="text-center">
              <CardContent className="pt-6">
                <div
                  className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
                  style={{ backgroundColor: `${theme.primaryColor}20` }}
                >
                  <benefit.icon className="h-7 w-7" style={{ color: theme.primaryColor }} />
                </div>
                <h3 className="font-semibold mb-2">{benefit.title}</h3>
                <p className="text-sm text-muted-foreground">{benefit.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Tiers Section */}
      <section>
        <h2 className="text-2xl font-bold mb-6 text-center">Nos Formules Partenariat</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {tiersData.map((tier) => (
            <Card
              key={tier.name}
              className={`relative ${tier.featured ? "ring-2 ring-yellow-500 shadow-lg" : ""}`}
            >
              {tier.featured && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-500">
                  Populaire
                </Badge>
              )}
              <CardHeader className="pb-2">
                <div className={`h-2 w-16 rounded-full ${tier.color} mb-3`} />
                <CardTitle>{tier.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {tier.benefits.map((benefit, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <div
                        className={`mt-1.5 h-1.5 w-1.5 rounded-full ${tier.color}`}
                      />
                      <span>{benefit}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="text-center text-sm text-muted-foreground mt-4">
          Tarifs et conditions sur demande
        </p>
      </section>

      {/* Contact Section */}
      <section className="text-center py-12 bg-muted/30 rounded-2xl">
        <Mail className="h-10 w-10 mx-auto mb-4" style={{ color: theme.primaryColor }} />
        <h2 className="text-2xl font-bold mb-2">Intéressé ?</h2>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          Contactez-nous pour discuter de votre partenariat et obtenir un devis personnalisé.
        </p>
        <Button size="lg" asChild style={{ backgroundColor: theme.primaryColor }}>
          <a href={`mailto:${contactEmail}?subject=Demande de partenariat`}>
            <Mail className="h-4 w-4 mr-2" />
            Nous contacter
          </a>
        </Button>
        <p className="text-sm text-muted-foreground mt-4">
          ou écrivez-nous à{" "}
          <a
            href={`mailto:${contactEmail}`}
            className="underline"
            style={{ color: theme.primaryColor }}
          >
            {contactEmail}
          </a>
        </p>
      </section>
    </div>
  );
}
