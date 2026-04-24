"use client";

import { Newspaper, Download, Mail, Trophy, Users, Award, Scale, FileText } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { usePortal } from "~/lib/portal/context";

interface PressContentProps {
  stats: {
    totalCups: number;
    totalProducts: number;
    totalParticipants: number;
    totalJuries: number;
  };
}

export function PressContent({ stats }: PressContentProps) {
  const { organization, theme } = usePortal();

  const pressEmail = `presse@${organization.name.toLowerCase().replace(/\s+/g, "")}.com`;

  return (
    <div className="space-y-12">
      {/* Header */}
      <div className="text-center">
        <Badge className="mb-4" style={{ backgroundColor: theme.primaryColor }}>
          <Newspaper className="h-3 w-3 mr-1" />
          Espace Presse
        </Badge>
        <h1 className="text-4xl font-bold mb-4">Espace Presse & Médias</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Retrouvez toutes les ressources nécessaires pour couvrir nos événements.
          Logos, photos, communiqués et contacts.
        </p>
      </div>

      {/* Key Stats */}
      <section>
        <h2 className="text-2xl font-bold mb-6 text-center">Chiffres Clés</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="text-center">
            <CardContent className="pt-6">
              <div
                className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full"
                style={{ backgroundColor: `${theme.primaryColor}20` }}
              >
                <Trophy className="h-6 w-6" style={{ color: theme.primaryColor }} />
              </div>
              <p className="text-3xl font-bold">{stats.totalCups}</p>
              <p className="text-sm text-muted-foreground">Éditions organisées</p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardContent className="pt-6">
              <div
                className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full"
                style={{ backgroundColor: `${theme.primaryColor}20` }}
              >
                <Users className="h-6 w-6" style={{ color: theme.primaryColor }} />
              </div>
              <p className="text-3xl font-bold">{stats.totalParticipants}</p>
              <p className="text-sm text-muted-foreground">Producteurs participants</p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardContent className="pt-6">
              <div
                className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full"
                style={{ backgroundColor: `${theme.primaryColor}20` }}
              >
                <Award className="h-6 w-6" style={{ color: theme.primaryColor }} />
              </div>
              <p className="text-3xl font-bold">{stats.totalProducts}</p>
              <p className="text-sm text-muted-foreground">Produits évalués</p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardContent className="pt-6">
              <div
                className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full"
                style={{ backgroundColor: `${theme.primaryColor}20` }}
              >
                <Scale className="h-6 w-6" style={{ color: theme.primaryColor }} />
              </div>
              <p className="text-3xl font-bold">{stats.totalJuries}</p>
              <p className="text-sm text-muted-foreground">Jurys experts</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Media Kit */}
      <section>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" style={{ color: theme.primaryColor }} />
              Kit Média
            </CardTitle>
            <CardDescription>
              Téléchargez notre kit presse complet avec logos, photos HD et informations clés.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Notre kit média contient :
              </p>
              <ul className="grid gap-2 text-sm sm:grid-cols-2">
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: theme.primaryColor }} />
                  Logos en haute résolution (PNG, SVG)
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: theme.primaryColor }} />
                  Photos des événements précédents
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: theme.primaryColor }} />
                  Présentation de l&apos;organisation
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: theme.primaryColor }} />
                  Chiffres clés et historique
                </li>
              </ul>
              <Button
                className="mt-4"
                style={{ backgroundColor: theme.primaryColor }}
                disabled
              >
                <Download className="h-4 w-4 mr-2" />
                Kit média bientôt disponible
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Press Releases */}
      <section>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" style={{ color: theme.primaryColor }} />
              Communiqués de Presse
            </CardTitle>
            <CardDescription>
              Nos derniers communiqués et annonces officielles.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Les communiqués de presse seront disponibles prochainement.
              Contactez-nous pour être ajouté à notre liste de diffusion.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Contact */}
      <section className="text-center py-12 bg-muted/30 rounded-2xl">
        <Mail className="h-10 w-10 mx-auto mb-4" style={{ color: theme.primaryColor }} />
        <h2 className="text-2xl font-bold mb-2">Contact Presse</h2>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          Pour toute demande d&apos;interview, accréditation ou information complémentaire.
        </p>
        <Button size="lg" asChild style={{ backgroundColor: theme.primaryColor }}>
          <a href={`mailto:${pressEmail}?subject=Demande presse - ${organization.name}`}>
            <Mail className="h-4 w-4 mr-2" />
            Contacter le service presse
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
      </section>
    </div>
  );
}
