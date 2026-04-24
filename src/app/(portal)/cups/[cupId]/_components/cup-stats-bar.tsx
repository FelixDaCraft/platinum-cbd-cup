"use client";

import { Countdown } from "~/components/portal/platinum";

interface CupStatsBarProps {
  productCount: number;
  categoryCount: number;
  juryCount: number;
  registrationCloseAt: number | null; // ms timestamp or null
}

export function CupStatsBar({
  productCount,
  categoryCount,
  juryCount,
  registrationCloseAt,
}: CupStatsBarProps) {
  const showCountdown =
    registrationCloseAt !== null && registrationCloseAt > Date.now();

  const stats = [
    {
      k: "Spécimens inscrits",
      v: String(productCount).padStart(3, "0"),
      u: "",
    },
    {
      k: "Catégories",
      v: String(categoryCount).padStart(2, "0"),
      u: "",
    },
    {
      k: "Jurés confirmés",
      v: String(juryCount).padStart(2, "0"),
      u: "",
    },
    {
      k: "Clôture dans",
      v: showCountdown && registrationCloseAt ? (
        <Countdown target={registrationCloseAt} compact />
      ) : (
        <span className="mono fg3" style={{ fontSize: 22 }}>
          —
        </span>
      ),
      u: "",
    },
  ];

  return (
    <section className="grid g-4" style={{ marginBottom: 32 }}>
      {stats.map((x, i) => (
        <div key={i} className="card" style={{ padding: 22 }}>
          <div
            className="mono"
            style={{
              fontSize: 10,
              letterSpacing: ".12em",
              color: "var(--fg-3)",
              textTransform: "uppercase",
            }}
          >
            {x.k}
          </div>
          <div
            style={{
              marginTop: 14,
              fontFamily: "var(--mono)",
              fontSize: 36,
              fontWeight: 300,
              letterSpacing: "-0.02em",
              lineHeight: 1,
            }}
          >
            {x.v}{" "}
            {x.u && (
              <span style={{ fontSize: 14, color: "var(--fg-3)" }}>{x.u}</span>
            )}
          </div>
        </div>
      ))}
    </section>
  );
}
