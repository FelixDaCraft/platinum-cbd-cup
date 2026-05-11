"use client";

import { useState } from "react";
import { Field, Check } from "~/components/portal/platinum";

interface ContactFormProps {
  defaultEmail?: string;
}

export function ContactForm({ defaultEmail }: ContactFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [accept, setAccept] = useState(false);
  const [status, setStatus] = useState<"idle" | "submitting" | "ok" | "error">(
    "idle",
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!accept || !name || !email || !message) return;
    setStatus("submitting");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, subject, message }),
      });
      if (!res.ok) throw new Error("Server error");
      setStatus("ok");
      setName("");
      setEmail("");
      setSubject("");
      setMessage("");
      setAccept(false);
    } catch {
      setStatus("error");
    }
  }

  if (status === "ok") {
    return (
      <div className="card" style={{ textAlign: "center", padding: 48 }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            margin: "0 auto",
            border: "1px solid var(--accent)",
            display: "grid",
            placeItems: "center",
            background: "var(--accent-dim)",
            color: "var(--accent)",
            fontSize: 24,
          }}
        >
          ✓
        </div>
        <div
          className="mono"
          style={{
            fontSize: 11,
            letterSpacing: ".15em",
            color: "var(--fg-3)",
            marginTop: 20,
            textTransform: "uppercase",
          }}
        >
          Message envoyé
        </div>
        <p
          style={{
            color: "var(--fg-2)",
            fontSize: 14,
            lineHeight: 1.55,
            marginTop: 12,
            maxWidth: 360,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          Merci. Nous revenons vers vous sous 48h ouvrées.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="card"
      style={{ display: "flex", flexDirection: "column", gap: 18 }}
    >
      <Field
        label="Nom *"
        placeholder="Yann Maillot"
        value={name}
        onChange={setName}
        required
      />
      <Field
        label="Email *"
        placeholder="you@studio.eu"
        value={email}
        onChange={setEmail}
        type="email"
        required
      />
      <Field
        label="Sujet"
        placeholder="Inscription, presse, partenariat…"
        value={subject}
        onChange={setSubject}
      />
      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span
          className="mono"
          style={{
            fontSize: 10.5,
            letterSpacing: ".1em",
            color: "var(--fg-3)",
            textTransform: "uppercase",
          }}
        >
          Message *
        </span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={6}
          required
          aria-required="true"
          placeholder="Votre message…"
          style={{
            appearance: "none",
            width: "100%",
            padding: 14,
            background: "var(--bg)",
            border: "1px solid var(--line-strong)",
            borderRadius: 10,
            color: "var(--fg)",
            fontFamily: "var(--sans)",
            fontSize: 14,
            outline: "none",
            resize: "vertical",
          }}
        />
      </label>

      <label
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
          cursor: "pointer",
        }}
      >
        <Check on={accept} onClick={() => setAccept(!accept)} />
        <span
          style={{ fontSize: 12.5, color: "var(--fg-2)", lineHeight: 1.5 }}
        >
          J&apos;accepte que mes données soient traitées pour répondre à mon
          message (RGPD).
        </span>
      </label>

      {status === "error" && (
        <div
          className="mono"
          style={{ fontSize: 12, color: "var(--danger)" }}
        >
          Une erreur est survenue. Réessayez ou écrivez-nous directement.
        </div>
      )}

      <div>
        <button
          type="submit"
          className="btn accent"
          disabled={status === "submitting" || !accept || !name || !email || !message}
          style={{
            opacity:
              status === "submitting" || !accept || !name || !email || !message
                ? 0.5
                : 1,
          }}
        >
          {status === "submitting" ? "Envoi…" : "Envoyer"}{" "}
          <span className="btn-arrow">→</span>
        </button>
      </div>
    </form>
  );
}
