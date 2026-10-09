"use client";

import { useState } from "react";
import { Mail, MoreHorizontal, RefreshCw, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { api, type RouterOutputs } from "~/trpc/react";
import { ConfirmDialog } from "./juror-dialogs";
import { EmptyState, ErrorState, LoadingState, TagBadge, useInvalidateJury } from "./shared";

type Invitation = RouterOutputs["jury"]["listInvitations"][number];

/** Statut effectif : une invitation en attente passée sa date est expirée. */
export function effectiveInvitationStatus(inv: Pick<Invitation, "status" | "expiresAt">): string {
  if (inv.status === "pending" && new Date(inv.expiresAt) < new Date()) return "expired";
  return inv.status;
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  pending: { label: "EN ATTENTE", color: "var(--n-warning)" },
  accepted: { label: "ACCEPTÉE", color: "var(--n-success)" },
  declined: { label: "REFUSÉE", color: "var(--n-accent)" },
  expired: { label: "EXPIRÉE", color: "var(--n-text-disabled)" },
};

const fmtDate = (d: Date | string | null | undefined) => (d ? new Date(d).toLocaleDateString("fr-FR") : "-");

/** Onglet « Invitations » : invitations e-mail du jury pro. */
export function InvitationsTab({ cupId, onInvite }: { cupId: string; onInvite: () => void }) {
  const invalidate = useInvalidateJury(cupId);
  const [cancelId, setCancelId] = useState<string | null>(null);

  const { data: invitations, isLoading, isError, refetch } = api.jury.listInvitations.useQuery({ cupId, status: "all" });
  const { data: stats } = api.jury.getInvitationStats.useQuery({ cupId });

  const resendMutation = api.jury.resendInvitation.useMutation({
    onSuccess: (data) => {
      toast.success(data.reinvited ? "Invitation rouverte : nouveau lien envoyé (14 jours)" : "Relance envoyée");
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const cancelMutation = api.jury.cancelInvitation.useMutation({
    onSuccess: () => {
      toast.success("Invitation annulée");
      setCancelId(null);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) return <LoadingState minHeight={300} />;
  if (isError) {
    return <ErrorState message="LES INVITATIONS N'ONT PAS PU ÊTRE CHARGÉES" onRetry={() => void refetch()} />;
  }

  return (
    <div className="n-card overflow-hidden" style={{ padding: 0 }}>
      <div className="flex flex-col gap-3 border-b border-[var(--n-border-visible)] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-[var(--n-text-secondary)]" aria-hidden />
          <div>
            <h2 className="n-font-body font-semibold text-[var(--n-text-primary)]">Invitations e-mail</h2>
            <p className="n-label">Jury professionnel · une invitation expirée peut être renvoyée</p>
          </div>
        </div>
        {stats && (
          <div className="flex flex-wrap gap-2">
            <span className="n-tag" style={{ padding: "2px 10px" }}>{stats.total} AU TOTAL</span>
            <span className="n-tag" style={{ padding: "2px 10px", borderColor: "var(--n-warning)", color: "var(--n-warning)" }}>
              {stats.pending} EN ATTENTE
            </span>
            <span className="n-tag success" style={{ padding: "2px 10px" }}>{stats.accepted} ACCEPTÉES</span>
          </div>
        )}
      </div>

      <div className="p-4">
        {!invitations || invitations.length === 0 ? (
          <EmptyState
            icon={<Mail className="h-8 w-8" />}
            title="Aucune invitation envoyée"
            hint="Invitez des jurés pro par e-mail, un par un ou par CSV"
            action={
              <Button size="sm" onClick={onInvite} className="n-label">
                <UserPlus className="mr-2 h-4 w-4" />
                Inviter par e-mail
              </Button>
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-b border-[var(--n-border-visible)]">
                <TableHead className="n-label">E-MAIL</TableHead>
                <TableHead className="n-label">NOM</TableHead>
                <TableHead className="n-label">STATUT</TableHead>
                <TableHead className="n-label">ENVOYÉE LE</TableHead>
                <TableHead className="n-label">EXPIRE LE</TableHead>
                <TableHead className="w-[50px]">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invitations.map((invitation) => {
                const status = effectiveInvitationStatus(invitation);
                const meta = STATUS_META[status] ?? { label: status, color: "var(--n-text-secondary)" };
                const canResend = invitation.status === "pending" || invitation.status === "expired";
                const isExpired = status === "expired";
                return (
                  <TableRow key={invitation.id} className="border-b border-[var(--n-border)] hover:bg-[var(--n-surface-raised)]">
                    <TableCell className="n-font-body text-[var(--n-text-primary)] break-all">{invitation.email}</TableCell>
                    <TableCell className="n-font-body text-[var(--n-text-secondary)]">
                      {invitation.firstName || invitation.lastName
                        ? `${invitation.firstName ?? ""} ${invitation.lastName ?? ""}`.trim()
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <TagBadge color={meta.color}>{meta.label}</TagBadge>
                    </TableCell>
                    <TableCell>
                      <span className="n-font-data text-xs text-[var(--n-text-secondary)]">{fmtDate(invitation.sentAt)}</span>
                    </TableCell>
                    <TableCell>
                      <span className="n-font-data text-xs text-[var(--n-text-secondary)]">{fmtDate(invitation.expiresAt)}</span>
                    </TableCell>
                    <TableCell>
                      {canResend && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label={`Actions pour ${invitation.email}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => resendMutation.mutate({ invitationId: invitation.id })}
                              disabled={resendMutation.isPending}
                            >
                              <RefreshCw className="mr-2 h-4 w-4" />
                              {isExpired ? "Réinviter" : "Relancer"}
                            </DropdownMenuItem>
                            {invitation.status === "pending" && (
                              <DropdownMenuItem style={{ color: "var(--n-accent)" }} onClick={() => setCancelId(invitation.id)}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Annuler l&apos;invitation
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <ConfirmDialog
        open={!!cancelId}
        onCancel={() => setCancelId(null)}
        title="Annuler l'invitation ?"
        description="Action irréversible : l'invitation sera supprimée et ne pourra plus être acceptée."
        confirmLabel="Confirmer"
        destructive
        pending={cancelMutation.isPending}
        onConfirm={() => cancelId && cancelMutation.mutate({ invitationId: cancelId })}
      />
    </div>
  );
}
