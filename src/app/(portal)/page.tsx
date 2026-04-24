import Link from "next/link";
import { db } from "~/server/db";
import { desc, isNotNull, eq, count } from "drizzle-orm";
import * as schema from "~/server/db/schema";
import {
  Eyebrow,
  Countdown,
  Ticker,
  PlatinumTrophy,
} from "~/components/portal/platinum";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function categoryCode(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 2);
}

// ---------------------------------------------------------------------------
// Data fetchers
// ---------------------------------------------------------------------------

async function getCountdownTarget(): Promise<number> {
  const fallback = Date.now() + 47 * 86400000 + 6 * 3600000;

  try {
    const cup = await db.query.cups.findFirst({
      where: (c, { and, ne: neOp, isNotNull: nn, gt }) =>
        and(
          neOp(c.status, "draft"),
          nn(c.registrationCloseAt),
          gt(c.registrationCloseAt, new Date())
        ),
      orderBy: (c, { asc }) => [asc(c.registrationCloseAt)],
      columns: { registrationCloseAt: true },
    });

    if (cup?.registrationCloseAt) {
      return cup.registrationCloseAt.getTime();
    }
  } catch {
    // DB unavailable — use fallback
  }

  return fallback;
}

async function getTickerItems(): Promise<string[]> {
  const mockItems = [
    "CF23 · FLOWER INDOOR · 94.2",
    "EPA87 · EXTRACT · 91.8",
    "HAS14 · HASHISH · 89.4",
    "CBG09 · ISOLATE · 87.1",
    "OIL41 · FULL-SPECTRUM · 92.6",
    "TOP19 · TOPICAL · 85.9",
  ];

  try {
    const products = await db
      .select({
        anonymousCode: schema.products.anonymousCode,
        finalScore: schema.products.finalScore,
        categoryName: schema.categories.name,
      })
      .from(schema.products)
      .innerJoin(
        schema.categories,
        eq(schema.products.categoryId, schema.categories.id)
      )
      .where(isNotNull(schema.products.finalScore))
      .orderBy(desc(schema.products.updatedAt))
      .limit(6);

    if (products.length > 0) {
      return products.map(
        (p) =>
          `${p.anonymousCode ?? "—"} · ${p.categoryName.toUpperCase()} · ${Number(p.finalScore).toFixed(1)}`
      );
    }
  } catch {
    // DB unavailable — use mock
  }

  return mockItems;
}

interface CategoryRow {
  code: string;
  name: string;
  specimenCount: number;
}

const mockCategories: CategoryRow[] = [
  { code: "CF", name: "Flower · Indoor", specimenCount: 42 },
  { code: "OG", name: "Flower · Outdoor", specimenCount: 31 },
  { code: "HA", name: "Hashish", specimenCount: 24 },
  { code: "EP", name: "Extract · Rosin", specimenCount: 28 },
  { code: "OI", name: "Full-spectrum Oil", specimenCount: 38 },
  { code: "TO", name: "Topical", specimenCount: 21 },
];

