"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Trophy, Calendar, Users, Award, Search, Filter, ChevronRight } from "lucide-react";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { usePortal } from "~/lib/portal/context";

interface CategoryInfo {
  id: string;
  name: string;
}

interface LabelInfo {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  isPublic: boolean;
}

interface ArchivedCup {
  id: string;
  name: string;
  description: string | null;
  bannerUrl: string | null;
  ratingEndAt: Date | null;
  resultsPublishedAt: Date | null;
  eventDate: Date | null;
  categoriesCount: number;
  labelsCount: number;
  participantsCount: number;
  categories: CategoryInfo[];
  labels: LabelInfo[];
}

interface PortalArchivesListProps {
  cups: ArchivedCup[];
}

function formatDate(date: Date | null): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(date));
}

function getYear(date: Date | null): number {
  if (!date) return new Date().getFullYear();
  return new Date(date).getFullYear();
}

function groupByYear(cups: ArchivedCup[]): Map<number, ArchivedCup[]> {
  const grouped = new Map<number, ArchivedCup[]>();

  for (const cup of cups) {
    const year = getYear(cup.eventDate ?? cup.ratingEndAt);
    const existing = grouped.get(year) ?? [];
    existing.push(cup);
    grouped.set(year, existing);
  }

  // Sort years descending
  return new Map([...grouped.entries()].sort((a, b) => b[0] - a[0]));
}

