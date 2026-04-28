"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { api } from "~/trpc/react";
import type { TeamMember } from "~/server/db/schema/organization-about";

function genId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `tm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const titleStyle: React.CSSProperties = {
  fontFamily: "'Doto', 'Space Mono', monospace",
  fontSize: "20px",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  fontWeight: 700,
  color: "var(--n-text-display)",
};

const cardTitleStyle: React.CSSProperties = {
  fontFamily: "'Doto', 'Space Mono', monospace",
  fontSize: "12px",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--n-text-display)",
  fontWeight: 700,
};

export default function AboutEditorPage() {
  const utils = api.useUtils();
  const { data, isLoading } = api.organizationAbout.get.useQuery();

  const [history, setHistory] = useState("");
  const [mission, setMission] = useState("");
  const [values, setValues] = useState("");
  const [team, setTeam] = useState<TeamMember[]>([]);

  // Hydrate local state when DB row loads
  useEffect(() => {
    if (data) {
      setHistory(data.history ?? "");
      setMission(data.mission ?? "");
      setValues(data.values ?? "");
      setTeam((data.teamMembers ?? []) as TeamMember[]);
    }
  }, [data]);

  const update = api.organizationAbout.update.useMutation({
    onSuccess: () => {
      toast.success("Manifesto enregistré");
      void utils.organizationAbout.get.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Erreur d'enregistrement");
    },
  });

  const handleAddMember = () => {
    setTeam((t) => [
      ...t,
      { id: genId(), name: "", role: "", photo: null, bio: null },
    ]);
  };

  const handleRemoveMember = (id: string) => {
    setTeam((t) => t.filter((m) => m.id !== id));
  };

  const handleMemberChange = (id: string, field: keyof TeamMember, value: string) => {
    setTeam((t) =>
      t.map((m) => (m.id === id ? { ...m, [field]: value || null } : m))
    );
  };

  const handleSave = () => {
    update.mutate({
      history: history || null,
      mission: mission || null,
      values: values || null,
      teamMembers: team.map((m) => ({
        id: m.id,
        name: m.name.trim(),
        role: m.role.trim(),
        photo: m.photo || null,
        bio: m.bio || null,
      })),
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <span style={{ fontFamily: "'Space Mono', monospace", color: "var(--n-text-secondary)" }}>
          [LOADING...]
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 style={titleStyle}>Manifesto</h1>
          <p className="n-label" style={{ marginTop: 4, color: "var(--n-text-secondary)" }}>
            CONTENU DE LA PAGE PUBLIQUE /MANIFESTO
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={update.isPending}
          className="n-btn-primary"
        >
          {update.isPending ? (
            <span className="n-font-data text-xs">[ENREGISTREMENT...]</span>
          ) : (
            "Enregistrer"
          )}
        </Button>
      </div>

      {/* ── Mission / History / Values ─────────────────────── */}
      <div className="n-card space-y-6">
        <p style={cardTitleStyle}>Texte du manifeste</p>

        <div className="space-y-2">
          <Label htmlFor="mission" className="n-label">MISSION</Label>
          <Textarea
            id="mission"
            value={mission}
            onChange={(e) => setMission(e.target.value)}
            rows={3}
            placeholder="Une à deux phrases punch décrivant la mission."
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="history" className="n-label">HISTOIRE</Label>
          <Textarea
            id="history"
            value={history}
            onChange={(e) => setHistory(e.target.value)}
            rows={6}
            placeholder="Pourquoi cette compétition existe, comment elle est née."
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="values" className="n-label">VALEURS</Label>
          <Textarea
            id="values"
            value={values}
            onChange={(e) => setValues(e.target.value)}
            rows={4}
            placeholder="Indépendance, transparence, rigueur scientifique..."
          />
        </div>
      </div>

      {/* ── Team members ────────────────────────────────────── */}
      <div className="n-card space-y-6">
        <div className="flex items-center justify-between">
          <p style={cardTitleStyle}>
            Équipe · {String(team.length).padStart(2, "0")}
          </p>
          <Button
            onClick={handleAddMember}
            variant="outline"
            size="sm"
            className="n-btn-secondary"
          >
            <Plus className="mr-2 h-3.5 w-3.5" />
            Ajouter un membre
          </Button>
        </div>

        {team.length === 0 ? (
          <p
            style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: 12,
              color: "var(--n-text-secondary)",
              textAlign: "center",
              padding: "24px 0",
            }}
          >
            [AUCUN MEMBRE D'ÉQUIPE]
          </p>
        ) : (
          <div className="space-y-4">
            {team.map((member, i) => (
              <div
                key={member.id}
                style={{
                  border: "1px solid var(--n-border)",
                  borderRadius: 10,
                  padding: 16,
                }}
              >
                <div className="flex items-center justify-between mb-4">
                  <span
                    className="n-label"
                    style={{ color: "var(--n-text-display)" }}
                  >
                    MEMBRE {String(i + 1).padStart(2, "0")}
                  </span>
                  <Button
                    onClick={() => handleRemoveMember(member.id)}
                    variant="ghost"
                    size="icon"
                    aria-label="Supprimer"
                  >
                    <Trash2 className="h-4 w-4" style={{ color: "var(--n-accent)" }} />
                  </Button>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="n-label">NOM *</Label>
                    <Input
                      value={member.name}
                      onChange={(e) => handleMemberChange(member.id, "name", e.target.value)}
                      placeholder="Jane Doe"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="n-label">RÔLE *</Label>
                    <Input
                      value={member.role}
                      onChange={(e) => handleMemberChange(member.id, "role", e.target.value)}
                      placeholder="Head of Jury"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label className="n-label">PHOTO (URL)</Label>
                    <Input
                      value={member.photo ?? ""}
                      onChange={(e) => handleMemberChange(member.id, "photo", e.target.value)}
                      placeholder="https://…/photo.jpg"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label className="n-label">BIO</Label>
                    <Textarea
                      value={member.bio ?? ""}
                      onChange={(e) => handleMemberChange(member.id, "bio", e.target.value)}
                      rows={3}
                      placeholder="Bio courte du membre."
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
