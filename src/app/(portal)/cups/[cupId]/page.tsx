import { notFound } from "next/navigation";
import Link from "next/link";
import { eq, count } from "drizzle-orm";
import { db } from "~/server/db";
import * as schema from "~/server/db/schema";
import { Eyebrow, Pill } from "~/components/portal/platinum";
import { CupStatsBar } from "./_components/cup-stats-bar";
import { CupTabs } from "./_components/cup-tabs";

// ---------------------------------------------------------------------------
// Page params
// ---------------------------------------------------------------------------

interface PageProps {
  params: Promise<{ cupId: string }>;
}

// ---------------------------------------------------------------------------
// DB queries
// ---------------------------------------------------------------------------

async function getCupWithDetails(cupId: string) {
  return db.query.cups.findFirst({
    where: eq(schema.cups.id, cupId),
    with: {
      categories: {
        with: {
          criteria: {
            orderBy: (c, { asc }) => [asc(c.sortOrder)],
          },
        },
        orderBy: (c, { asc }) => [asc(c.sortOrder)],
      },
    },
  });
}

async function getCupStats(cupId: string) {
  const [productCountResult, juryCountResult] = await Promise.all([
    // Count products via registrations for this cup
    db
      .select({ value: count() })
      .from(schema.products)
      .innerJoin(
        schema.registrations,
        eq(schema.products.registrationId, schema.registrations.id)
      )
      .where(eq(schema.registrations.cupId, cupId)),

    // Count active cup juries
    db
      .select({ value: count() })
      .from(schema.cupJuries)
      .where(
        eq(schema.cupJuries.cupId, cupId)
      ),
  ]);

  return {
    productCount: productCountResult[0]?.value ?? 0,
    juryCount: juryCountResult[0]?.value ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateShort(date: Date | null): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

function formatDateDot(date: Date | null): string {
  if (!date) return "—";
  const d = new Date(date);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(2);
  return `${dd}.${mm}.${yy}`;
}

/** Extract edition number from cup name (e.g. "Edition 03" → "03") */
function extractEditionNumber(name: string): string | null {
  const m = name.match(/(\d{2,})/);
  return m ? m[1]! : null;
}

/** Derive 2-letter category code from name */
function categoryCode(name: string): string {
  const words = name.trim().split(/\s+/);
  const a = words[0]?.[0] ?? "C";
  const b = words[1]?.[0] ?? words[0]?.[1] ?? "A";
  return (a + b).toUpperCase();
}

/** Format price in cents to display string */
function formatFee(cents: number | null | undefined): string {
  if (!cents) return "€180";
  return `€${Math.round(cents / 100)}`;
}

type TimelineStatus = "past" | "current" | "next" | "final";

function buildTimeline(cup: {
  registrationOpenAt: Date | null;
  registrationCloseAt: Date | null;
  ratingStartAt: Date | null;
  ratingEndAt: Date | null;
  eventDate: Date | null;
}): { date: string; label: string; status: TimelineStatus }[] {
  const now = Date.now();

  const events: {
    date: Date | null;
    label: string;
    isFinal?: boolean;
  }[] = [
    { date: cup.registrationOpenAt, label: "Ouverture des inscriptions" },
    { date: cup.registrationCloseAt, label: "Clôture des inscriptions" },
    { date: cup.ratingStartAt, label: "Réception des spécimens" },
    { date: cup.ratingEndAt, label: "Notation aveugle — Panel" },
    { date: cup.eventDate, label: "Cérémonie · Palmarès public", isFinal: true },
  ].filter((e) => e.date !== null);

  // Find the "current" event: first future event
  let currentIdx = -1;
  for (let i = 0; i < events.length; i++) {
    const ts = events[i]!.date!.getTime();
    if (ts > now) {
      currentIdx = i;
      break;
    }
  }

  return events.map((e, i) => {
    const ts = e.date!.getTime();
    let status: TimelineStatus;
    if (e.isFinal) {
      status = "final";
    } else if (i === currentIdx) {
      status = "current";
    } else if (ts <= now) {
      status = "past";
    } else {
      status = "next";
    }

    return {
      date: formatDateDot(e.date),
      label: e.label,
      status,
    };
  });
}

function getStatusInfo(status: string): {
  label: string;
  accent: boolean;
  dot: boolean;
} {
  switch (status) {
    case "published":
      return { label: "OPEN FOR SUBMISSIONS", accent: true, dot: true };
    case "registration_closed":
      return { label: "CLÔTURE DES INSCRIPTIONS", accent: false, dot: false };
    case "rating":
      return { label: "NOTATION EN COURS", accent: true, dot: true };
    case "completed":
      return { label: "TERMINÉE", accent: false, dot: false };
    default:
      return { label: status.toUpperCase(), accent: false, dot: false };
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function CupDetailPage({ params }: PageProps) {
  const { cupId } = await params;

  const [cup, stats] = await Promise.all([
    getCupWithDetails(cupId),
    getCupStats(cupId),
  ]);

  if (!cup) notFound();

  // Edition label: try to extract from name, else use "—"
  const editionNum = extractEditionNumber(cup.name);
  const year = cup.eventDate
    ? new Date(cup.eventDate).getFullYear()
    : new Date().getFullYear();

  const editionLabel = editionNum
    ? `${editionNum}/${String(year).slice(2)}`
    : cup.name;

  const statusInfo = getStatusInfo(cup.status);
  const isOpen = cup.status === "published";

  // Build timeline rows
  const timeline = buildTimeline(cup);

  // Build category rows for the tabs component
  const categoryRows = cup.categories.map((cat) => ({
    code: categoryCode(cat.name),
    name: cat.name,
    fee: formatFee(cat.priceOverride ?? cup.defaultPricePerProduct),
    criteria: cat.criteria.map((cr) => cr.name),
  }));

  // Stats bar — countdown target
  const closeTs = cup.registrationCloseAt
    ? new Date(cup.registrationCloseAt).getTime()
    : null;

  // Location · date range caption
  const locationCaption = [
    cup.eventLocation,
    cup.registrationOpenAt || cup.registrationCloseAt
      ? `${formatDateShort(cup.registrationOpenAt)} → ${formatDateShort(cup.registrationCloseAt)}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

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
            <Eyebrow idx={2}>Édition en cours</Eyebrow>
            <h1
              className="display"
              style={{ marginTop: 18, marginBottom: 8 }}
            >
              {editionNum ? (
                <>
                  Ed<em>.</em>
                  {editionNum}
                  <em> / </em>
                  {year}
                </>
              ) : (
                cup.name
              )}
            </h1>
            {locationCaption && (
              <div
                className="mono"
                style={{
                  fontSize: 12,
                  color: "var(--fg-2)",
                  letterSpacing: ".08em",
                  textTransform: "uppercase",
                }}
              >
                {locationCaption}
              </div>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Pill
              variant={statusInfo.accent ? "accent" : "default"}
              dot={statusInfo.dot}
            >
              {statusInfo.label}
            </Pill>
            {isOpen && (
              <Link
                href={`/cups/${cup.id}/register`}
                className="btn accent"
              >
                S&apos;inscrire <span className="btn-arrow">→</span>
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* ── Stats bar ──────────────────────────────────────────────────────── */}
      <CupStatsBar
        productCount={stats.productCount}
        categoryCount={cup.categories.length}
        juryCount={stats.juryCount}
        registrationCloseAt={closeTs}
      />

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <CupTabs
        cupId={cup.id}
        timeline={timeline}
        categories={categoryRows}
        juryCount={stats.juryCount}
        editionLabel={editionLabel}
      />
    </div>
  );
}
