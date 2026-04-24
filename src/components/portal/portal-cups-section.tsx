"use client";

import Link from "next/link";
import { CalendarDays, MapPin, Tag, ArrowRight, Users, Leaf } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { usePortal } from "~/lib/portal/context";
import { StatusBadge } from "./status-badge";
import { CountdownBadge } from "./countdown-timer";

interface Cup {
  id: string;
  name: string;
  description: string | null;
  bannerUrl: string | null;
  registrationOpenAt: Date | null;
  registrationCloseAt: Date | null;
  ratingEndAt: Date | null;
  eventDate: Date | null;
  eventLocation: string | null;
  status: string;
  categoriesCount: number;
  registrationsCount: number;
}

interface PortalCupsSectionProps {
  cups: Cup[];
}

function formatDate(date: Date | null): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

function CupCard({ cup }: { cup: Cup }) {
  const { theme } = usePortal();
  const isRegistrationOpen = cup.status === "published";
  const hasRegistrationDeadline = cup.registrationCloseAt && isRegistrationOpen;

  return (
    <Card className="group overflow-hidden transition-all hover:shadow-xl hover:-translate-y-1">
      {/* Banner with overlay */}
      <div className="relative h-44 overflow-hidden">
        {/* Background */}
        {cup.bannerUrl ? (
          <div
            className="absolute inset-0 bg-cover bg-center transition-transform group-hover:scale-105"
            style={{ backgroundImage: `url(${cup.bannerUrl})` }}
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(135deg, ${theme.primaryColor} 0%, ${theme.secondaryColor} 100%)`,
            }}
          >
            {/* Stylized leaf icon instead of sad trophy */}
            <div className="absolute inset-0 flex items-center justify-center">
              <Leaf className="h-16 w-16 text-white/20" />
            </div>
          </div>
        )}

        {/* Gradient overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        {/* Status badge + Countdown in overlay */}
        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
          <StatusBadge status={cup.status} size="sm" />
          {hasRegistrationDeadline && (
            <CountdownBadge
              targetDate={new Date(cup.registrationCloseAt!)}
              className="text-white bg-black/40 backdrop-blur-sm px-2 py-1 rounded-full"
            />
          )}
        </div>
      </div>

      <CardHeader className="pb-2">
        <CardTitle className="line-clamp-2 text-lg">{cup.name}</CardTitle>
        {cup.description && (
          <CardDescription className="line-clamp-2 text-sm">
            {cup.description}
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Event Info Grid */}
        <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
          {cup.eventDate && (
            <div className="flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              <span>{formatDate(cup.eventDate)}</span>
            </div>
          )}
          {cup.eventLocation && (
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              <span className="truncate">{cup.eventLocation}</span>
            </div>
          )}
          {cup.categoriesCount > 0 && (
            <div className="flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5" />
              <span>{cup.categoriesCount} catégorie{cup.categoriesCount > 1 ? "s" : ""}</span>
            </div>
          )}
        </div>

        {/* Social Proof */}
        {cup.registrationsCount > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground border-t pt-3">
            <div className="flex -space-x-2">
              {/* Placeholder avatars */}
              {[...Array(Math.min(3, cup.registrationsCount))].map((_, i) => (
                <div
                  key={i}
                  className="h-6 w-6 rounded-full border-2 border-background flex items-center justify-center text-xs font-medium"
                  style={{
                    backgroundColor: `${theme.primaryColor}${20 + i * 15}`,
                    color: theme.primaryColor,
                  }}
                >
                  <Users className="h-3 w-3" />
                </div>
              ))}
            </div>
            <span className="text-xs">
              {cup.registrationsCount} producteur{cup.registrationsCount > 1 ? "s" : ""} inscrit{cup.registrationsCount > 1 ? "s" : ""}
            </span>
          </div>
        )}

        {/* CTAs */}
        <div className="flex gap-2 pt-2">
          {isRegistrationOpen ? (
            <>
              <Button
                className="flex-1"
                size="sm"
                asChild
                style={{ backgroundColor: theme.primaryColor }}
              >
                <Link href={`/cups/${cup.id}/register`}>S&apos;inscrire</Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/cups/${cup.id}`}>
                  Détails
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </>
          ) : (
            <Button className="w-full" variant="outline" size="sm" asChild>
              <Link href={`/cups/${cup.id}`}>
                Voir les détails
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function PortalCupsSection({ cups }: PortalCupsSectionProps) {
  const { theme } = usePortal();

  if (cups.length === 0) {
    return (
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div
              className="mx-auto flex h-20 w-20 items-center justify-center rounded-full"
              style={{ backgroundColor: `${theme.primaryColor}20` }}
            >
              <Leaf
                className="h-10 w-10"
                style={{ color: theme.primaryColor }}
              />
            </div>
            <h2 className="mt-6 text-2xl font-bold">Aucune cup pour le moment</h2>
            <p className="mt-2 text-muted-foreground max-w-md mx-auto">
              Revenez bientôt pour découvrir nos prochains concours et participer à l&apos;aventure.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-16 md:py-24 bg-muted/30">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Nos Cups</h2>
            <p className="mt-2 text-muted-foreground">
              Découvrez nos concours en cours et à venir
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/cups">
              Voir toutes les cups
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {cups.slice(0, 6).map((cup) => (
            <CupCard key={cup.id} cup={cup} />
          ))}
        </div>
      </div>
    </section>
  );
}
