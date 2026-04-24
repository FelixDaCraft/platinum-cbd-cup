"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { FlaskConical, TrendingUp, AlertCircle } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

import { api } from "~/trpc/react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

export default function LabRankingsPage() {
  const params = useParams();
  const cupId = params.cupId as string;
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null,
  );

  const { data, isLoading, error } = api.product.rankByTerpenes.useQuery({
    cupId,
  });

  const activeCategory = useMemo(() => {
    if (!data) return null;
    if (selectedCategoryId) {
      return (
        data.categories.find((c) => c.categoryId === selectedCategoryId) ?? null
      );
    }
    // default to the first non-empty category
    return data.categories.find((c) => c.ranked.length > 0) ?? data.categories[0] ?? null;
  }, [data, selectedCategoryId]);

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <span style={{ fontFamily: "'Space Mono', monospace", color: "var(--n-text-secondary)" }}>[LOADING...]</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ background: "rgba(212,68,68,0.06)", border: "1px solid rgba(212,68,68,0.25)", borderRadius: "8px", padding: "16px", color: "var(--n-accent)", fontSize: "14px" }}>
        Impossible de charger les classements.
      </div>
    );
  }

  const hasAnyAnalysis = data.categories.some((c) => c.ranked.length > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 style={{ fontFamily: "'Doto', 'Space Mono', monospace", fontSize: "20px", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 700, color: "var(--n-text-display)", display: "flex", alignItems: "center", gap: "8px" }}>
          <FlaskConical className="h-5 w-5" style={{ color: "var(--n-interactive)" }} />
          Classement terpènes
        </h1>
        <p className="n-label" style={{ marginTop: "4px" }}>
          Produits classés par pourcentage total de terpènes — {data.cupName}
        </p>
      </div>

      {!hasAnyAnalysis ? (
        <div style={{ background: "var(--n-surface)", border: "1px solid var(--n-border)", borderRadius: "12px", padding: "32px", textAlign: "center" }}>
          <FlaskConical className="mx-auto h-10 w-10" style={{ color: "var(--n-text-disabled)", marginBottom: "12px" }} />
          <p style={{ fontFamily: "'Doto', 'Space Mono', monospace", fontSize: "14px", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 700, color: "var(--n-text-primary)" }}>
            Aucune analyse de laboratoire
          </p>
          <p className="n-label" style={{ marginTop: "4px" }}>
            Importez un certificat d&apos;analyse depuis la page Produits pour voir apparaître un classement ici.
          </p>
        </div>
      ) : (
        <>
          {/* Category selector */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="n-label">Catégorie :</label>
            <Select
              value={activeCategory?.categoryId ?? ""}
              onValueChange={(v) => setSelectedCategoryId(v)}
            >
              <SelectTrigger className="sm:w-[280px]">
                <SelectValue placeholder="Choisir une catégorie" />
              </SelectTrigger>
              <SelectContent>
                {data.categories.map((c) => (
                  <SelectItem key={c.categoryId} value={c.categoryId}>
                    {c.categoryName} ({c.ranked.length}{" "}
                    {c.ranked.length > 1 ? "analyses" : "analyse"}
                    {c.withoutAnalysis.length > 0
                      ? `, ${c.withoutAnalysis.length} manquante${c.withoutAnalysis.length > 1 ? "s" : ""}`
                      : ""}
                    )
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {activeCategory && (
            <CategoryRanking category={activeCategory} />
          )}
        </>
      )}
    </div>
  );
}

type CategoryData = {
  categoryId: string;
  categoryName: string;
  ranked: Array<{
    productId: string;
    productName: string;
    anonymousCode: string | null;
    producerName: string;
    terpenesTotal: number | null;
    computedTerpeneSum: number | null;
    topTerpenes: Array<{ abbreviation: string; name: string; percentage: number }>;
  }>;
  withoutAnalysis: Array<{
    productId: string;
    productName: string;
    anonymousCode: string | null;
    producerName: string;
  }>;
};

function CategoryRanking({ category }: { category: CategoryData }) {
  const chartData = useMemo(
    () =>
      category.ranked.map((p, idx) => ({
        label: p.anonymousCode ?? `#${idx + 1}`,
        name: p.productName,
        producer: p.producerName,
        value:
          p.terpenesTotal ?? p.computedTerpeneSum ?? 0,
      })),
    [category],
  );

  if (category.ranked.length === 0) {
    return (
      <div style={{ background: "var(--n-surface)", border: "1px solid var(--n-border)", borderRadius: "12px", padding: "32px", textAlign: "center" }}>
        <p className="n-label">Aucune analyse enregistrée pour cette catégorie.</p>
      </div>
    );
  }

  const best = category.ranked[0];
  const worst = category.ranked[category.ranked.length - 1];
  const avg =
    category.ranked.reduce(
      (sum, p) => sum + (p.terpenesTotal ?? p.computedTerpeneSum ?? 0),
      0,
    ) / category.ranked.length;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Meilleur"
          value={`${(best?.terpenesTotal ?? best?.computedTerpeneSum ?? 0).toFixed(2)}%`}
          sub={best?.anonymousCode ?? best?.productName}
          accent
        />
        <StatCard
          label="Moyenne catégorie"
          value={`${avg.toFixed(2)}%`}
          sub={`${category.ranked.length} produits`}
        />
        <StatCard
          label="Plus bas"
          value={`${(worst?.terpenesTotal ?? worst?.computedTerpeneSum ?? 0).toFixed(2)}%`}
          sub={worst?.anonymousCode ?? worst?.productName}
        />
      </div>

      {/* Bar chart */}
      <div style={{ background: "var(--n-surface)", border: "1px solid var(--n-border)", borderRadius: "12px", padding: "16px" }}>
        <div style={{ marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
          <TrendingUp className="h-4 w-4" style={{ color: "var(--n-interactive)" }} />
          <span style={{ fontFamily: "'Doto', 'Space Mono', monospace", fontSize: "12px", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--n-text-display)", fontWeight: 700 }}>
            Profil terpénique par produit
          </span>
        </div>
        <div style={{ height: "320px", width: "100%" }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--n-border)" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--n-text-secondary)" }} />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--n-text-secondary)" }}
                tickFormatter={(v: number) => `${v}%`}
              />
              <Tooltip
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: "1px solid var(--n-border-visible)",
                  background: "var(--n-surface-raised)",
                  color: "var(--n-text-primary)",
                }}
                formatter={(value: number | undefined) => [
                  `${(value ?? 0).toFixed(2)}%`,
                  "Terpènes",
                ]}
                labelFormatter={(label: string, payload) => {
                  const item = payload?.[0]?.payload as
                    | { name: string; producer: string }
                    | undefined;
                  return item ? `${label} — ${item.name}\n${item.producer}` : label;
                }}
              />
              <Bar
                dataKey="value"
                fill="var(--n-interactive)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Ranked table */}
      <div style={{ background: "var(--n-surface)", border: "1px solid var(--n-border)", borderRadius: "12px", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--n-border)" }}>
          <p style={{ fontFamily: "'Doto', 'Space Mono', monospace", fontSize: "12px", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--n-text-display)", fontWeight: 700 }}>Classement détaillé</p>
        </div>
        <table style={{ width: "100%", fontSize: "13px" }}>
          <thead>
            <tr style={{ background: "var(--n-surface-raised)", borderBottom: "1px solid var(--n-border)" }}>
              <th style={{ padding: "8px 12px", textAlign: "left", fontFamily: "'Space Mono', monospace", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--n-text-secondary)", fontWeight: 600 }}>Rang</th>
              <th style={{ padding: "8px 12px", textAlign: "left", fontFamily: "'Space Mono', monospace", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--n-text-secondary)", fontWeight: 600 }}>Code</th>
              <th style={{ padding: "8px 12px", textAlign: "left", fontFamily: "'Space Mono', monospace", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--n-text-secondary)", fontWeight: 600 }}>Produit</th>
              <th style={{ padding: "8px 12px", textAlign: "left", fontFamily: "'Space Mono', monospace", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--n-text-secondary)", fontWeight: 600 }}>Producteur</th>
              <th style={{ padding: "8px 12px", textAlign: "right", fontFamily: "'Space Mono', monospace", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--n-text-secondary)", fontWeight: 600 }}>Terpènes %</th>
              <th style={{ padding: "8px 12px", textAlign: "left", fontFamily: "'Space Mono', monospace", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--n-text-secondary)", fontWeight: 600 }}>Top 3 terpènes</th>
            </tr>
          </thead>
          <tbody>
            {category.ranked.map((p, idx) => {
              const value = p.terpenesTotal ?? p.computedTerpeneSum ?? 0;
              return (
                <tr key={p.productId} style={{ borderTop: "1px solid var(--n-border)" }}>
                  <td style={{ padding: "8px 12px", fontWeight: 700, color: "var(--n-text-display)" }}>
                    {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : idx + 1}
                  </td>
                  <td style={{ padding: "8px 12px", fontFamily: "'Space Mono', monospace", color: "var(--n-interactive)" }}>
                    {p.anonymousCode ?? "—"}
                  </td>
                  <td style={{ padding: "8px 12px", color: "var(--n-text-primary)" }}>{p.productName}</td>
                  <td style={{ padding: "8px 12px", color: "var(--n-text-secondary)" }}>
                    {p.producerName}
                  </td>
                  <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "'Space Mono', monospace", fontWeight: 700, color: "var(--n-text-display)" }}>
                    {value.toFixed(2)}%
                  </td>
                  <td style={{ padding: "8px 12px" }}>
                    <div className="flex flex-wrap gap-1">
                      {p.topTerpenes.map((t) => (
                        <span
                          key={t.abbreviation}
                          style={{
                            fontFamily: "'Space Mono', monospace",
                            fontSize: "10px",
                            color: "var(--n-text-secondary)",
                            border: "1px solid var(--n-border-visible)",
                            borderRadius: "4px",
                            padding: "1px 5px",
                          }}
                        >
                          {t.abbreviation} {t.percentage}%
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {category.withoutAnalysis.length > 0 && (
        <div style={{ background: "rgba(212,168,67,0.06)", border: "1px solid rgba(212,168,67,0.25)", borderRadius: "8px", padding: "16px" }}>
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--n-warning)" }} />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: "13px", fontWeight: 500, color: "var(--n-warning)" }}>
                {category.withoutAnalysis.length} produit
                {category.withoutAnalysis.length > 1 ? "s" : ""} sans analyse labo
              </p>
              <ul style={{ marginTop: "8px", listStyle: "none", padding: 0 }} className="space-y-1">
                {category.withoutAnalysis.map((p) => (
                  <li key={p.productId} style={{ fontSize: "12px", color: "var(--n-text-secondary)" }}>
                    <span style={{ fontFamily: "'Space Mono', monospace" }}>{p.anonymousCode ?? "—"}</span>
                    {" — "}
                    {p.productName}
                    {" ("}
                    {p.producerName}
                    {")"}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        background: accent ? "rgba(var(--n-interactive-rgb, 100,149,237), 0.06)" : "var(--n-surface)",
        border: accent ? "1px solid var(--n-interactive)" : "1px solid var(--n-border)",
        borderRadius: "12px",
        padding: "16px",
      }}
    >
      <p style={{ fontFamily: "'Doto', 'Space Mono', monospace", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--n-text-secondary)", fontWeight: 600 }}>
        {label}
      </p>
      <p style={{ fontFamily: "'Space Mono', monospace", fontSize: "24px", fontWeight: 700, color: accent ? "var(--n-interactive)" : "var(--n-text-display)", marginTop: "4px" }}>{value}</p>
      {sub && (
        <p style={{ fontSize: "12px", color: "var(--n-text-secondary)", marginTop: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</p>
      )}
    </div>
  );
}
