"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { authClient } from "~/lib/auth-client";

// ─── Form schema ──────────────────────────────────────────────────────────────

const EXPERTISE_OPTIONS = [
  "Sommelier",
  "Oenologue",
  "Sommelier cannabis",
  "Producteur",
  "Journaliste specialise",
  "Cannabis expert",
  "Autre",
] as const;

const profileSchema = z.object({
  name: z.string().min(1, "Nom requis").max(100),
  email: z.string().email("Email invalide"),
  displayName: z.string().max(100).optional(),
  expertiseSelect: z.string().optional(),
  expertiseCustom: z.string().max(150).optional(),
  bio: z.string().max(300).optional(),
  showOnPublicResults: z.boolean(),
  notifyOnInvitation: z.boolean(),
  notifyOnAssignment: z.boolean(),
  notifyOnReminder: z.boolean(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

// ─── Nothing Toggle ───────────────────────────────────────────────────────────

function NothingToggle({
  checked,
  onChange,
  label,
  helperText,
  helperColor,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  helperText?: string;
  helperColor?: string;
}) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 0",
        }}
      >
        <span className="n-label" style={{ color: "var(--n-text-secondary)" }}>
          {label}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={() => onChange(!checked)}
          style={{
            position: "relative",
            display: "inline-flex",
            alignItems: "center",
            width: 44,
            height: 24,
            borderRadius: 999,
            background: checked ? "var(--n-text-display)" : "var(--n-border-visible)",
            border: "none",
            cursor: "pointer",
            padding: 0,
            transition: "background 200ms ease-out",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              position: "absolute",
              left: checked ? 22 : 2,
              width: 20,
              height: 20,
              borderRadius: "50%",
              background: checked ? "var(--n-black)" : "var(--n-text-disabled)",
              transition: "left 200ms ease-out, background 200ms ease-out",
            }}
          />
        </button>
      </div>
      {helperText && (
        <p
          className="n-font-body"
          style={{
            fontSize: 12,
            color: helperColor ?? "var(--n-text-disabled)",
            lineHeight: 1.5,
            marginTop: -8,
            paddingBottom: 4,
          }}
        >
          {helperText}
        </p>
      )}
    </div>
  );
}

// ─── Section Divider ──────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        margin: "24px 0 16px",
      }}
    >
      <span className="n-label" style={{ color: "var(--n-text-disabled)", whiteSpace: "nowrap" }}>
        {children}
      </span>
      <div style={{ flex: 1, height: 1, background: "var(--n-border)" }} />
    </div>
  );
}

// ─── Stat Row ─────────────────────────────────────────────────────────────────

function StatRow({
  label,
  value,
  last,
}: {
  label: string;
  value: string | number;
  last?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 0",
        borderBottom: last ? "none" : "1px solid var(--n-border)",
      }}
    >
      <span className="n-label" style={{ color: "var(--n-text-secondary)" }}>
        {label}
      </span>
      <span
        className="n-font-data"
        style={{ fontSize: 13, color: "var(--n-text-primary)", letterSpacing: "0.02em" }}
      >
        {value}
      </span>
    </div>
  );
}

// ─── Segmented progress bar ───────────────────────────────────────────────────

