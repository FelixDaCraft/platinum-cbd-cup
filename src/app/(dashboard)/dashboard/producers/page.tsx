"use client";

import { useState, useMemo } from "react";
import {
  Search,
  Mail,
  ExternalLink,
  Phone,
  Trash2,
  X,
} from "lucide-react";

import { api } from "~/trpc/react";

export default function ProducersPage() {
  const [search, setSearch] = useState("");
  const [selectedProducer, setSelectedProducer] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const utils = api.useUtils();
  const { data: producers, isLoading } = api.producer.listByOrganization.useQuery();

  const deleteMutation = api.producer.deleteByOrganization.useMutation({
    onSuccess: () => {
      setSelectedProducer(null);
      setConfirmDelete(false);
      void utils.producer.listByOrganization.invalidate();
    },
  });

  const filtered = useMemo(() => {
    if (!producers) return [];
    if (!search.trim()) return producers;
    const q = search.toLowerCase();
    return producers.filter(
      (p) =>
        p.companyName.toLowerCase().includes(q) ||
        p.brandName.toLowerCase().includes(q) ||
        (p.userName ?? "").toLowerCase().includes(q) ||
        (p.userEmail ?? "").toLowerCase().includes(q)
    );
  }, [producers, search]);

  const selected = useMemo(
    () => (producers ?? []).find((p) => p.id === selectedProducer) ?? null,
    [producers, selectedProducer]
  );

  const totalRegistrations = useMemo(
    () => (producers ?? []).reduce((acc, p) => acc + p.cups.length, 0),
    [producers]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <span className="n-font-data" style={{ color: "var(--n-text-disabled)", fontSize: "13px", letterSpacing: "0.08em" }}>
          [LOADING...]
        </span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "48px" }}>
      {/* Header */}
      <div>
        <p className="n-label" style={{ color: "var(--n-text-disabled)", marginBottom: "4px" }}>TABLEAU DE BORD</p>
        <h1 className="n-font-body" style={{ fontSize: "28px", fontWeight: 500, color: "var(--n-text-display)" }}>
          Producteurs
        </h1>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", border: "1px solid var(--n-border-visible)", borderRadius: "8px", overflow: "hidden" }}>
        <div style={{ padding: "20px 24px", borderRight: "1px solid var(--n-border)" }}>
          <p className="n-label" style={{ color: "var(--n-text-disabled)" }}>PRODUCTEURS</p>
          <p className="n-font-data" style={{ fontSize: "36px", fontWeight: 700, color: "var(--n-text-display)", marginTop: "4px" }}>
            {producers?.length ?? 0}
          </p>
        </div>
        <div style={{ padding: "20px 24px" }}>
          <p className="n-label" style={{ color: "var(--n-text-disabled)" }}>INSCRIPTIONS</p>
          <p className="n-font-data" style={{ fontSize: "36px", fontWeight: 700, color: "var(--n-text-display)", marginTop: "4px" }}>
            {totalRegistrations}
          </p>
        </div>
      </div>

      {/* Search */}
      <div style={{ position: "relative" }}>
        <Search
          className="h-4 w-4"
          style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--n-text-disabled)" }}
        />
        <input
          className="n-input"
          placeholder="RECHERCHER PAR NOM, EMAIL, ENTREPRISE..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ paddingLeft: "36px", borderBottom: "1px solid var(--n-border-visible)" }}
        />
      </div>

      {/* Table */}
      <div style={{ background: "var(--n-surface)", border: "1px solid var(--n-border)", borderRadius: "12px", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--n-border-visible)" }}>
              <th style={{ textAlign: "left", padding: "12px 16px" }}><span className="n-label" style={{ color: "var(--n-text-disabled)" }}>ENTREPRISE</span></th>
              <th style={{ textAlign: "left", padding: "12px 16px" }}><span className="n-label" style={{ color: "var(--n-text-disabled)" }}>MARQUE</span></th>
              <th style={{ textAlign: "left", padding: "12px 16px" }}><span className="n-label" style={{ color: "var(--n-text-disabled)" }}>CONTACT</span></th>
              <th style={{ textAlign: "left", padding: "12px 16px" }}><span className="n-label" style={{ color: "var(--n-text-disabled)" }}>TEL</span></th>
              <th style={{ textAlign: "right", padding: "12px 16px" }}><span className="n-label" style={{ color: "var(--n-text-disabled)" }}>CUPS</span></th>
              <th style={{ textAlign: "right", padding: "12px 16px" }}><span className="n-label" style={{ color: "var(--n-text-disabled)" }}>DATE</span></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: "48px 16px" }}>
                  <span className="n-label" style={{ color: "var(--n-text-disabled)" }}>AUCUN PRODUCTEUR TROUVE</span>
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr
                  key={p.id}
                  style={{ borderBottom: "1px solid var(--n-border)", cursor: "pointer", transition: "background 150ms ease-out" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--n-surface-raised)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  onClick={() => { setSelectedProducer(p.id); setConfirmDelete(false); }}
                >
                  <td style={{ padding: "12px 16px" }}>
                    <span className="n-font-body" style={{ fontWeight: 500, color: "var(--n-text-display)" }}>{p.companyName}</span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span className="n-font-body" style={{ color: "var(--n-text-secondary)", fontSize: "14px" }}>{p.brandName}</span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span className="n-font-body" style={{ color: "var(--n-text-primary)", fontSize: "14px" }}>{p.userName}</span>
                    <br />
                    <span className="n-font-data" style={{ color: "var(--n-text-disabled)", fontSize: "12px" }}>{p.userEmail}</span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span className="n-font-data" style={{ color: "var(--n-text-secondary)", fontSize: "13px" }}>{p.phone ?? "—"}</span>
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right" }}>
                    <span className="n-font-data" style={{ fontSize: "16px", fontWeight: 700, color: p.cups.length > 0 ? "var(--n-text-display)" : "var(--n-text-disabled)" }}>
                      {p.cups.length || "—"}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right" }}>
                    <span className="n-font-data" style={{ color: "var(--n-text-disabled)", fontSize: "12px" }}>
                      {new Date(p.createdAt).toLocaleDateString("fr-FR")}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Detail Panel (overlay) */}
      {selectedProducer && selected && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", justifyContent: "flex-end" }}>
          <div
            style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.8)" }}
            onClick={() => { setSelectedProducer(null); setConfirmDelete(false); }}
          />
          <div style={{ position: "relative", width: "100%", maxWidth: "420px", background: "var(--n-surface)", borderLeft: "1px solid var(--n-border)", overflowY: "auto", padding: "24px" }}>
            {/* Close */}
            <button
              onClick={() => { setSelectedProducer(null); setConfirmDelete(false); }}
              style={{ position: "absolute", top: "16px", right: "16px", color: "var(--n-text-disabled)", background: "none", border: "none", cursor: "pointer" }}
            >
              <X className="h-5 w-5" strokeWidth={1.5} />
            </button>

            {/* Name */}
            <h2 className="n-font-body" style={{ fontSize: "20px", fontWeight: 500, color: "var(--n-text-display)", marginBottom: "32px", paddingRight: "32px" }}>
              {selected.companyName}
            </h2>

            {/* Info rows */}
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {[
                { label: "MARQUE", value: selected.brandName },
                { label: "CONTACT", value: selected.userName },
                { label: "INSCRIT LE", value: new Date(selected.createdAt).toLocaleDateString("fr-FR") },
              ].map((row) => (
                <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "12px", borderBottom: "1px solid var(--n-border)" }}>
                  <span className="n-label" style={{ color: "var(--n-text-disabled)" }}>{row.label}</span>
                  <span className="n-font-data" style={{ color: "var(--n-text-primary)", fontSize: "13px" }}>{row.value}</span>
                </div>
              ))}

              {/* Email */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "12px", borderBottom: "1px solid var(--n-border)" }}>
                <span className="n-label" style={{ color: "var(--n-text-disabled)" }}>EMAIL</span>
                <a href={`mailto:${selected.userEmail}`} style={{ color: "var(--n-interactive)", fontSize: "13px", fontFamily: "'Space Mono', monospace" }}>
                  {selected.userEmail}
                </a>
              </div>

              {/* Phone */}
              {selected.phone && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "12px", borderBottom: "1px solid var(--n-border)" }}>
                  <span className="n-label" style={{ color: "var(--n-text-disabled)" }}>TELEPHONE</span>
                  <span className="n-font-data" style={{ color: "var(--n-text-primary)", fontSize: "13px" }}>{selected.phone}</span>
                </div>
              )}

              {/* Website */}
              {selected.website && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "12px", borderBottom: "1px solid var(--n-border)" }}>
                  <span className="n-label" style={{ color: "var(--n-text-disabled)" }}>SITE WEB</span>
                  <a href={selected.website} target="_blank" rel="noopener noreferrer" style={{ color: "var(--n-interactive)", fontSize: "13px", fontFamily: "'Space Mono', monospace" }}>
                    VISITER &gt;
                  </a>
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: "8px", marginTop: "32px" }}>
              <a
                href={`mailto:${selected.userEmail}`}
                className="n-btn-secondary"
                style={{ flex: 1, fontSize: "11px", padding: "10px 16px", minHeight: "40px" }}
              >
                <Mail className="h-4 w-4" style={{ marginRight: "8px" }} />
                EMAIL
              </a>
              {!confirmDelete ? (
                <button
                  className="n-btn-destructive"
                  style={{ fontSize: "11px", padding: "10px 16px", minHeight: "40px" }}
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : (
                <button
                  className="n-btn-destructive"
                  style={{ fontSize: "11px", padding: "10px 16px", minHeight: "40px", background: "var(--n-accent)", color: "var(--n-text-display)", border: "none" }}
                  disabled={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate({ producerId: selected.id })}
                >
                  {deleteMutation.isPending ? "[...]" : "CONFIRMER"}
                </button>
              )}
            </div>

            {/* Cups */}
            <div style={{ marginTop: "32px" }}>
              <p className="n-label" style={{ color: "var(--n-text-disabled)", marginBottom: "12px" }}>
                CUPS PARTICIPEES ({selected.cups.length})
              </p>
              {selected.cups.length === 0 ? (
                <p className="n-label" style={{ color: "var(--n-text-disabled)" }}>AUCUNE PARTICIPATION</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  {selected.cups.map((cup) => (
                    <div key={cup.id} style={{ padding: "10px 12px", borderBottom: "1px solid var(--n-border)" }}>
                      <span className="n-font-body" style={{ color: "var(--n-text-primary)", fontSize: "14px" }}>{cup.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
