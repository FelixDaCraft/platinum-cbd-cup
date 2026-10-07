"use client";

import { useState } from "react";
import { Field, Check } from "~/components/portal/platinum";
import { api } from "~/trpc/react";

/** Sujets acceptés par contactMessages.submit, dans l'ordre d'affichage. */
const SUBJECTS = [
  { value: "general", label: "Question générale" },
  { value: "registration", label: "Inscription" },
  { value: "results", label: "Résultats" },
  { value: "sponsorship", label: "Partenariat" },
  { value: "press", label: "Presse" },
  { value: "technical", label: "Support technique" },
  { value: "other", label: "Autre" },
] as const;

type Subject = (typeof SUBJECTS)[number]["value"];

interface ContactFormProps {
  defaultEmail?: string;
}

type Errors = Partial<Record<"name" | "email" | "message" | "accept", string>>;

export function ContactForm({ defaultEmail }: ContactFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [subject, setSubject] = useState<Subject>("general");
  const [message, setMessage] = useState("");
  const [accept, setAccept] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  const submit = api.contactMessages.submit.useMutation({
    onSuccess: () => {
      setName("");
      setEmail("");
      setSubject("general");
      setMessage("");
      setAccept(false);
      setErrors({});
    },
  });

  /** Reprend les bornes du schéma serveur pour annoncer l'erreur avant l'envoi. */
  function validate(): Errors {
    const next: Errors = {};
    if (name.trim().length < 2) next.name = "Indiquez votre nom (2 caractères minimum).";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
      next.email = "Indiquez une adresse email valide.";
    if (message.trim().length < 10)
      next.message = "Votre message doit faire au moins 10 caractères.";
    if (!accept) next.accept = "Votre accord est nécessaire pour traiter le message.";
    return next;
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    submit.mutate({
      senderName: name.trim(),
      senderEmail: email.trim(),
      subject,
      message: message.trim(),
    });
  }

  if (submit.isSuccess) {
    return (
      <div className="form-card" role="status">
        <h2>Message envoyé</h2>
        <p style={{ margin: 0, fontSize: 16, lineHeight: 1.55, color: "var(--fg-2)" }}>
          Merci. Nous vous répondrons par email.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="form-card">
      <h2>Votre message</h2>
      <div className="form-stack">
        <div className="form-row">
          <Field
            label="Nom *"
            placeholder="Prénom Nom"
            value={name}
            onChange={setName}
            name="name"
            autoComplete="name"
            error={errors.name}
            required
          />
          <Field
            label="Email *"
            placeholder="vous@exemple.fr"
            value={email}
            onChange={setEmail}
            name="email"
            autoComplete="email"
            type="email"
            error={errors.email}
            required
          />
        </div>

        <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span className="field-label">Sujet</span>
          <select
            name="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value as Subject)}
            className="field-input"
          >
            {SUBJECTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span className="field-label">Message *</span>
          <textarea
            name="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={6}
            required
            aria-required="true"
            aria-invalid={errors.message ? true : undefined}
            aria-describedby={errors.message ? "message-error" : undefined}
            placeholder="Votre message…"
            className="field-input"
            style={errors.message ? { borderColor: "var(--danger)" } : undefined}
          />
          {errors.message && (
            <span id="message-error" className="field-error">
              {errors.message}
            </span>
          )}
        </label>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <Check
              on={accept}
              onClick={() => setAccept(!accept)}
              labelledBy="contact-consent-label"
            />
            <span
              id="contact-consent-label"
              onClick={() => setAccept(!accept)}
              style={{
                fontSize: 15,
                color: "var(--fg-2)",
                lineHeight: 1.5,
                cursor: "pointer",
              }}
            >
              J&apos;accepte que mes données soient traitées pour répondre à mon
              message (RGPD).
            </span>
          </div>
          {errors.accept && <span className="field-error">{errors.accept}</span>}
        </div>
      </div>

      {submit.isError && (
        <div className="notice is-error" role="alert">
          {submit.error.data?.code === "TOO_MANY_REQUESTS"
            ? "Trop d'envois depuis votre connexion. Réessayez dans une minute."
            : "Une erreur est survenue. Réessayez ou écrivez-nous directement."}
        </div>
      )}

      <div className="form-actions">
        <button
          type="submit"
          className="btn accent btn-lg"
          disabled={submit.isPending}
          style={{ opacity: submit.isPending ? 0.5 : 1 }}
        >
          {submit.isPending ? "Envoi…" : "Envoyer le message"}
        </button>
      </div>
    </form>
  );
}