function SegmentedProgress({ value, segments = 16 }: { value: number; segments?: number }) {
  const filled = Math.round((value / 100) * segments);
  return (
    <div className="n-progress-bar" style={{ gap: 2 }}>
      {Array.from({ length: segments }).map((_, i) => (
        <div
          key={i}
          className={`n-progress-segment${i < filled ? " filled" : ""}`}
        />
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type SaveStatus =
  | "idle"
  | "saving"
  | "saved"
  | "error"
  | "email_sent";

export default function JuryProfileEditPage() {
  const router = useRouter();
  const utils = api.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [pendingImageUrl, setPendingImageUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string>("");
  const [emailChanged, setEmailChanged] = useState(false);

  const { data, isLoading } = api.jury.getMyProfileForEdit.useQuery();
  const { data: juryCups } = api.jury.getMyJuryCups.useQuery();
  const { data: myStats } = api.jury.getMyStats.useQuery();

  const updateMutation = api.jury.updateMyProfile.useMutation({
    onSuccess: () => {
      setSaveStatus("saved");
      void utils.jury.getMyProfileForEdit.invalidate();
      setTimeout(() => setSaveStatus("idle"), 2500);
    },
    onError: (err) => {
      setSaveStatus("error");
      setSaveError(err.message);
      setTimeout(() => setSaveStatus("idle"), 3000);
    },
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { isDirty, errors },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: "",
      email: "",
      displayName: "",
      expertiseSelect: "",
      expertiseCustom: "",
      bio: "",
      showOnPublicResults: false,
      notifyOnInvitation: true,
      notifyOnAssignment: true,
      notifyOnReminder: true,
    },
  });

  // Populate form once data loads
  useEffect(() => {
    if (!data) return;
    const { user, juryProfile } = data;

    // Resolve expertise fields
    const storedExpertise = juryProfile.expertise ?? "";
    const isKnown = (EXPERTISE_OPTIONS as readonly string[]).includes(storedExpertise);
    const expertiseSelect = storedExpertise === "" ? "" : isKnown ? storedExpertise : "Autre";
    const expertiseCustom = isKnown || storedExpertise === "" ? "" : storedExpertise;

    reset({
      name: user.name,
      email: user.email,
      displayName: juryProfile.displayName ?? "",
      expertiseSelect,
      expertiseCustom,
      bio: juryProfile.bio ?? "",
      showOnPublicResults: juryProfile.showOnPublicResults,
      notifyOnInvitation: juryProfile.notifyOnInvitation,
      notifyOnAssignment: juryProfile.notifyOnAssignment,
      notifyOnReminder: juryProfile.notifyOnReminder,
    });

    if (user.image) setAvatarPreview(user.image);
  }, [data, reset]);

  const watchedBio = watch("bio") ?? "";
  const watchedExpertiseSelect = watch("expertiseSelect") ?? "";
  const watchedShowPublic = watch("showOnPublicResults");
  const watchedNotifyInvitation = watch("notifyOnInvitation");
  const watchedNotifyAssignment = watch("notifyOnAssignment");
  const watchedNotifyReminder = watch("notifyOnReminder");

  // Stats derived from queries
  const orgCups = juryCups ?? [];
  const totalCups = orgCups.length;
  const totalRatings = orgCups.reduce((s, c) => s + c.progress.rated, 0);
  const totalProducts = orgCups.reduce((s, c) => s + c.progress.total, 0);
  const globalProgress =
    totalProducts > 0 ? Math.round((totalRatings / totalProducts) * 100) : 0;

  // Avatar upload handler
  const handleAvatarFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Optimistic preview
      const objectUrl = URL.createObjectURL(file);
      setAvatarPreview(objectUrl);
      setUploadingAvatar(true);

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("folder", "jury-avatars");

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        const json = (await res.json()) as { url?: string; error?: string };

        if (!res.ok || !json.url) {
          throw new Error(json.error ?? "Erreur upload");
        }

        setPendingImageUrl(json.url);
        setAvatarPreview(json.url);
      } catch (err) {
        // Revert on error
        setAvatarPreview(data?.user?.image ?? null);
        setSaveStatus("error");
        setSaveError(err instanceof Error ? err.message : "Erreur upload avatar");
        setTimeout(() => setSaveStatus("idle"), 3000);
      } finally {
        setUploadingAvatar(false);
        URL.revokeObjectURL(objectUrl);
      }
    },
    [data?.user?.image]
  );

  const handleLogout = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => router.push("/login"),
      },
    });
  };

  const onSubmit = async (values: ProfileFormValues) => {
    setSaveStatus("saving");
    setSaveError("");
    setEmailChanged(false);

    // Resolve expertise final value
    const expertiseFinal =
      values.expertiseSelect === "Autre"
        ? (values.expertiseCustom ?? "")
        : (values.expertiseSelect ?? "");

    // Handle email change separately via Better Auth
    if (values.email !== data?.user?.email && values.email.trim() !== "") {
      try {
        await authClient.changeEmail({
          newEmail: values.email,
          callbackURL: "/jury/profile/edit",
        });
        setEmailChanged(true);
      } catch {
        setSaveStatus("error");
        setSaveError("Impossible d'envoyer le mail de confirmation d'email");
        return;
      }
    }

    updateMutation.mutate({
      name: values.name,
      ...(pendingImageUrl !== null ? { image: pendingImageUrl } : {}),
      displayName: values.displayName || null,
      expertise: expertiseFinal || null,
      bio: values.bio || null,
      showOnPublicResults: values.showOnPublicResults,
      notifyOnInvitation: values.notifyOnInvitation,
      notifyOnAssignment: values.notifyOnAssignment,
      notifyOnReminder: values.notifyOnReminder,
    });

    if (emailChanged) {
      setSaveStatus("email_sent");
      setTimeout(() => setSaveStatus("idle"), 4000);
    }
  };

  // Derive initials for avatar placeholder
  const name = data?.user?.name ?? "";
  const initials = name
    ? name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "??";

  if (isLoading) {
    return (
      <div
        style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 400 }}
      >
        <span
          className="n-font-data n-label"
          style={{ color: "var(--n-text-secondary)", fontSize: 13 }}
        >
          [LOADING...]
        </span>
      </div>
    );
  }

  const isFormDirty = isDirty || pendingImageUrl !== null;

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      style={{ display: "flex", flexDirection: "column", gap: 0 }}
    >
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <p className="n-label" style={{ color: "var(--n-text-secondary)", marginBottom: 4 }}>
          JURY · PROFIL
        </p>
        <h1
          className="n-font-body"
          style={{ fontSize: 28, fontWeight: 600, color: "var(--n-text-display)", lineHeight: 1.1 }}
        >
          MON PROFIL — EDITION
        </h1>
      </div>

      {/* 2-column layout */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr",
          gap: 32,
          alignItems: "start",
        }}
        className="profile-edit-grid"
      >
        {/* ================================================================ */}
        {/* LEFT COLUMN — editable fields                                     */}
        {/* ================================================================ */}
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>

          {/* ── IDENTITE ── */}
          <SectionLabel>IDENTITE</SectionLabel>

          {/* Avatar */}
          <div style={{ marginBottom: 24 }}>
            <p className="n-label" style={{ color: "var(--n-text-secondary)", marginBottom: 12 }}>
              AVATAR
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                style={{
                  position: "relative",
                  width: 80,
                  height: 80,
                  borderRadius: "50%",
                  border: "1px solid var(--n-border-visible)",
                  background: "var(--n-surface-raised)",
                  cursor: uploadingAvatar ? "wait" : "pointer",
                  overflow: "hidden",
                  padding: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  transition: "border-color 200ms ease-out",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor =
                    "var(--n-text-secondary)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor =
                    "var(--n-border-visible)";
                }}
                aria-label="Changer l'avatar"
              >
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="Avatar"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <span
                    className="n-font-data"
                    style={{ fontSize: 24, color: "var(--n-text-primary)" }}
                  >
                    {initials}
                  </span>
                )}
                {uploadingAvatar && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: "rgba(0,0,0,0.6)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <span
                      className="n-font-data"
                      style={{ fontSize: 10, color: "var(--n-text-display)", letterSpacing: "0.06em" }}
                    >
                      ...
                    </span>
                  </div>
                )}
              </button>
              <div>
                <p
                  className="n-font-body"
                  style={{ fontSize: 13, color: "var(--n-text-secondary)", lineHeight: 1.5 }}
                >
                  Cliquer sur l'avatar pour changer la photo.
                </p>
                <p
                  className="n-font-body"
                  style={{ fontSize: 12, color: "var(--n-text-disabled)", lineHeight: 1.5, marginTop: 4 }}
                >
                  JPG, PNG ou WebP · Max 10 Mo · Converti en WebP
                </p>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style={{ display: "none" }}
              onChange={handleAvatarFileChange}
              aria-label="Fichier avatar"
            />
          </div>

          {/* Nom complet */}
          <div style={{ marginBottom: 20 }}>
            <label
              htmlFor="edit-name"
              className="n-label"
              style={{ color: "var(--n-text-secondary)", display: "block", marginBottom: 4 }}
            >
              NOM COMPLET
            </label>
            <input
              id="edit-name"
              className="n-input n-font-body"
              style={{ fontSize: 15 }}
              placeholder="Votre nom complet"
              {...register("name")}
            />
            {errors.name && (
              <p
                className="n-font-data"
                style={{ fontSize: 11, color: "var(--n-accent)", marginTop: 4 }}
              >
                {errors.name.message}
              </p>
            )}
          </div>

          {/* Email */}
          <div style={{ marginBottom: 8 }}>
            <label
              htmlFor="edit-email"
              className="n-label"
              style={{ color: "var(--n-text-secondary)", display: "block", marginBottom: 4 }}
            >
              EMAIL
            </label>
            <input
              id="edit-email"
              type="email"
              className="n-input n-font-body"
              style={{ fontSize: 15 }}
              placeholder="votre@email.com"
              {...register("email")}
            />
            {errors.email && (
              <p
                className="n-font-data"
                style={{ fontSize: 11, color: "var(--n-accent)", marginTop: 4 }}
              >
                {errors.email.message}
              </p>
            )}
          </div>
          <p
            className="n-font-body"
            style={{
              fontSize: 12,
              color: "var(--n-text-disabled)",
              lineHeight: 1.5,
              marginBottom: 20,
            }}
          >
            Un mail de confirmation sera envoye a la nouvelle adresse avant que le changement ne soit effectif.
          </p>

          {/* ── PROFIL PUBLIC ── */}
          <SectionLabel>PROFIL PUBLIC</SectionLabel>

          {/* Expertise */}
          <div style={{ marginBottom: 20 }}>
            <label
              htmlFor="edit-expertise"
              className="n-label"
              style={{ color: "var(--n-text-secondary)", display: "block", marginBottom: 4 }}
            >
              EXPERTISE
            </label>
            <div style={{ position: "relative" }}>
              <select
                id="edit-expertise"
                className="n-font-data"
                style={{
                  width: "100%",
                  background: "transparent",
                  border: "none",
                  borderBottom: "1px solid var(--n-border-visible)",
                  color: "var(--n-text-primary)",
                  padding: "12px 0",
                  fontSize: 14,
                  outline: "none",
                  cursor: "pointer",
                  appearance: "none",
                  WebkitAppearance: "none",
                }}
                {...register("expertiseSelect")}
              >
                <option value="" style={{ background: "#111111", color: "#E8E8E8" }}>
                  — Choisir une expertise —
                </option>
                {EXPERTISE_OPTIONS.map((opt) => (
                  <option
                    key={opt}
                    value={opt}
                    style={{ background: "#111111", color: "#E8E8E8" }}
                  >
                    {opt}
                  </option>
                ))}
              </select>
              <span
                style={{
                  position: "absolute",
                  right: 0,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--n-text-disabled)",
                  pointerEvents: "none",
                  fontSize: 12,
                }}
              >
                ▾
              </span>
            </div>
            {watchedExpertiseSelect === "Autre" && (
              <div style={{ marginTop: 12 }}>
                <label
                  htmlFor="edit-expertise-custom"
                  className="n-label"
                  style={{ color: "var(--n-text-secondary)", display: "block", marginBottom: 4 }}
                >
                  PRECISION (MAX 150 CAR.)
                </label>
                <input
                  id="edit-expertise-custom"
                  className="n-input n-font-body"
                  style={{ fontSize: 14 }}
                  placeholder="Decrivez votre expertise"
                  maxLength={150}
                  {...register("expertiseCustom")}
                />
              </div>
            )}
          </div>

          {/* Nom affiché */}
          <div style={{ marginBottom: 8 }}>
            <label
              htmlFor="edit-displayname"
              className="n-label"
              style={{ color: "var(--n-text-secondary)", display: "block", marginBottom: 4 }}
            >
              NOM AFFICHE
            </label>
            <input
              id="edit-displayname"
              className="n-input n-font-body"
              style={{ fontSize: 15 }}
              placeholder="Alias public optionnel"
              {...register("displayName")}
            />
          </div>
          <p
            className="n-font-body"
            style={{
              fontSize: 12,
              color: "var(--n-text-disabled)",
              lineHeight: 1.5,
              marginBottom: 20,
            }}
          >
            Si vide, votre nom complet sera utilise sur les pages publiques.
          </p>

          {/* Bio */}
          <div style={{ marginBottom: 20 }}>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                marginBottom: 4,
              }}
            >
              <label
                htmlFor="edit-bio"
                className="n-label"
                style={{ color: "var(--n-text-secondary)" }}
              >
                BIO
              </label>
              <span
                className="n-font-data"
                style={{
                  fontSize: 11,
                  color:
                    watchedBio.length > 280
                      ? "var(--n-accent)"
                      : "var(--n-text-disabled)",
                  letterSpacing: "0.04em",
                }}
              >
                {watchedBio.length}/300
              </span>
            </div>
            <textarea
              id="edit-bio"
              className="n-textarea"
              rows={4}
              maxLength={300}
              placeholder="Quelques mots sur votre parcours..."
              {...register("bio")}
            />
          </div>

          {/* Apparaître public toggle */}
          <div style={{ borderTop: "1px solid var(--n-border)", paddingTop: 4 }}>
            <NothingToggle
              checked={watchedShowPublic ?? false}
              onChange={(v) => setValue("showOnPublicResults", v, { shouldDirty: true })}
              label="APPARAITRE SUR RESULTATS PUBLICS"
              helperText="Si active, votre nom et votre bio seront visibles sur les pages de resultats publiques."
              helperColor="var(--n-accent)"
            />
          </div>

          {/* ── SAVE BUTTON ── */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              marginTop: 32,
              paddingTop: 24,
              borderTop: "1px solid var(--n-border)",
            }}
          >
            <button
              type="submit"
              className="n-btn-primary"
              disabled={!isFormDirty || saveStatus === "saving" || uploadingAvatar}
            >
              {saveStatus === "saving" ? "[ENREGISTREMENT...]" : "ENREGISTRER TOUT"}
            </button>

            {/* Inline status */}
            {saveStatus === "saved" && (
              <span
                className="n-font-data"
                style={{ fontSize: 12, color: "var(--n-text-disabled)", letterSpacing: "0.06em" }}
              >
                [SAUVEGARDE]
              </span>
            )}
            {saveStatus === "email_sent" && (
              <span
                className="n-font-data"
                style={{ fontSize: 12, color: "var(--n-warning)", letterSpacing: "0.06em" }}
              >
                [MAIL DE CONFIRMATION ENVOYE]
              </span>
            )}
            {saveStatus === "error" && (
              <span
                className="n-font-data"
                style={{ fontSize: 12, color: "var(--n-accent)", letterSpacing: "0.06em" }}
              >
                [ERREUR: {saveError}]
              </span>
            )}
          </div>
        </div>

        {/* ================================================================ */}
        {/* RIGHT COLUMN — stats + notifications + logout                    */}
        {/* ================================================================ */}
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>

          {/* Stats card */}
          <div className="n-card" style={{ marginBottom: 16 }}>
            <div style={{ borderBottom: "1px solid var(--n-border)", paddingBottom: 12, marginBottom: 0 }}>
              <p className="n-label" style={{ color: "var(--n-text-secondary)" }}>
                STATISTIQUES
              </p>
            </div>

            {/* Hero stat — cups */}
            <div style={{ padding: "16px 0 12px" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 4 }}>
                <span
                  className="n-font-data"
                  style={{
                    fontSize: 42,
                    fontWeight: 700,
                    lineHeight: 1,
                    color: "var(--n-text-display)",
                    letterSpacing: "-0.04em",
                  }}
                >
                  {totalCups}
                </span>
                <span
                  className="n-font-data"
                  style={{ fontSize: 13, color: "var(--n-text-secondary)" }}
                >
                  CUP{totalCups !== 1 ? "S" : ""}
                </span>
              </div>
            </div>

            <StatRow label="NOTES SOUMISES" value={myStats?.totalRatings ?? totalRatings} />
            <StatRow label="PRODUITS ASSIGNES" value={totalProducts} />

            {/* Progress */}
            {totalProducts > 0 && (
              <div style={{ paddingTop: 12 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    marginBottom: 8,
                  }}
                >
                  <span className="n-label" style={{ color: "var(--n-text-secondary)" }}>
                    PROGRESSION
                  </span>
                  <span
                    className="n-font-data"
                    style={{ fontSize: 14, color: "var(--n-text-display)", letterSpacing: "-0.01em" }}
                  >
                    {globalProgress}%
                  </span>
                </div>
                <SegmentedProgress value={globalProgress} segments={12} />
              </div>
            )}
          </div>

          {/* Notifications card */}
          <div className="n-card" style={{ marginBottom: 16 }}>
            <div style={{ borderBottom: "1px solid var(--n-border)", paddingBottom: 12 }}>
              <p className="n-label" style={{ color: "var(--n-text-secondary)" }}>
                NOTIFICATIONS
              </p>
            </div>
            <div style={{ paddingTop: 4 }}>
              <div style={{ borderBottom: "1px solid var(--n-border)" }}>
                <NothingToggle
                  checked={watchedNotifyInvitation ?? true}
                  onChange={(v) => setValue("notifyOnInvitation", v, { shouldDirty: true })}
                  label="INVITATION"
                />
              </div>
              <div style={{ borderBottom: "1px solid var(--n-border)" }}>
                <NothingToggle
                  checked={watchedNotifyAssignment ?? true}
                  onChange={(v) => setValue("notifyOnAssignment", v, { shouldDirty: true })}
                  label="ASSIGNATION"
                />
              </div>
              <NothingToggle
                checked={watchedNotifyReminder ?? true}
                onChange={(v) => setValue("notifyOnReminder", v, { shouldDirty: true })}
                label="RAPPELS"
              />
            </div>
          </div>

          {/* Jury type card */}
          {data?.juryProfile && (
            <div className="n-card" style={{ marginBottom: 16 }}>
              <div style={{ borderBottom: "1px solid var(--n-border)", paddingBottom: 12 }}>
                <p className="n-label" style={{ color: "var(--n-text-secondary)" }}>
                  TYPE DE JURY
                </p>
              </div>
              <div style={{ paddingTop: 12 }}>
                <span className="n-tag active">
                  {data.juryProfile.juryType === "pro" ? "PRO" : "PUBLIC"}
                </span>
              </div>
            </div>
          )}

          {/* Logout */}
          <div className="n-card">
            <button
              type="button"
              className="n-btn-destructive"
              style={{ width: "100%" }}
              onClick={handleLogout}
            >
              SE DECONNECTER
            </button>
          </div>
        </div>
      </div>

      {/* Responsive styles */}
      <style>{`
        @media (max-width: 768px) {
          .profile-edit-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </form>
  );
}