export function PortalArchivesList({ cups }: PortalArchivesListProps) {
  const { theme } = usePortal();
  const [searchQuery, setSearchQuery] = useState("");
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [labelFilter, setLabelFilter] = useState<string>("all");

  // Get unique years, categories, and labels for filters
  const { years, allCategories, allLabels } = useMemo(() => {
    const yearsSet = new Set<number>();
    const categoriesMap = new Map<string, string>();
    const labelsMap = new Map<string, { name: string; color: string | null }>();

    for (const cup of cups) {
      yearsSet.add(getYear(cup.eventDate ?? cup.ratingEndAt));
      for (const cat of cup.categories) {
        categoriesMap.set(cat.id, cat.name);
      }
      // Only include public labels
      for (const label of cup.labels.filter((l) => l.isPublic)) {
        labelsMap.set(label.id, { name: label.name, color: label.color });
      }
    }

    return {
      years: [...yearsSet].sort((a, b) => b - a),
      allCategories: [...categoriesMap.entries()].map(([id, name]) => ({ id, name })),
      allLabels: [...labelsMap.entries()].map(([id, data]) => ({ id, ...data })),
    };
  }, [cups]);

  // Filter cups
  const filteredCups = useMemo(() => {
    return cups.filter((cup) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = cup.name.toLowerCase().includes(query);
        const matchesDescription = cup.description?.toLowerCase().includes(query);
        if (!matchesName && !matchesDescription) return false;
      }

      // Year filter
      if (yearFilter !== "all") {
        const cupYear = getYear(cup.eventDate ?? cup.ratingEndAt);
        if (cupYear !== parseInt(yearFilter)) return false;
      }

      // Category filter
      if (categoryFilter !== "all") {
        const hasCategory = cup.categories.some((c) => c.id === categoryFilter);
        if (!hasCategory) return false;
      }

      // Label filter
      if (labelFilter !== "all") {
        const hasLabel = cup.labels.some((l) => l.id === labelFilter && l.isPublic);
        if (!hasLabel) return false;
      }

      return true;
    });
  }, [cups, searchQuery, yearFilter, categoryFilter, labelFilter]);

  // Group filtered cups by year
  const groupedCups = useMemo(() => groupByYear(filteredCups), [filteredCups]);

  if (cups.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <Trophy className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-semibold">Aucune archive disponible</h3>
          <p className="mt-2 text-muted-foreground">
            Les résultats des éditions terminées apparaîtront ici.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Rechercher une cup..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Select value={yearFilter} onValueChange={setYearFilter}>
                <SelectTrigger className="w-[140px]">
                  <Calendar className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Année" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
                  {years.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Catégorie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes catégories</SelectItem>
                  {allCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {allLabels.length > 0 && (
                <Select value={labelFilter} onValueChange={setLabelFilter}>
                  <SelectTrigger className="w-[160px]">
                    <Award className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Label" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous labels</SelectItem>
                    {allLabels.map((label) => (
                      <SelectItem key={label.id} value={label.id}>
                        <span className="flex items-center gap-2">
                          {label.color && (
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: label.color }}
                            />
                          )}
                          {label.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {filteredCups.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              Aucune cup ne correspond à vos critères de recherche.
            </p>
            <Button
              variant="link"
              onClick={() => {
                setSearchQuery("");
                setYearFilter("all");
                setCategoryFilter("all");
                setLabelFilter("all");
              }}
            >
              Réinitialiser les filtres
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {[...groupedCups.entries()].map(([year, yearCups]) => (
            <div key={year}>
              <div className="mb-4 flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full text-white font-bold"
                  style={{ backgroundColor: theme.primaryColor }}
                >
                  <Calendar className="h-5 w-5" />
                </div>
                <h2 className="text-2xl font-bold">{year}</h2>
                <Badge variant="secondary">{yearCups.length} édition{yearCups.length > 1 ? "s" : ""}</Badge>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {yearCups.map((cup) => (
                  <ArchiveCupCard key={cup.id} cup={cup} primaryColor={theme.primaryColor} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stats summary */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Statistiques globales</CardTitle>
          <CardDescription>Résumé de toutes les éditions archivées</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <Trophy className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{cups.length}</p>
                <p className="text-sm text-muted-foreground">Éditions</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <Users className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {cups.reduce((sum, cup) => sum + cup.participantsCount, 0)}
                </p>
                <p className="text-sm text-muted-foreground">Participants</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <Award className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {new Set(cups.flatMap((c) => c.categories.map((cat) => cat.name))).size}
                </p>
                <p className="text-sm text-muted-foreground">Catégories</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <Calendar className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{years.length}</p>
                <p className="text-sm text-muted-foreground">Années</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ArchiveCupCard({ cup, primaryColor }: { cup: ArchivedCup; primaryColor: string }) {
  const displayDate = cup.eventDate ?? cup.ratingEndAt;

  return (
    <Card className="group overflow-hidden transition-all hover:shadow-lg">
      {cup.bannerUrl && (
        <div
          className="h-32 bg-cover bg-center"
          style={{ backgroundImage: `url(${cup.bannerUrl})` }}
        />
      )}
      <CardHeader className={cup.bannerUrl ? "pt-4" : ""}>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="line-clamp-1">{cup.name}</CardTitle>
            {displayDate && (
              <CardDescription>{formatDate(displayDate)}</CardDescription>
            )}
          </div>
          {cup.resultsPublishedAt && (
            <Badge className="bg-green-500">Résultats</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {cup.description && (
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {cup.description}
          </p>
        )}

        {/* Stats */}
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>{cup.participantsCount} participants</span>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Award className="h-4 w-4" />
            <span>{cup.categoriesCount} catégories</span>
          </div>
        </div>

        {/* Labels preview - only public labels */}
        {cup.labels.filter((l) => l.isPublic).length > 0 && (
          <div className="flex flex-wrap gap-1">
            {cup.labels
              .filter((l) => l.isPublic)
              .slice(0, 3)
              .map((label) => (
                <Badge
                  key={label.id}
                  variant="outline"
                  className="flex items-center gap-1"
                  style={{
                    borderColor: label.color ?? undefined,
                    color: label.color ?? undefined,
                  }}
                >
                  {label.icon && !label.icon.startsWith("http") && (
                    <span className="text-xs">{label.icon}</span>
                  )}
                  {label.name}
                </Badge>
              ))}
            {cup.labels.filter((l) => l.isPublic).length > 3 && (
              <Badge variant="outline">
                +{cup.labels.filter((l) => l.isPublic).length - 3}
              </Badge>
            )}
          </div>
        )}

        {/* Action */}
        <Button
          variant="ghost"
          className="w-full justify-between group-hover:bg-muted"
          asChild
        >
          <Link href={`/cups/${cup.id}`}>
            Voir les résultats
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
