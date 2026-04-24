"use client";

import Link from "next/link";
import { api } from "~/trpc/react";
import { format, formatDistanceToNow, isAfter } from "date-fns";
import { fr } from "date-fns/locale";

interface UpcomingEvent {
  date: Date;
  label: string;
  type: "registration_open" | "registration_close" | "rating_start" | "rating_end";
  cupId: string;
  cupName: string;
}

const eventTypeLabels: Record<string, string> = {
  registration_open: "OUVERTURE",
  registration_close: "CLÔTURE",
  rating_start: "DÉBUT NOTATION",
  rating_end: "FIN NOTATION",
};

const eventTypeColors: Record<string, string> = {
  registration_open: "var(--n-success)",
  registration_close: "var(--n-warning)",
  rating_start: "var(--n-interactive)",
  rating_end: "var(--n-text-secondary)",
};

interface EventItemProps {
  event: UpcomingEvent;
}

function EventItem({ event }: EventItemProps) {
  const typeLabel = eventTypeLabels[event.type] ?? event.type.toUpperCase();
  const typeColor = eventTypeColors[event.type] ?? "var(--n-text-disabled)";

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const tomorrowStr = format(new Date(Date.now() + 86400000), "yyyy-MM-dd");
  const eventStr = format(event.date, "yyyy-MM-dd");

  const isToday = eventStr === todayStr;
  const isTomorrow = eventStr === tomorrowStr;

  return (
    <Link
      href={`/dashboard/cups/${event.cupId}`}
      style={{ textDecoration: "none" }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0",
          padding: "12px 0",
          borderBottom: "1px solid var(--n-border)",
          cursor: "pointer",
          transition: "opacity 0.1s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.opacity = "0.75";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.opacity = "1";
        }}
      >
        {/* Date block */}
        <div
          style={{
            width: "52px",
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "2px",
          }}
        >
          <span
            className="n-font-data"
            style={{
              fontSize: "24px",
              color: isToday ? "var(--n-accent)" : "var(--n-text-display)",
              lineHeight: 1,
            }}
          >
            {format(event.date, "d")}
          </span>
          <span
            className="n-label"
            style={{
              color: isToday ? "var(--n-accent)" : "var(--n-text-disabled)",
            }}
          >
            {format(event.date, "MMM", { locale: fr }).toUpperCase()}
          </span>
        </div>

        {/* Divider */}
        <div
          style={{
            width: "1px",
            height: "36px",
            background: "var(--n-border-visible)",
            flexShrink: 0,
            marginRight: "16px",
          }}
        />

        {/* Event info */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "3px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              className="n-label"
              style={{ color: typeColor, flexShrink: 0 }}
            >
              {typeLabel}
            </span>
            {isToday && (
              <span
                className="n-label"
                style={{
                  color: "var(--n-accent)",
                  border: "1px solid var(--n-accent)",
                  borderRadius: "3px",
                  padding: "0 4px",
                }}
              >
                AUJOURD&apos;HUI
              </span>
            )}
            {isTomorrow && (
              <span
                className="n-label"
                style={{
                  color: "var(--n-warning)",
                  border: "1px solid var(--n-warning)",
                  borderRadius: "3px",
                  padding: "0 4px",
                }}
              >
                DEMAIN
              </span>
            )}
          </div>
          <span
            className="n-font-body"
            style={{
              fontSize: "13px",
              color: "var(--n-text-secondary)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {event.cupName}
          </span>
        </div>

        {/* Time + arrow */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            flexShrink: 0,
          }}
        >
          <span
            className="n-font-data"
            style={{ fontSize: "12px", color: "var(--n-text-disabled)" }}
          >
            {format(event.date, "HH:mm")}
          </span>
          <span
            className="n-font-data"
            style={{ fontSize: "13px", color: "var(--n-text-disabled)" }}
          >
            &gt;
          </span>
        </div>
      </div>
    </Link>
  );
}

export function UpcomingEvents() {
  const { data, isLoading } = api.cup.getOverviewStats.useQuery();

  if (isLoading) {
    return (
      <div className="n-card" style={{ padding: "24px" }}>
        <p
          className="n-label"
          style={{ color: "var(--n-text-disabled)", marginBottom: "20px" }}
        >
          PROCHAINS ÉVÉNEMENTS
        </p>
        <p className="n-label" style={{ color: "var(--n-text-disabled)" }}>
          [LOADING...]
        </p>
      </div>
    );
  }

  // Collect all upcoming events from all cups
  const now = new Date();
  const events: UpcomingEvent[] = [];

  data?.cups?.forEach((cup) => {
    if (
      cup.registrationOpenAt &&
      isAfter(new Date(cup.registrationOpenAt), now)
    ) {
      events.push({
        date: new Date(cup.registrationOpenAt),
        label: "Ouverture des inscriptions",
        type: "registration_open",
        cupId: cup.id,
        cupName: cup.name,
      });
    }
    if (
      cup.registrationCloseAt &&
      isAfter(new Date(cup.registrationCloseAt), now)
    ) {
      events.push({
        date: new Date(cup.registrationCloseAt),
        label: "Fermeture des inscriptions",
        type: "registration_close",
        cupId: cup.id,
        cupName: cup.name,
      });
    }
    if (cup.ratingStartAt && isAfter(new Date(cup.ratingStartAt), now)) {
      events.push({
        date: new Date(cup.ratingStartAt),
        label: "Début de la notation",
        type: "rating_start",
        cupId: cup.id,
        cupName: cup.name,
      });
    }
    if (cup.ratingEndAt && isAfter(new Date(cup.ratingEndAt), now)) {
      events.push({
        date: new Date(cup.ratingEndAt),
        label: "Fin de la notation",
        type: "rating_end",
        cupId: cup.id,
        cupName: cup.name,
      });
    }
  });

  // Sort by date, take next 5
  events.sort((a, b) => a.date.getTime() - b.date.getTime());
  const upcomingEvents = events.slice(0, 5);

  if (!upcomingEvents.length) {
    return (
      <div className="n-card" style={{ padding: "24px" }}>
        <p
          className="n-label"
          style={{ color: "var(--n-text-disabled)", marginBottom: "20px" }}
        >
          PROCHAINS ÉVÉNEMENTS
        </p>
        <p
          className="n-font-body"
          style={{
            fontSize: "13px",
            color: "var(--n-text-disabled)",
            paddingTop: "16px",
            paddingBottom: "16px",
          }}
        >
          Aucun événement à venir. Configurez les dates de vos cups pour voir les
          événements ici.
        </p>
      </div>
    );
  }

  return (
    <div className="n-card" style={{ padding: "24px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: "4px",
        }}
      >
        <p className="n-label" style={{ color: "var(--n-text-disabled)", margin: 0 }}>
          PROCHAINS ÉVÉNEMENTS
        </p>
        <span
          className="n-font-data"
          style={{
            fontSize: "11px",
            color: "var(--n-text-disabled)",
            border: "1px solid var(--n-border-visible)",
            borderRadius: "3px",
            padding: "1px 6px",
          }}
        >
          {upcomingEvents.length}
        </span>
      </div>

      <div>
        {upcomingEvents.map((event) => (
          <EventItem key={`${event.cupId}-${event.type}`} event={event} />
        ))}
      </div>
    </div>
  );
}
