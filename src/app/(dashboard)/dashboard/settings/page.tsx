"use client";

import { User, Mail, Shield } from "lucide-react";

import { ProfileForm } from "~/components/profile/profile-form";
import { EmailChangeForm } from "~/components/profile/email-change-form";
import { GdprSettings } from "~/components/profile/gdpr-settings";

interface SettingsCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
  className?: string;
}

function SettingsCard({ icon, title, description, children, className = "" }: SettingsCardProps) {
  return (
    <div className={`overflow-hidden ${className}`} style={{ background: "var(--n-surface)", border: "1px solid var(--n-border)", borderRadius: "12px" }}>
      <div className="p-5 flex items-center gap-3" style={{ borderBottom: "1px solid var(--n-border)" }}>
        <div style={{ color: "var(--n-text-secondary)" }}>
          {icon}
        </div>
        <div>
          <p style={{ fontFamily: "'Doto', 'Space Mono', monospace", fontSize: "12px", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--n-text-display)", fontWeight: 700, marginBottom: "2px" }}>{title}</p>
          <p className="n-label" style={{ fontSize: "10px", color: "var(--n-text-secondary)" }}>{description}</p>
        </div>
      </div>
      <div className="p-5">
        {children}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 style={{ fontFamily: "'Doto', 'Space Mono', monospace", fontSize: "20px", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 700, color: "var(--n-text-display)" }}>Parametres</h1>
        <p className="n-label" style={{ marginTop: "4px", color: "var(--n-text-secondary)" }}>
          GEREZ VOTRE PROFIL
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <SettingsCard
          icon={<User className="h-4 w-4" />}
          title="Profil"
          description="VOS INFORMATIONS PERSONNELLES ET D'ENTREPRISE"
        >
          <ProfileForm />
        </SettingsCard>

        <SettingsCard
          icon={<Mail className="h-4 w-4" />}
          title="Email"
          description="MODIFIEZ VOTRE ADRESSE EMAIL"
        >
          <EmailChangeForm />
        </SettingsCard>

        <SettingsCard
          icon={<Shield className="h-4 w-4" />}
          title="Mes donnees (RGPD)"
          description="EXPORTEZ OU SUPPRIMEZ VOS DONNEES PERSONNELLES"
          className="md:col-span-2"
        >
          <GdprSettings />
        </SettingsCard>
      </div>
    </div>
  );
}
