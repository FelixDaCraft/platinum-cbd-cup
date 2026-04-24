"use client";

import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { useOrganization } from "~/lib/portal/context";
import { useSession, authClient } from "~/lib/auth-client";

/**
 * Jury Profile Page
 * Shows jury profile information and statistics
 */
export default function JuryProfilePage() {
  const router = useRouter();
  const organization = useOrganization();
  const { data: session, isPending: sessionLoading } = useSession();

  const handleLogout = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/login");
        },
      },
    });
  };

  // Get all jury cups
  const { data: juryCups, isLoading: cupsLoading } = api.jury.getMyJuryCups.useQuery();

  // Single-tenant: all jury cups belong to Platinum CBD Cup
  const orgCups = juryCups ?? [];

  // Calculate stats
  const totalCups = orgCups.length;
  const completedCups = orgCups.filter(c => c.progress.percentage === 100).length;
  const totalRatings = orgCups.reduce((sum, cup) => sum + cup.progress.rated, 0);
  const totalProducts = orgCups.reduce((sum, cup) => sum + cup.progress.total, 0);

  const isLoading = sessionLoading || cupsLoading;

  if (isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "400px" }}>
        <span className="n-font-data" style={{ color: "var(--n-text-disabled)", fontSize: "12px", letterSpacing: "0.08em" }}>
          [LOADING...]
        </span>
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="n-card" style={{ maxWidth: "480px", margin: "32px auto", padding: "32px", textAlign: "center" }}>
        <p className="n-label" style={{ color: "var(--n-accent)", marginBottom: "8px" }}>NON CONNECTÉ</p>
        <p className="n-font-body" style={{ color: "var(--n-text-disabled)", fontSize: "14px" }}>
          Vous devez être connecté pour voir votre profil.
        </p>
      </div>
    );
  }

  const user = session.user;
  const initials = user.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user.email?.slice(0, 2).toUpperCase() ?? "??";

  const globalProgress = totalProducts > 0
    ? Math.round((totalRatings / totalProducts) * 100)
    : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
      {/* Header */}
      <div>
        <h1 className="n-font-body" style={{ fontSize: "24px", fontWeight: 600, color: "var(--n-text-display)", marginBottom: "4px" }}>
          MON PROFIL
        </h1>
        <p className="n-font-body" style={{ color: "var(--n-text-secondary)", fontSize: "14px" }}>
          Informations et statistiques jury
        </p>
      </div>

      <div style={{ display: "grid", gap: "24px", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
        {/* Profile Card */}
        <div className="n-card" style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
          <p className="n-label" style={{ color: "var(--n-text-secondary)" }}>INFORMATIONS PERSONNELLES</p>

          {/* Avatar + Name + Role */}
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            {user.image ? (
              <img
                src={user.image}
                alt={user.name ?? ""}
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "50%",
                  border: "1px solid var(--n-border-visible)",
                  objectFit: "cover",
                }}
              />
            ) : (
              <div style={{
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                border: "1px solid var(--n-border-visible)",
                background: "var(--n-surface-raised)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}>
                <span className="n-font-data" style={{ fontSize: "18px", color: "var(--n-text-primary)" }}>
                  {initials}
                </span>
              </div>
            )}
            <div>
              <p className="n-font-body" style={{ fontSize: "20px", fontWeight: 600, color: "var(--n-text-display)", marginBottom: "6px" }}>
                {user.name || "Utilisateur"}
              </p>
              <span className="n-tag">JURY</span>
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: "1px", background: "var(--n-border)" }} />

          {/* Email */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="n-label" style={{ color: "var(--n-text-secondary)" }}>EMAIL</span>
            <span className="n-font-body" style={{ color: "var(--n-text-primary)", fontSize: "14px" }}>
              {user.email}
            </span>
          </div>
        </div>

        {/* Stats Card */}
        <div className="n-card" style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
          <p className="n-label" style={{ color: "var(--n-text-secondary)" }}>STATISTIQUES</p>

          {/* 4-cell instrument panel */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1px", background: "var(--n-border-visible)" }}>
            <div style={{ background: "var(--n-surface)", padding: "16px" }}>
              <p className="n-font-data" style={{ fontSize: "32px", color: "var(--n-text-display)", lineHeight: 1, marginBottom: "6px" }}>
                {totalCups}
              </p>
              <p className="n-label" style={{ color: "var(--n-text-secondary)", fontSize: "10px" }}>COMPÉTITIONS</p>
            </div>
            <div style={{ background: "var(--n-surface)", padding: "16px" }}>
              <p className="n-font-data" style={{ fontSize: "32px", color: "var(--n-text-display)", lineHeight: 1, marginBottom: "6px" }}>
                {completedCups}
              </p>
              <p className="n-label" style={{ color: "var(--n-text-secondary)", fontSize: "10px" }}>TERMINÉES</p>
            </div>
            <div style={{ background: "var(--n-surface)", padding: "16px" }}>
              <p className="n-font-data" style={{ fontSize: "32px", color: "var(--n-text-display)", lineHeight: 1, marginBottom: "6px" }}>
                {totalRatings}
              </p>
              <p className="n-label" style={{ color: "var(--n-text-secondary)", fontSize: "10px" }}>NOTES DONNÉES</p>
            </div>
            <div style={{ background: "var(--n-surface)", padding: "16px" }}>
              <p className="n-font-data" style={{ fontSize: "32px", color: "var(--n-text-display)", lineHeight: 1, marginBottom: "6px" }}>
                {totalProducts}
              </p>
              <p className="n-label" style={{ color: "var(--n-text-secondary)", fontSize: "10px" }}>PRODUITS ASSIGNÉS</p>
            </div>
          </div>

          {/* Progress */}
          {totalProducts > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="n-label" style={{ color: "var(--n-text-secondary)" }}>PROGRESSION GLOBALE</span>
              <span className="n-font-data" style={{ fontSize: "20px", color: "var(--n-text-display)" }}>
                {globalProgress}%
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Organization Info */}
      <div className="n-card" style={{ padding: "24px" }}>
        <p className="n-label" style={{ color: "var(--n-text-secondary)", marginBottom: "16px" }}>ORGANISATION</p>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="n-label" style={{ color: "var(--n-text-secondary)" }}>NOM</span>
          <span className="n-font-body" style={{ color: "var(--n-text-primary)", fontSize: "14px" }}>
            {organization.name}
          </span>
        </div>
        <div style={{ height: "1px", background: "var(--n-border)", margin: "12px 0" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="n-label" style={{ color: "var(--n-text-secondary)" }}>ACTIVITÉ</span>
          <span className="n-font-data" style={{ color: "var(--n-text-primary)", fontSize: "13px" }}>
            {totalCups} COMP. · {totalRatings} NOTE{totalRatings !== 1 ? "S" : ""}
          </span>
        </div>
      </div>

      {/* Logout */}
      <div className="n-card" style={{ padding: "24px" }}>
        <p className="n-label" style={{ color: "var(--n-text-secondary)", marginBottom: "4px" }}>DÉCONNEXION</p>
        <p className="n-font-body" style={{ color: "var(--n-text-disabled)", fontSize: "13px", marginBottom: "16px" }}>
          Se déconnecter de votre compte
        </p>
        <button className="n-btn-destructive" onClick={handleLogout}>
          Se déconnecter
        </button>
      </div>
    </div>
  );
}
