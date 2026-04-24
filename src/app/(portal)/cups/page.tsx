import Link from "next/link";
import { db } from "~/server/db";
import { Eyebrow, Pill, Countdown } from "~/components/portal/platinum";

// ---------------------------------------------------------------------------
// DB query
// ---------------------------------------------------------------------------

async function getPublicCups() {
  return db.query.cups.findMany({
    where: (c, { ne }) => ne(c.status, "draft"),
    orderBy: (c, { desc }) => [desc(c.createdAt)],
  });
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

/** Derive 2-letter badge from cup name (first letters of first two words). */
function cupCode(name: string): string {
  const words = name.trim().split(/\s+/);
  const a = words[0]?.[0] ?? "C";
  const b = words[1]?.[0] ?? words[0]?.[1] ?? "P";
  return (a + b).toUpperCase();
}

function getStatusPill(status: string): { label: string; accent: boolean; dot: boolean } {
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
      return { label: status.toUpperCase(), accent: false, dot: false };
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function CupsPage() {
  const cups = await getPublicCups();

  const activeCups = cups.filter(
    (c) => c.status !== "completed"
  );
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
              Toutes les éditions du Platinum CBD Cup — concours d'évaluation
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
            {activeCups.map((cup) => {
              const pill = getStatusPill(cup.status);
              const closeTs = cup.registrationCloseAt
                ? new Date(cup.registrationCloseAt).getTime()
                : null;
              const showCountdown =
                closeTs !== null && closeTs > Date.now() && cup.status === "published";

              return (
                <div key={cup.id} className="card card-hover">
                  {/* Code badge + status */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      marginBottom: 20,
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
                      }}
                    >
                      {cupCode(cup.name)}
                    </div>
                    <Pill variant={pill.accent ? "accent" : "default"} dot={pill.dot}>
                      {pill.label}
                    </Pill>
                  </div>

                  {/* Name */}
                  <div
                    className="mono"
                    style={{ fontSize: 20, fontWeight: 500, marginBottom: 8 }}
                  >
                    {cup.name}
                  </div>

                  {/* Date range */}
                  <div
                    className="mono fg3"
                    style={{
                      fontSize: 11,
                      letterSpacing: ".1em",
                      textTransform: "uppercase",
                      marginBottom: 20,
                    }}
                  >
                    {formatDateShort(cup.registrationOpenAt)} →{" "}
                    {formatDateShort(cup.registrationCloseAt)}
                    {cup.eventDate && (
                      <> · Événement {formatDateShort(cup.eventDate)}</>
                    )}
                  </div>

                  {/* Countdown if inscriptions open */}
                  {showCountdown && closeTs && (
                    <div
                      style={{
                        padding: "14px 0",
                        borderTop: "1px solid var(--line)",
                        borderBottom: "1px solid var(--line)",
                        marginBottom: 20,
                      }}
                    >
                      <div
                        className="mono"
                        style={{
                          fontSize: 10,
                          letterSpacing: ".12em",
                          color: "var(--fg-3)",
                          textTransform: "uppercase",
                          marginBottom: 8,
                        }}
                      >
                        Clôture des inscriptions dans
                      </div>
                      <Countdown target={closeTs} compact />
                    </div>
                  )}

                  {/* CTA */}
                  <div style={{ marginTop: "auto" }}>
                    <Link
                      href={`/cups/${cup.id}`}
                      className="btn ghost"
                    >
                      Voir <span className="btn-arrow">→</span>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Past editions ──────────────────────────────────────────────────── */}
      {pastCups.length > 0 && (
        <section>
          <div
            className="eyebrow"
            style={{ marginBottom: 24 }}
          >
            Éditions passées · {String(pastCups.length).padStart(2, "0")}
          </div>
          <div className="grid g-3">
            {pastCups.map((cup) => (
              <div key={cup.id} className="card">
                {/* Code badge + done label */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    marginBottom: 20,
                  }}
                >
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 8,
                      border: "1px solid var(--line)",
                      display: "grid",
                      placeItems: "center",
                      fontFamily: "var(--mono)",
                      fontSize: 15,
                      letterSpacing: ".02em",
                      background: "var(--bg)",
                      flexShrink: 0,
                      color: "var(--fg-3)",
                    }}
                  >
                    {cupCode(cup.name)}
                  </div>
                  <span
                    className="mono fg3"
                    style={{ fontSize: 10, letterSpacing: ".1em" }}
                  >
                    DONE
                  </span>
                </div>

                {/* Name */}
                <div
                  className="mono"
                  style={{
                    fontSize: 16,
                    fontWeight: 500,
                    marginBottom: 6,
                    color: "var(--fg-2)",
                  }}
                >
                  {cup.name}
                </div>

                {/* Date range */}
                <div
                  className="mono fg3"
                  style={{
                    fontSize: 11,
                    letterSpacing: ".1em",
                    textTransform: "uppercase",
                    marginBottom: 20,
                  }}
                >
                  {formatDateShort(cup.registrationOpenAt)} →{" "}
                  {formatDateShort(cup.eventDate ?? cup.registrationCloseAt)}
                </div>

                {/* CTA */}
                <Link
                  href={`/palmares?edition=${cup.id}`}
                  className="btn ghost"
                  style={{ fontSize: 11 }}
                >
                  Palmarès <span className="btn-arrow">→</span>
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
