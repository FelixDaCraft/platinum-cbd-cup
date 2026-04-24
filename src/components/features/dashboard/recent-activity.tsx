"use client";

import { api } from "~/trpc/react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

// Action type to label prefix mapping
const actionLabels: Record<string, string> = {
  cup_created: "CUP",
  cup_published: "CUP",
  cup_completed: "CUP",
  registration_created: "INSCRIPTION",
  registration_confirmed: "INSCRIPTION",
  product_created: "PRODUIT",
  product_received: "PRODUIT",
  rating_submitted: "NOTE",
  results_published: "RÉSULTATS",
  results_sent: "RÉSULTATS",
  jury_invited: "JURY",
  jury_joined: "JURY",
};

// Action type to status color
const actionColors: Record<string, string> = {
  cup_created: "var(--n-warning)",
  cup_published: "var(--n-success)",
  cup_completed: "var(--n-text-secondary)",
  registration_created: "var(--n-interactive)",
  registration_confirmed: "var(--n-success)",
  product_created: "var(--n-warning)",
  product_received: "var(--n-success)",
  rating_submitted: "var(--n-warning)",
  results_published: "var(--n-text-secondary)",
  results_sent: "var(--n-interactive)",
  jury_invited: "var(--n-interactive)",
  jury_joined: "var(--n-success)",
};

interface ActivityItemProps {
  activity: {
    id: string;
    action: string;
    description: string;
    createdAt: Date;
    user: {
      id: string;
      name: string | null;
      image: string | null;
    } | null;
  };
}

function ActivityItem({ activity }: ActivityItemProps) {
  const labelColor =
    actionColors[activity.action] ?? "var(--n-text-disabled)";
  const typeLabel =
    actionLabels[activity.action] ?? activity.action.toUpperCase();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        padding: "10px 0",
        borderBottom: "1px solid var(--n-border)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, minWidth: 0 }}>
          <span
            className="n-label"
            style={{ color: labelColor, flexShrink: 0 }}
          >
            {typeLabel}
          </span>
          <span
            className="n-font-body"
            style={{
              fontSize: "13px",
              color: "var(--n-text-primary)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {activity.description}
          </span>
        </div>
        <span
          className="n-label"
          style={{ color: "var(--n-text-disabled)", flexShrink: 0 }}
        >
          {formatDistanceToNow(new Date(activity.createdAt), {
            addSuffix: false,
            locale: fr,
          }).toUpperCase()}
        </span>
      </div>
      {activity.user?.name && (
        <span
          className="n-label"
          style={{ color: "var(--n-text-disabled)" }}
        >
          {activity.user.name.toUpperCase()}
        </span>
      )}
    </div>
  );
}

export function RecentActivity() {
  const { data: activities, isLoading } = api.activity.getRecent.useQuery({
    limit: 10,
  });

  if (isLoading) {
    return (
      <div className="n-card" style={{ padding: "24px" }}>
        <p
          className="n-label"
          style={{ color: "var(--n-text-disabled)", marginBottom: "20px" }}
        >
          ACTIVITÉ RÉCENTE
        </p>
        <p className="n-label" style={{ color: "var(--n-text-disabled)" }}>
          [LOADING...]
        </p>
      </div>
    );
  }

  if (!activities?.length) {
    return (
      <div className="n-card" style={{ padding: "24px" }}>
        <p
          className="n-label"
          style={{ color: "var(--n-text-disabled)", marginBottom: "20px" }}
        >
          ACTIVITÉ RÉCENTE
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
          Les dernières activités de vos cups apparaîtront ici.
        </p>
      </div>
    );
  }

  return (
    <div className="n-card" style={{ padding: "24px" }}>
      <p
        className="n-label"
        style={{ color: "var(--n-text-disabled)", marginBottom: "4px" }}
      >
        ACTIVITÉ RÉCENTE
      </p>
      <div
        style={{
          maxHeight: "480px",
          overflowY: "auto",
        }}
      >
        {activities.map((activity) => (
          <ActivityItem key={activity.id} activity={activity} />
        ))}
      </div>
    </div>
  );
}
