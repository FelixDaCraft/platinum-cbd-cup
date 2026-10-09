"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { RichTextEditor } from "~/components/ui/rich-text-editor-lazy";
import { api } from "~/trpc/react";

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

const formatDate = (d: Date) =>
  new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  }).format(d);

/**
 * Règlement — conditions de participation, publié sur /reglement. Les
 * producteurs l'acceptent à l'inscription : chaque enregistrement date la
 * nouvelle version (« Dernière mise à jour » sur la page publique).
 */
export default function ReglementEditorPage() {
  const utils = api.useUtils();
  const { data, isLoading, isError, refetch } = api.legalDocument.get.useQuery({
    slug: "reglement",
  });

  const [title, setTitle] = useState("");
  const [lede, setLede] = useState("");
  const [content, setContent] = useState("");
  const [dirty, setDirty] = useState(false);
  // L'éditeur renvoie le document une première fois, normalisé, juste après
  // son chargement : cette version sert de référence, sans quoi la page se
  // croirait modifiée dès l'ouverture.
  const baselineRef = useRef<string | null>(null);

  // Hydratation au premier chargement seulement : le rechargement qui suit
  // un enregistrement ne doit pas réinitialiser la référence de l'éditeur.
  const loadedRef = useRef(false);
  useEffect(() => {
    if (data && !loadedRef.current) {
      loadedRef.current = true;
      setTitle(data.title);
      setLede(data.lede ?? "");
      setContent(JSON.stringify(data.content));
      baselineRef.current = null;
      setDirty(false);
    }
  }, [data]);

  // Quitter la page avec des modifications non enregistrées : le navigateur
  // demande confirmation.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const update = api.legalDocument.update.useMutation({
    onSuccess: () => {
      toast.success("Règlement enregistré et publié");
      baselineRef.current = content;
      setDirty(false);
      void utils.legalDocument.get.invalidate({ slug: "reglement" });
    },
    onError: (err) => toast.error(err.message || "Erreur d'enregistrement"),
  });

  const handleSave = () => {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(content) as Record<string, unknown>;
    } catch {
      toast.error("Le contenu du règlement est illisible");
      return;
    }
    update.mutate({
      slug: "reglement",
      title: title.trim(),
      lede: lede.trim() || null,
      content: parsed,
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

  if (isError || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 text-center">
        <span role="alert" className="n-label" style={{ color: "var(--n-text-secondary)" }}>
          [ERREUR] LE RÈGLEMENT N&apos;A PAS PU ÊTRE CHARGÉ
        </span>
        <button type="button" className="n-btn-secondary text-xs" onClick={() => void refetch()}>
          RÉESSAYER
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 style={titleStyle}>Règlement</h1>
          <p className="n-label" style={{ marginTop: 4, color: "var(--n-text-secondary)" }}>
            CONDITIONS DE PARTICIPATION · PAGE PUBLIQUE /REGLEMENT
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="n-btn-secondary">
            <Link href="/reglement" target="_blank" rel="noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              Voir la page publique
            </Link>
          </Button>
          <Button
            onClick={handleSave}
            disabled={update.isPending || !dirty || !title.trim()}
            className="n-btn-primary"
          >
            {update.isPending ? (
              <span className="n-font-data text-xs">[ENREGISTREMENT...]</span>
            ) : (
              "Enregistrer et publier"
            )}
          </Button>
        </div>
      </div>

      {/* ── Statut ─────────────────────────────────────────── */}
      <div className="n-card" style={{ padding: "16px" }}>
        <p className="text-sm" style={{ color: "var(--n-text-secondary)", margin: 0 }}>
          {data.isCustom
            ? `Version en ligne enregistrée le ${formatDate(data.updatedAt)}.`
            : "Aucune version enregistrée : la page publique affiche le règlement par défaut, repris ci-dessous pour servir de base."}{" "}
          Les producteurs acceptent le règlement en ligne au moment de leur
          inscription : chaque enregistrement est publié immédiatement et date
          la nouvelle version.
          {dirty && (
            <span style={{ color: "var(--n-warning)" }}> Modifications non enregistrées.</span>
          )}
        </p>
      </div>

      {/* ── En-tête de page ────────────────────────────────── */}
      <div className="n-card space-y-6">
        <p style={cardTitleStyle}>En-tête de la page</p>
        <div className="space-y-2">
          <Label htmlFor="reglement-title" className="n-label">TITRE</Label>
          <Input
            id="reglement-title"
            value={title}
            maxLength={120}
            onChange={(e) => {
              setTitle(e.target.value);
              setDirty(true);
            }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="reglement-lede" className="n-label">CHAPEAU (FACULTATIF)</Label>
          <Textarea
            id="reglement-lede"
            value={lede}
            maxLength={500}
            rows={2}
            onChange={(e) => {
              setLede(e.target.value);
              setDirty(true);
            }}
          />
        </div>
      </div>

      {/* ── Corps ──────────────────────────────────────────── */}
      <div className="n-card space-y-4">
        <div>
          <p style={cardTitleStyle}>Articles</p>
          <p className="text-sm mt-1" style={{ color: "var(--n-text-secondary)" }}>
            Chaque intertitre de niveau 2 ouvre un article et une entrée du
            sommaire (ex. « 4. Inscription et frais »). Numérotez-les vous-même :
            les producteurs citent les articles par leur numéro.
          </p>
        </div>
        <RichTextEditor
          content={content}
          onChange={(value) => {
            setContent(value);
            if (baselineRef.current === null) {
              baselineRef.current = value;
              return;
            }
            setDirty(value !== baselineRef.current);
          }}
          placeholder="Rédigez le règlement…"
        />
      </div>
    </div>
  );
}
