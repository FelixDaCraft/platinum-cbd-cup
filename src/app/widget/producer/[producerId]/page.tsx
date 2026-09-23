import type { Metadata } from "next";
import { TRPCError } from "@trpc/server";

import { api } from "~/trpc/server";

/**
 * Embeddable producer widget.
 *
 * Rendered inside an iframe on third-party sites, so it deliberately avoids
 * the portal shell and ships its own self-contained styling — nothing here
 * may depend on the host page's CSS. `next.config.js` already serves
 * `/widget/:path*` with `frame-ancestors *`.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Distinctions Platinum CBD Cup",
  robots: { index: false, follow: false },
};

const GOLD = "#d4af37";

const RANK_LABELS: Record<number, string> = {
  1: "1er",
  2: "2e",
  3: "3e",
};

export default async function ProducerWidgetPage({
  params,
  searchParams,
}: {
  params: Promise<{ producerId: string }>;
  searchParams: Promise<{ theme?: string }>;
}) {
  const { producerId } = await params;
  const { theme } = await searchParams;
  const isDark = theme === "dark";

  const palette = isDark
    ? { bg: "#0a0a0f", fg: "#f5f5f4", muted: "#9ca3af", border: "#26262e", card: "#14141b" }
    : { bg: "#ffffff", fg: "#1f2937", muted: "#6b7280", border: "#e5e7eb", card: "#fafafa" };

  let data: Awaited<ReturnType<typeof api.widget.getProducerMedals>>;

  try {
    data = await api.widget.getProducerMedals({ producerId });
  } catch (error) {
    const notFound = error instanceof TRPCError && error.code === "NOT_FOUND";
    return (
      <Frame palette={palette}>
        <p style={{ margin: 0, fontSize: 13, color: palette.muted, textAlign: "center" }}>
          {notFound ? "Producteur introuvable." : "Distinctions indisponibles pour le moment."}
        </p>
      </Frame>
    );
  }

  const { producer, medals, summary } = data;
  const displayName = producer.brandName || producer.companyName;

  return (
    <Frame palette={palette}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          paddingBottom: 12,
          borderBottom: `1px solid ${palette.border}`,
        }}
      >
        {producer.logo && (
          // eslint-disable-next-line @next/next/no-img-element -- third-party logo, no optimizer in an embed
          <img
            src={producer.logo}
            alt=""
            width={32}
            height={32}
            style={{ borderRadius: 6, objectFit: "contain", flexShrink: 0 }}
          />
        )}
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontWeight: 600,
              fontSize: 14,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {displayName}
          </div>
          <div style={{ fontSize: 10, letterSpacing: "0.08em", color: GOLD, textTransform: "uppercase" }}>
            Platinum CBD Cup
          </div>
        </div>
      </div>

      {summary.totalDistinctions === 0 ? (
        <p style={{ margin: "24px 0", fontSize: 13, color: palette.muted, textAlign: "center" }}>
          Aucune distinction publiée pour le moment.
        </p>
      ) : (
        <>
          {/* Summary */}
          <div style={{ display: "flex", gap: 8, padding: "12px 0" }}>
            <Stat value={summary.totalDistinctions} label="Distinctions" palette={palette} />
            <Stat value={summary.totalLabels} label="Médailles" palette={palette} />
            <Stat value={summary.cupsParticipated} label="Éditions" palette={palette} />
          </div>

          {/* Per-cup breakdown */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {medals.map((entry) => (
              <div
                key={entry.cup.id}
                style={{
                  border: `1px solid ${palette.border}`,
                  borderRadius: 8,
                  padding: 10,
                  backgroundColor: palette.card,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                    marginBottom: 6,
                    textTransform: "uppercase",
                    color: palette.muted,
                  }}
                >
                  {entry.cup.name}
                  {entry.cup.year ? ` · ${entry.cup.year}` : ""}
                </div>

                {entry.products.map((product) => (
                  <div
                    key={product.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      padding: "3px 0",
                      fontSize: 12,
                    }}
                  >
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {product.name}
                    </span>
                    <span
                      style={{
                        flexShrink: 0,
                        fontSize: 10,
                        fontWeight: 600,
                        padding: "2px 7px",
                        borderRadius: 999,
                        color: "#0a0a0f",
                        backgroundColor: product.label?.color ?? GOLD,
                      }}
                    >
                      {product.label?.name ??
                        (product.rank ? RANK_LABELS[product.rank] ?? `${product.rank}e` : "—")}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Attribution — also the link back to the competition */}
      <a
        href="https://platinumcbdcup.eu"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "block",
          marginTop: 12,
          paddingTop: 10,
          borderTop: `1px solid ${palette.border}`,
          fontSize: 10,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: palette.muted,
          textDecoration: "none",
          textAlign: "center",
        }}
      >
        Vérifié par Platinum CBD Cup
      </a>
    </Frame>
  );
}

function Frame({
  palette,
  children,
}: {
  palette: { bg: string; fg: string; border: string; muted: string; card: string };
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        boxSizing: "border-box",
        padding: 14,
        backgroundColor: palette.bg,
        color: palette.fg,
        fontFamily:
          "'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif",
      }}
    >
      {children}
    </div>
  );
}

function Stat({
  value,
  label,
  palette,
}: {
  value: number;
  label: string;
  palette: { border: string; muted: string; card: string };
}) {
  return (
    <div
      style={{
        flex: 1,
        textAlign: "center",
        border: `1px solid ${palette.border}`,
        borderRadius: 8,
        padding: "8px 4px",
        backgroundColor: palette.card,
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.1, color: GOLD }}>{value}</div>
      <div
        style={{
          fontSize: 9,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: palette.muted,
        }}
      >
        {label}
      </div>
    </div>
  );
}
