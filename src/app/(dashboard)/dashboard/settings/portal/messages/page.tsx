"use client";

import { MessagesInbox } from "~/components/features/portal/messages-inbox";

const titleStyle: React.CSSProperties = {
  fontFamily: "'Doto', 'Space Mono', monospace",
  fontSize: "20px",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  fontWeight: 700,
  color: "var(--n-text-display)",
};

export default function MessagesPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 style={titleStyle}>Messages</h1>
        <p className="n-label" style={{ marginTop: 4, color: "var(--n-text-secondary)" }}>
          BOÎTE DE RÉCEPTION DU FORMULAIRE DE CONTACT PUBLIC
        </p>
      </div>
      <MessagesInbox />
    </div>
  );
}
