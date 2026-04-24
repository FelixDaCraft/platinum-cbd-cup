"use client";

import { useState, useMemo } from "react";
import {
  Search,
  Mail,
  Trash2,
} from "lucide-react";

import { Input } from "~/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";

export default function JuriesPage() {
  const [search, setSearch] = useState("");
  const [selectedJury, setSelectedJury] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const utils = api.useUtils();
  const { data: juries, isLoading } = api.jury.listByOrganization.useQuery();

  const deleteMutation = api.jury.deleteByOrganization.useMutation({
    onSuccess: () => {
      setSelectedJury(null);
      setConfirmDelete(false);
      void utils.jury.listByOrganization.invalidate();
    },
  });

  const filtered = useMemo(() => {
    if (!juries) return [];
    if (!search.trim()) return juries;
    const q = search.toLowerCase();
    return juries.filter(
      (j) =>
        (j.userName ?? "").toLowerCase().includes(q) ||
        (j.userEmail ?? "").toLowerCase().includes(q) ||
        (j.expertise ?? "").toLowerCase().includes(q)
    );
  }, [juries, search]);

  const selected = useMemo(
    () => (juries ?? []).find((j) => j.id === selectedJury) ?? null,
    [juries, selectedJury]
  );

  const proCount = useMemo(
    () => (juries ?? []).filter((j) => j.juryType === "pro").length,
    [juries]
  );
  const publicCount = (juries?.length ?? 0) - proCount;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <span style={{ fontFamily: "'Space Mono', monospace", color: "var(--n-text-secondary)" }}>[LOADING...]</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 style={{ fontFamily: "'Doto', 'Space Mono', monospace", fontSize: "20px", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 700, color: "var(--n-text-display)" }}>Jurys</h1>
          <p className="n-label" style={{ marginTop: "4px", color: "var(--n-text-secondary)" }}>
            TOUS LES JURYS DE VOTRE ORGANISATION
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="n-card p-4">
          <p className="n-label" style={{ fontSize: "10px", color: "var(--n-text-secondary)" }}>TOTAL JURYS</p>
          <p className="n-font-data text-2xl font-bold mt-1" style={{ color: "var(--n-text-primary)" }}>{juries?.length ?? 0}</p>
        </div>
        <div className="n-card p-4">
          <p className="n-label" style={{ fontSize: "10px", color: "var(--n-text-secondary)" }}>PRO</p>
          <p className="n-font-data text-2xl font-bold mt-1" style={{ color: "var(--n-text-primary)" }}>{proCount}</p>
        </div>
        <div className="n-card p-4">
          <p className="n-label" style={{ fontSize: "10px", color: "var(--n-text-secondary)" }}>PUBLIC</p>
          <p className="n-font-data text-2xl font-bold mt-1" style={{ color: "var(--n-text-primary)" }}>{publicCount}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "var(--n-text-secondary)" }} />
        <Input
          placeholder="Rechercher par nom, email, expertise..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Table */}
      <div className="n-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow style={{ borderBottom: "1px solid var(--n-border)" }}>
              <TableHead><span className="n-label" style={{ fontSize: "10px", color: "var(--n-text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em" }}>NOM</span></TableHead>
              <TableHead><span className="n-label" style={{ fontSize: "10px", color: "var(--n-text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em" }}>EMAIL</span></TableHead>
              <TableHead><span className="n-label" style={{ fontSize: "10px", color: "var(--n-text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em" }}>TYPE</span></TableHead>
              <TableHead><span className="n-label" style={{ fontSize: "10px", color: "var(--n-text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em" }}>EXPERTISE</span></TableHead>
              <TableHead><span className="n-label" style={{ fontSize: "10px", color: "var(--n-text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em" }}>CUPS</span></TableHead>
              <TableHead><span className="n-label" style={{ fontSize: "10px", color: "var(--n-text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em" }}>DATE</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center py-12"
                  style={{ fontFamily: "'Space Mono', monospace", color: "var(--n-text-secondary)" }}
                >
                  [AUCUN JURY TROUVE]
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((j) => (
                <TableRow
                  key={j.id}
                  className="cursor-pointer"
                  onClick={() => {
                    setSelectedJury(j.id);
                    setConfirmDelete(false);
                  }}
                >
                  <TableCell className="n-font-body font-medium" style={{ color: "var(--n-text-primary)" }}>
                    {j.userName ?? "—"}
                  </TableCell>
                  <TableCell className="n-label" style={{ color: "var(--n-text-secondary)" }}>{j.userEmail}</TableCell>
                  <TableCell>
                    <span className="n-tag" style={j.juryType === "pro" ? { color: "var(--n-accent)", borderColor: "var(--n-accent)" } : { color: "var(--n-text-secondary)" }}>
                      {j.juryType === "pro" ? "PRO" : "PUBLIC"}
                    </span>
                  </TableCell>
                  <TableCell className="n-label" style={{ color: "var(--n-text-secondary)" }}>
                    {j.expertise ?? "—"}
                  </TableCell>
                  <TableCell>
                    {j.cups.length > 0 ? (
                      <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "14px", fontWeight: 600, color: "var(--n-text-primary)" }}>{j.cups.length}</span>
                    ) : (
                      <span className="n-label" style={{ color: "var(--n-text-secondary)" }}>—</span>
                    )}
                  </TableCell>
                  <TableCell style={{ fontFamily: "'Space Mono', monospace", fontSize: "14px", color: "var(--n-text-secondary)" }}>
                    {new Date(j.createdAt).toLocaleDateString("fr-FR")}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Detail Sheet */}
      <Sheet
        open={!!selectedJury}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedJury(null);
            setConfirmDelete(false);
          }
        }}
      >
        <SheetContent className="w-full sm:max-w-md overflow-y-auto p-6">
          <SheetHeader className="pr-6">
            <SheetTitle className="n-font-body truncate">
              {selected?.userName ?? "Jury"}
            </SheetTitle>
          </SheetHeader>

          {selected && (
            <div className="mt-6 space-y-6">
              {/* Info */}
              <div className="space-y-3">
                <div className="flex justify-between gap-4">
                  <span className="n-label shrink-0" style={{ color: "var(--n-text-secondary)" }}>NOM</span>
                  <span className="n-font-body text-right truncate" style={{ color: "var(--n-text-primary)" }}>{selected.userName ?? "—"}</span>
                </div>
                <div className="flex justify-between items-center gap-4">
                  <span className="n-label shrink-0" style={{ color: "var(--n-text-secondary)" }}>EMAIL</span>
                  <a
                    href={`mailto:${selected.userEmail}`}
                    className="flex items-center gap-1 truncate"
                    style={{ color: "var(--n-accent)" }}
                  >
                    <Mail className="h-3 w-3 shrink-0" />
                    <span className="n-label truncate">{selected.userEmail}</span>
                  </a>
                </div>
                <div className="flex justify-between items-center gap-4">
                  <span className="n-label shrink-0" style={{ color: "var(--n-text-secondary)" }}>TYPE</span>
                  <span className="n-tag" style={selected.juryType === "pro" ? { color: "var(--n-accent)", borderColor: "var(--n-accent)" } : { color: "var(--n-text-secondary)" }}>
                    {selected.juryType === "pro" ? "PRO" : "PUBLIC"}
                  </span>
                </div>
                {selected.expertise && (
                  <div className="flex justify-between gap-4">
                    <span className="n-label shrink-0" style={{ color: "var(--n-text-secondary)" }}>EXPERTISE</span>
                    <span className="n-label text-right truncate" style={{ color: "var(--n-text-primary)" }}>{selected.expertise}</span>
                  </div>
                )}
                <div className="flex justify-between gap-4">
                  <span className="n-label shrink-0" style={{ color: "var(--n-text-secondary)" }}>INSCRIT LE</span>
                  <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "14px", color: "var(--n-text-primary)" }}>
                    {new Date(selected.createdAt).toLocaleDateString("fr-FR")}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 n-btn-secondary" asChild>
                  <a href={`mailto:${selected.userEmail}`}>
                    <Mail className="mr-2 h-4 w-4" />
                    Envoyer un email
                  </a>
                </Button>
                {!confirmDelete ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="n-btn-secondary"
                    style={{ color: "var(--n-warning)", borderColor: "var(--n-warning)" }}
                    onClick={() => setConfirmDelete(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="n-btn-secondary"
                    style={{ color: "var(--n-warning)", borderColor: "var(--n-warning)" }}
                    disabled={deleteMutation.isPending}
                    onClick={() =>
                      deleteMutation.mutate({ juryProfileId: selected.id })
                    }
                  >
                    {deleteMutation.isPending ? <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "12px" }}>[...]</span> : "Confirmer"}
                  </Button>
                )}
              </div>

              {/* Cups participated */}
              <div>
                <p style={{ fontFamily: "'Doto', 'Space Mono', monospace", fontSize: "12px", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--n-text-display)", fontWeight: 700, marginBottom: "12px" }}>
                  Cups participees{" "}
                  <span style={{ fontFamily: "'Space Mono', monospace", fontWeight: 400 }}>({selected.cups.length})</span>
                </p>
                {selected.cups.length === 0 ? (
                  <p className="n-label" style={{ color: "var(--n-text-secondary)", fontFamily: "'Space Mono', monospace" }}>
                    [AUCUNE PARTICIPATION]
                  </p>
                ) : (
                  <div className="space-y-2">
                    {selected.cups.map((cup) => (
                      <div
                        key={cup.id}
                        className="n-card p-3 flex items-center gap-2"
                      >
                        <span className="n-label truncate">{cup.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
