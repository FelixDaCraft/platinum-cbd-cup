"use client";

import { useState } from "react";
import { Trophy, Award, Medal, ChevronDown, ChevronUp, Star } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import { usePortal } from "~/lib/portal/context";
import { convertScoreToScale as convertScore, getMaxScoreForScale } from "~/lib/validations/labels";

type MedalType = "gold" | "silver" | "bronze";

interface Participation {
  cupId: string;
  cupName: string;
  year: number;
  productName: string;
  labelName: string;
  labelColor: string | null;
  labelIcon: string | null;
  medalType: MedalType | null;
  score: string | null;
  cupRatingScale: string | null;
}

/**
 * Convert a 0-100 percentage score to the cup's rating scale
 */
function convertScoreToScale(percentScore: number, ratingScale: string | null): { value: number; max: number } {
  const max = getMaxScoreForScale(ratingScale);
  const value = convertScore(percentScore, ratingScale) ?? 0;
  return { value, max };
}

interface ProducerMedals {
  id: string;
  brandName: string;
  companyName: string;
  logo: string | null;
  gold: number;
  silver: number;
  bronze: number;
  total: number;
  participations: Participation[];
}

interface HallOfFameContentProps {
  producers: ProducerMedals[];
  totalGold: number;
  totalSilver: number;
  totalBronze: number;
}

const medalColors = {
  gold: { bg: "bg-yellow-500", text: "text-yellow-500", label: "Or" },
  silver: { bg: "bg-gray-400", text: "text-gray-400", label: "Argent" },
  bronze: { bg: "bg-amber-700", text: "text-amber-700", label: "Bronze" },
};

function MedalBadge({ type, count }: { type: MedalType; count: number }) {
  const colors = medalColors[type];
  return (
    <div className="flex items-center gap-1">
      <div className={`h-6 w-6 rounded-full ${colors.bg} flex items-center justify-center`}>
        <Medal className="h-4 w-4 text-white" />
      </div>
      <span className="font-semibold">{count}</span>
    </div>
  );
}