async function getCategories(): Promise<CategoryRow[]> {
  try {
    const cup = await db.query.cups.findFirst({
      where: (c, { ne: neOp }) => neOp(c.status, "draft"),
      orderBy: (c, { desc: dsc }) => [dsc(c.createdAt)],
      with: {
        categories: {
          orderBy: (cat, { asc }) => [asc(cat.sortOrder)],
        },
      },
    });

    if (!cup || cup.categories.length === 0) return mockCategories;

    // Count products per category, joined through registrations to scope to this cup
    const counts = await db
      .select({
        categoryId: schema.products.categoryId,
        total: count(),
      })
      .from(schema.products)
      .innerJoin(
        schema.registrations,
        eq(schema.products.registrationId, schema.registrations.id)
      )
      .where(eq(schema.registrations.cupId, cup.id))
      .groupBy(schema.products.categoryId);

    const countMap = new Map(counts.map((r) => [r.categoryId, r.total]));

    return cup.categories.map((c) => ({
      code: categoryCode(c.name),
      name: c.name,
      specimenCount: countMap.get(c.id) ?? 0,
    }));
  } catch {
    return mockCategories;
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function PortalHomePage() {
  const [target, tickerItems, categories] = await Promise.all([
    getCountdownTarget(),
    getTickerItems(),
    getCategories(),
  ]);

  return (
    <div className="page-enter">
      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section style={{ paddingTop: 40, paddingBottom: 60, position: "relative" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.1fr .9fr",
            gap: 40,
            alignItems: "center",
          }}
          className="hero-grid"
        >
          <div>
            <Eyebrow idx={1}>Edition 03 · Inscriptions ouvertes</Eyebrow>
            <h1
              className="display"
              style={{ marginTop: 20, marginBottom: 24 }}
            >
              Platinum
              <br />
              <em>CBD Cup</em>
              <br />
              2026.
            </h1>
            <div
              className="mono"
              style={{
                fontSize: 11,
                letterSpacing: ".18em",
                color: "var(--fg-3)",
                textTransform: "uppercase",
                marginTop: -8,
                marginBottom: 22,
              }}
            >
              · Europe · Independent · Blind ·
            </div>
            <p className="lede">
              La seule compétition européenne de CBD évaluée à l'aveugle par un
              panel indépendant d'analystes, de sommeliers et de laboratoires
              certifiés. Six catégories. Quarante-deux jurés. Zéro marketing.
            </p>
            <div
              style={{
                display: "flex",
                gap: 12,
                marginTop: 36,
                flexWrap: "wrap",
              }}
            >
              <Link href="/cups" className="btn accent">
                Inscrire un spécimen <span className="btn-arrow">→</span>
              </Link>
              <Link href="/cups" className="btn ghost">
                Voir l'édition en cours
              </Link>
            </div>
          </div>

          <div style={{ display: "grid", placeItems: "center" }}>
            <PlatinumTrophy size={420} />
          </div>
        </div>
      </section>

      {/* ── COUNTDOWN ────────────────────────────────────────────────────── */}
      <section className="card" style={{ marginBottom: 24 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            flexWrap: "wrap",
            gap: 20,
          }}
        >
          <div>
            <Eyebrow>Clôture des inscriptions</Eyebrow>
            <div style={{ marginTop: 14 }}>
              <Countdown target={target} />
            </div>
          </div>
          <div
            style={{
              textAlign: "right",
              fontFamily: "var(--mono)",
              fontSize: 11,
              color: "var(--fg-3)",
              letterSpacing: ".1em",
            }}
          >
            <div>
              STATUS · <span style={{ color: "var(--accent)" }}>OPEN</span>
            </div>
            <div style={{ marginTop: 6 }}>SPECIMENS · 184 / 240</div>
            <div style={{ marginTop: 6 }}>CAT · 06</div>
          </div>
        </div>
      </section>

      {/* ── TICKER ───────────────────────────────────────────────────────── */}
      <Ticker items={tickerItems} />

      {/* ── THREE-UP ─────────────────────────────────────────────────────── */}
      <section style={{ marginTop: 64 }}>
        <h2 className="section-title">Ce qui se passe ici</h2>
        <div className="grid g-3" style={{ marginTop: 32 }}>
          {(
            [
              {
                i: "01",
                t: "Blind panel",
                d: "Chaque spécimen reçoit un code anonyme à 5 caractères. Les jurés ne voient jamais les marques, les origines, ni les prix.",
              },
              {
                i: "02",
                t: "Lab-backed",
                d: "Cannabinoïdes, terpènes et contaminants sont vérifiés par trois laboratoires indépendants accrédités ISO 17025.",
              },
              {
                i: "03",
                t: "Public ledger",
                d: "Les scores, coefficients et méthodologies sont publiés intégralement. Tout est vérifiable. Rien n'est caché.",
              },
            ] as const
          ).map((x) => (
            <div key={x.i} className="card card-hover">
              <div
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 10,
                  color: "var(--accent)",
                  letterSpacing: ".15em",
                }}
              >
                · {x.i}
              </div>
              <div
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 22,
                  marginTop: 18,
                  letterSpacing: "-.01em",
                }}
              >
                {x.t}
              </div>
              <p
                style={{
                  color: "var(--fg-2)",
                  fontSize: 14,
                  lineHeight: 1.5,
                  marginTop: 12,
                }}
              >
                {x.d}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CATEGORIES ───────────────────────────────────────────────────── */}
      <section style={{ marginTop: 64 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 24,
          }}
        >
          <h2 className="section-title">
            Catégories · {String(categories.length).padStart(2, "0")}
          </h2>
          <span className="eyebrow">Edition 2026</span>
        </div>
        <div className="grid g-3">
          {categories.map((cat) => (
            <div
              key={cat.code + cat.name}
              className="card card-hover"
              style={{ display: "flex", alignItems: "center", gap: 18 }}
            >
              <div
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: 12,
                  border: "1px solid var(--line-strong)",
                  display: "grid",
                  placeItems: "center",
                  fontFamily: "var(--mono)",
                  fontSize: 18,
                  color: "var(--fg)",
                  letterSpacing: ".02em",
                  flexShrink: 0,
                  background: "var(--bg)",
                }}
              >
                {cat.code}
              </div>
              <div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 15 }}>
                  {cat.name}
                </div>
                <div
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 11,
                    color: "var(--fg-3)",
                    letterSpacing: ".1em",
                    marginTop: 4,
                  }}
                >
                  {cat.specimenCount > 0
                    ? `${cat.specimenCount} SPECIMENS`
                    : "—"}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── PRESS / LABS ─────────────────────────────────────────────────── */}
      <section style={{ marginTop: 64, marginBottom: 64 }}>
        <div
          className="card"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            alignItems: "center",
            gap: 28,
          }}
        >
          <div>
            <Eyebrow>Press · Labs · Partners</Eyebrow>
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: 22,
                marginTop: 12,
                lineHeight: 1.3,
              }}
            >
              Vérifié par 3 laboratoires ISO 17025.
              <br />
              Couvert par 14 titres de presse indépendants.
            </div>
          </div>
          <Link href="/palmares" className="btn ghost">
            Palmarès 2025 →
          </Link>
        </div>
      </section>

      {/* ── RESPONSIVE GRID FIX ──────────────────────────────────────────── */}
      <style>{`
        @media (max-width: 880px) {
          .hero-grid {
            grid-template-columns: 1fr !important;
          }
          .hero-grid > div:last-child {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
