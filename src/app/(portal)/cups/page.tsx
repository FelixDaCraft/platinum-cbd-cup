import Link from "next/link";
import { count, inArray } from "drizzle-orm";
import { db } from "~/server/db";
import * as schema from "~/server/db/schema";
import { Eyebrow, Pill, Countdown } from "~/components/portal/platinum";
import type { Cup } from "~/server/db/schema/cups";

// ---------------------------------------------------------------------------
// DB queries
// ---------------------------------------------------------------------------

async function getPublicCups() {
  return db.query.cups.findMany({
    where: (c, { ne }) => ne(c.status, "draft"),
    orderBy: (c, { desc }) => [desc(c.createdAt)],
  });
}

async function getCategoryCounts(cupIds: string[]): Promise<Map<string, number>> {
  if (cupIds.length === 0) return new Map();
  const rows = await db
    .select({
      cupId: schema.categories.cupId,
      total: count(),
    })
    .from(schema.categories)
    .where(inArray(schema.categories.cupId, cupIds))
    .groupBy(schema.categories.cupId);
  return new Map(rows.map((r) => [r.cupId, r.total]));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateShort(date: Date | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Derive 2-letter badge from cup name (first letters of first two words). */
function cupCode(name: string): string {
  const words = name.trim().split(/\s+/);
  const a = words[0]?.[0] ?? "C";
  const b = words[1]?.[0] ?? words[0]?.[1] ?? "P";
  return (a + b).toUpperCase();
}

function getStatusPill(status: Cup["status"]): {
  label: string;
  accent: boolean;
  dot: boolean;
} {
  switch (status) {
    case "published":
      return { label: "OPEN FOR SUBMISSIONS", accent: true, dot: true };
    case "registration_closed":
      return { label: "CLÔTURE", accent: false, dot: false };
    case "rating":
      return { label: "NOTATION EN COURS", accent: true, dot: true };
    case "completed":
      return { label: "TERMINÉE", accent: false, dot: false };
    default:
      return { label: String(status).toUpperCase(), accent: false, dot: false };
  }
}

/** Resolve the "RÉSULTATS" cell value based on cup status. */
function resultsCellValue(cup: Cup): string {
  if (cup.resultsPublishedAt) return formatDateShort(cup.resultsPublishedAt);
  if (cup.status === "rating" || cup.status === "completed") return "EN ATTENTE";
  return "—";
}

/** Pick the live countdown target for an active cup, or null. */
function pickCountdownTarget(cup: Cup): {
  ts: number;
  label: string;
} | null {
  const now = Date.now();
  if (
    cup.status === "published" &&
    cup.registrationCloseAt &&
    cup.registrationCloseAt.getTime() > now
  ) {
    return {
      ts: cup.registrationCloseAt.getTime(),
      label: "Clôture des inscriptions dans",
    };
  }
  if (
    cup.status === "rating" &&
    cup.ratingEndAt &&
    cup.ratingEndAt.getTime() > now
  ) {
    return { ts: cup.ratingEndAt.getTime(), label: "Annonce des résultats dans" };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Card sub-pieces
// ---------------------------------------------------------------------------

function GridCell({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: "var(--bg)",
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        minHeight: 60,
      }}
    >
      <div
        className="mono"
        style={{
          fontSize: 9.5,
          letterSpacing: ".15em",
          color: "var(--fg-3)",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div
        className="mono tabular"
        style={{
          fontSize: 13,
          color: "var(--fg)",
          letterSpacing: ".02em",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function InstrumentCard({
  cup,
  categoryCount,
  variant,
}: {
  cup: Cup;
  categoryCount: number;
  variant: "active" | "past";
}) {
  const pill = getStatusPill(cup.status);
  const countdown = pickCountdownTarget(cup);
  const isPast = variant === "past";
  const code = cupCode(cup.name);
  const href = isPast ? `/palmares?edition=${cup.id}` : `/cups/${cup.id}`;

  return (
    <div
      className="card card-hover"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 18,
        padding: 18,
      }}
    >
      {/* ── Header ───────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 10,
            border: "1px solid var(--line-strong)",
            display: "grid",
            placeItems: "center",
            fontFamily: "var(--mono)",
            fontSize: 18,
            letterSpacing: ".02em",
            background: "var(--bg)",
            flexShrink: 0,
            color: isPast ? "var(--fg-3)" : "var(--fg)",
          }}
        >
          {code}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            className="mono"
            style={{
              fontSize: 15,
              fontWeight: 500,
              color: isPast ? "var(--fg-2)" : "var(--fg)",
              lineHeight: 1.25,
              wordBreak: "break-word",
            }}
          >
            {cup.name}
          </div>
        </div>
        <Pill
          variant={pill.accent ? "accent" : "default"}
          dot={pill.dot}
        >
          {pill.label}
        </Pill>
      </div>

      {/* ── 2×3 Instrument Grid ──────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 1,
          background: "var(--line)",
          border: "1px solid var(--line)",
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        <GridCell label="Ouverture" value={formatDateShort(cup.registrationOpenAt)} />
        <GridCell label="Clôture" value={formatDateShort(cup.registrationCloseAt)} />
        <GridCell label="Notation" value={formatDateShort(cup.ratingEndAt)} />
        <GridCell label="Résultats" value={resultsCellValue(cup)} />
        <GridCell label="Type" value={cup.type.toUpperCase()} />
        <GridCell label="Catégories" value={pad2(categoryCount)} />
      </div>

      {/* ── Footer ───────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 14,
          marginTop: "auto",
          paddingTop: 4,
          flexWrap: "wrap",
        }}
      >
        {countdown ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div
              className="mono"
              style={{
                fontSize: 9.5,
                letterSpacing: ".15em",
                color: "var(--fg-3)",
                textTransform: "uppercase",
              }}
            >
              {countdown.label}
            </div>
            <Countdown target={countdown.ts} compact />
          </div>
        ) : (
          <div
            className="mono"
            style={{
              fontSize: 10,
              letterSpacing: ".12em",
              color: "var(--fg-3)",
              textTransform: "uppercase",
            }}
          >
            {isPast ? "Édition archivée" : "Phase en cours"}
          </div>
        )}
        <Link
          href={href}
          className="btn ghost"
          style={{ fontSize: 12 }}
        >
          {isPast ? "Palmarès" : "Voir"} <span className="btn-arrow">→</span>
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function CupsPage() {
  const cups = await getPublicCups();
  const categoryCounts = await getCategoryCounts(cups.map((c) => c.id));

  const activeCups = cups.filter((c) => c.status !== "completed");
  const pastCups = cups.filter((c) => c.status === "completed");
  const hasOpenCup = cups.some((c) => c.status === "published");

  // ── Empty state ────────────────────────────────────────────────────────────
  if (cups.length === 0) {
    return (
      <div className="page-enter">
        <section style={{ paddingTop: 40, paddingBottom: 32 }}>
          <Eyebrow idx={2}>Toutes les éditions</Eyebrow>
          <h1 className="display" style={{ marginTop: 18, marginBottom: 8 }}>
            Cups<em>.</em>
          </h1>
        </section>
        <div className="card">
          <Eyebrow>Aucune édition publiée</Eyebrow>
          <p className="lede" style={{ marginTop: 12 }}>
            La prochaine édition sera annoncée prochainement.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-enter">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <section style={{ paddingTop: 40, paddingBottom: 32 }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 24,
          }}
        >
          <div>
            <Eyebrow idx={2}>Toutes les éditions</Eyebrow>
            <h1
              className="display"
              style={{ marginTop: 18, marginBottom: 8 }}
            >
              Cups<em>.</em>
            </h1>
            <p className="lede" style={{ maxWidth: "52ch" }}>
              Toutes les éditions de la Platinum CBD Cup — concours d'évaluation
              aveugle par un panel indépendant de jurés certifiés.
            </p>
          </div>
          <div>
            <Pill variant={hasOpenCup ? "accent" : "default"} dot={hasOpenCup}>
              {hasOpenCup ? "OPEN FOR SUBMISSIONS" : "ARCHIVE"}
            </Pill>
          </div>
        </div>
      </section>

      {/* ── Active cups grid ───────────────────────────────────────────────── */}
      {activeCups.length > 0 && (
        <section style={{ marginBottom: 48 }}>
          <div className={`grid ${activeCups.length === 1 ? "g-2" : "g-3"}`}>
            {activeCups.map((cup) => (
              <InstrumentCard
                key={cup.id}
                cup={cup}
                categoryCount={categoryCounts.get(cup.id) ?? 0}
                variant="active"
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Past editions ──────────────────────────────────────────────────── */}
      {pastCups.length > 0 && (
        <section>
          <div className="eyebrow" style={{ marginBottom: 24 }}>
            Éditions passées · {pad2(pastCups.length)}
          </div>
          <div className="grid g-3">
            {pastCups.map((cup) => (
              <InstrumentCard
                key={cup.id}
                cup={cup}
                categoryCount={categoryCounts.get(cup.id) ?? 0}
                variant="past"
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
