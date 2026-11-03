"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Field, Check } from "~/components/portal/platinum";
import { api } from "~/trpc/react";

/** Sujets acceptés par contactMessages.submit, dans l'ordre d'affichage. */
const SUBJECTS = [
  "general",
  "registration",
  "results",
  "sponsorship",
  "press",
  "technical",
  "other",
] as const;

type Subject = (typeof SUBJECTS)[number];

interface ContactFormProps {
  defaultEmail?: string;
}

type Errors = Partial<Record<"name" | "email" | "message" | "accept", string>>;

export function ContactForm({ defaultEmail }: ContactFormProps) {
  const t = useTranslations("contact.form");
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
    if (name.trim().length < 2) next.name = t("errorName");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) next.email = t("errorEmail");
    if (message.trim().length < 10) next.message = t("errorMessage");
    if (!accept) next.accept = t("errorAccept");
    return next;
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    const firstError = (["name", "email", "message", "accept"] as const).find(
      (k) => found[k],
    );
    if (firstError) {
      // Sur mobile, le bouton d'envoi est loin sous les premiers champs :
      // sans ce focus, l'erreur reste hors de l'écran et l'envoi semble ignoré.
      const form = e.currentTarget;
      const target =
        firstError === "accept"
          ? form.querySelector<HTMLElement>('input[type="checkbox"]')
          : form.querySelector<HTMLElement>(`[name="${firstError}"]`);
      target?.focus();
      return;
    }

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
        <h2>{t("sentTitle")}</h2>
        <p style={{ margin: 0, fontSize: 16, lineHeight: 1.55, color: "var(--fg-2)" }}>
          {t("sentText")}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="form-card">
      <h2>{t("title")}</h2>
      <div className="form-stack">
        <div className="form-row">
          <Field
            label={t("name")}
            placeholder={t("namePlaceholder")}
            value={name}
            onChange={setName}
            name="name"
            autoComplete="name"
            error={errors.name}
            required
          />
          <Field
            label={t("email")}
            placeholder={t("emailPlaceholder")}
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
          <span className="field-label">{t("subject")}</span>
          <select
            name="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value as Subject)}
            className="field-input"
          >
            {SUBJECTS.map((s) => (
              <option key={s} value={s}>
                {t(`subjects.${s}`)}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span className="field-label">{t("message")}</span>
          <textarea
            name="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={6}
            required
            aria-required="true"
            aria-invalid={errors.message ? true : undefined}
            aria-describedby={errors.message ? "message-error" : undefined}
            placeholder={t("messagePlaceholder")}
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
          {/* Un vrai <label> : toute la ligne (texte compris) coche la case,
              ce qui donne au toucher une cible bien plus large que le carré. */}
          <label className="contact-consent">
            <Check
              on={accept}
              onClick={() => setAccept(!accept)}
              labelledBy="contact-consent-label"
            />
            <span id="contact-consent-label" className="contact-consent-text">
              {t("consent")}
            </span>
          </label>
          {errors.accept && <span className="field-error">{errors.accept}</span>}
        </div>
      </div>

      {submit.isError && (
        <div className="notice is-error" role="alert">
          {submit.error.data?.code === "TOO_MANY_REQUESTS"
            ? t("errorRate")
            : t("errorGeneric")}
        </div>
      )}

      <div className="form-actions">
        <button
          type="submit"
          className="btn accent btn-lg"
          disabled={submit.isPending}
          style={{ opacity: submit.isPending ? 0.5 : 1 }}
        >
          {submit.isPending ? t("sending") : t("send")}
        </button>
      </div>
    </form>
  );
}