function ProducerCard({ producer, rank }: { producer: ProducerMedals; rank: number }) {
  const [isOpen, setIsOpen] = useState(false);
  const { theme } = usePortal();

  // Group participations by year
  const participationsByYear = producer.participations.reduce((acc, p) => {
    const existing = acc.get(p.year) ?? [];
    existing.push(p);
    acc.set(p.year, existing);
    return acc;
  }, new Map<number, Participation[]>());

  const sortedYears = [...participationsByYear.keys()].sort((a, b) => b - a);

  return (
    <Card className={rank <= 3 ? "border-2" : ""} style={rank <= 3 ? { borderColor: theme.primaryColor } : {}}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              {/* Rank badge */}
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full text-white font-bold ${
                  rank === 1
                    ? "bg-yellow-500"
                    : rank === 2
                    ? "bg-gray-400"
                    : rank === 3
                    ? "bg-amber-700"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {rank <= 3 ? <Trophy className="h-5 w-5" /> : rank}
              </div>

              {/* Producer info */}
              <div className="flex items-center gap-3">
                {producer.logo ? (
                  <img
                    src={producer.logo}
                    alt={producer.brandName}
                    className="h-12 w-12 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                    <Award className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <CardTitle className="text-lg">{producer.brandName}</CardTitle>
                  <CardDescription>{producer.companyName}</CardDescription>
                </div>
              </div>
            </div>

            {/* Medals summary */}
            <div className="flex items-center gap-4">
              {producer.gold > 0 && <MedalBadge type="gold" count={producer.gold} />}
              {producer.silver > 0 && <MedalBadge type="silver" count={producer.silver} />}
              {producer.bronze > 0 && <MedalBadge type="bronze" count={producer.bronze} />}
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between">
              <span className="text-sm text-muted-foreground">
                {producer.total} médaille{producer.total > 1 ? "s" : ""} · {participationsByYear.size} année{participationsByYear.size > 1 ? "s" : ""}
              </span>
              {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>

          <CollapsibleContent className="mt-4 space-y-4">
            {sortedYears.map((year) => (
              <div key={year}>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Star className="h-4 w-4" style={{ color: theme.primaryColor }} />
                  {year}
                </h4>
                <div className="space-y-2 pl-6">
                  {participationsByYear.get(year)?.map((p, idx) => (
                    <div
                      key={`${p.cupId}-${p.productName}-${idx}`}
                      className="flex items-center justify-between text-sm p-2 rounded-lg bg-muted/50"
                    >
                      <div>
                        <span className="font-medium">{p.productName}</span>
                        <span className="text-muted-foreground"> · {p.cupName}</span>
                      </div>
                      <Badge
                        variant="outline"
                        className="flex items-center gap-1"
                        style={{
                          borderColor: p.labelColor ?? undefined,
                          color: p.labelColor ?? undefined,
                        }}
                      >
                        {p.labelIcon && !p.labelIcon.startsWith("http") && (
                          <span className="text-xs">{p.labelIcon}</span>
                        )}
                        {p.labelName}
                        {p.score && (() => {
                          const { value, max } = convertScoreToScale(parseFloat(p.score), p.cupRatingScale);
                          return ` (${value.toFixed(1)}/${max})`;
                        })()}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CollapsibleContent>
        </CardContent>
      </Collapsible>
    </Card>
  );
}

export function HallOfFameContent({
  producers,
  totalGold,
  totalSilver,
  totalBronze,
}: HallOfFameContentProps) {
  const { theme } = usePortal();

  if (producers.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <Trophy className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-semibold">Aucun producteur médaillé</h3>
          <p className="mt-2 text-muted-foreground">
            Les producteurs médaillés apparaîtront ici après les premières compétitions.
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalMedals = totalGold + totalSilver + totalBronze;

  return (
    <div className="space-y-8">
      {/* Global stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-lg"
                style={{ backgroundColor: theme.primaryColor }}
              >
                <Trophy className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-3xl font-bold">{totalMedals}</p>
                <p className="text-sm text-muted-foreground">Total médailles</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-yellow-500">
                <Medal className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-3xl font-bold">{totalGold}</p>
                <p className="text-sm text-muted-foreground">Médailles Or</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-400">
                <Medal className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-3xl font-bold">{totalSilver}</p>
                <p className="text-sm text-muted-foreground">Médailles Argent</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-700">
                <Medal className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-3xl font-bold">{totalBronze}</p>
                <p className="text-sm text-muted-foreground">Médailles Bronze</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Podium for top 3 */}
      {producers.length >= 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" style={{ color: theme.primaryColor }} />
              Le Podium
            </CardTitle>
            <CardDescription>Les 3 producteurs les plus médaillés</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-center gap-4 py-8">
              {/* 2nd place */}
              <div className="flex flex-col items-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-400 text-white text-2xl font-bold mb-2">
                  2
                </div>
                <div className="h-24 w-28 bg-gray-400/20 rounded-t-lg flex items-center justify-center">
                  {producers[1]?.logo ? (
                    <img
                      src={producers[1].logo}
                      alt={producers[1].brandName}
                      className="h-16 w-16 rounded-lg object-cover"
                    />
                  ) : (
                    <Award className="h-8 w-8 text-gray-400" />
                  )}
                </div>
                <p className="mt-2 font-semibold text-center line-clamp-1">{producers[1]?.brandName}</p>
                <p className="text-sm text-muted-foreground">{producers[1]?.total} médailles</p>
              </div>

              {/* 1st place */}
              <div className="flex flex-col items-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-yellow-500 text-white text-3xl font-bold mb-2">
                  1
                </div>
                <div className="h-32 w-32 bg-yellow-500/20 rounded-t-lg flex items-center justify-center">
                  {producers[0]?.logo ? (
                    <img
                      src={producers[0].logo}
                      alt={producers[0].brandName}
                      className="h-20 w-20 rounded-lg object-cover"
                    />
                  ) : (
                    <Trophy className="h-10 w-10 text-yellow-500" />
                  )}
                </div>
                <p className="mt-2 font-bold text-lg text-center line-clamp-1">{producers[0]?.brandName}</p>
                <p className="text-sm text-muted-foreground">{producers[0]?.total} médailles</p>
              </div>

              {/* 3rd place */}
              <div className="flex flex-col items-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-700 text-white text-xl font-bold mb-2">
                  3
                </div>
                <div className="h-20 w-24 bg-amber-700/20 rounded-t-lg flex items-center justify-center">
                  {producers[2]?.logo ? (
                    <img
                      src={producers[2].logo}
                      alt={producers[2].brandName}
                      className="h-14 w-14 rounded-lg object-cover"
                    />
                  ) : (
                    <Award className="h-7 w-7 text-amber-700" />
                  )}
                </div>
                <p className="mt-2 font-semibold text-center line-clamp-1">{producers[2]?.brandName}</p>
                <p className="text-sm text-muted-foreground">{producers[2]?.total} médailles</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Full ranking */}
      <div>
        <h2 className="text-xl font-bold mb-4">Classement complet</h2>
        <div className="space-y-4">
          {producers.map((producer, index) => (
            <ProducerCard key={producer.id} producer={producer} rank={index + 1} />
          ))}
        </div>
      </div>
    </div>
  );
}
