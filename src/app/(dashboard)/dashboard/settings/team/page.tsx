"use client";

import { useState } from "react";
import { UserPlus, Clock, MoreHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { api } from "~/trpc/react";
import { InviteMemberDialog } from "~/components/features/team/invite-member-dialog";
import { roleConfig, type OrganizationRole } from "~/lib/permissions";

export default function TeamPage() {
  const [inviteOpen, setInviteOpen] = useState(false);

  const utils = api.useUtils();

  const { data: myRole, isLoading: isRoleLoading } = api.team.getMyRole.useQuery();
  const { data: members, isLoading: isMembersLoading } = api.team.getMembers.useQuery();
  const { data: invitations, isLoading: isInvitationsLoading } = api.team.getInvitations.useQuery();

  const updateRoleMutation = api.team.updateRole.useMutation({
    onSuccess: () => {
      toast.success("Role mis a jour");
      void utils.team.getMembers.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const removeMemberMutation = api.team.removeMember.useMutation({
    onSuccess: () => {
      toast.success("Membre retire");
      void utils.team.getMembers.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const cancelInvitationMutation = api.team.cancelInvitation.useMutation({
    onSuccess: () => {
      toast.success("Invitation annulee");
      void utils.team.getInvitations.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const isLoading = isRoleLoading || isMembersLoading || isInvitationsLoading;

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 style={{ fontFamily: "'Doto', 'Space Mono', monospace", fontSize: "20px", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 700, color: "var(--n-text-display)" }}>Equipe</h1>
          <p style={{ fontFamily: "'Space Mono', monospace", color: "var(--n-text-secondary)", marginTop: "4px" }}>[LOADING...]</p>
        </div>
      </div>
    );
  }

  const canManage = myRole?.canInvite ?? false;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 style={{ fontFamily: "'Doto', 'Space Mono', monospace", fontSize: "20px", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 700, color: "var(--n-text-display)" }}>Equipe</h1>
          <p className="n-label" style={{ marginTop: "4px", color: "var(--n-text-secondary)" }}>
            GEREZ LES MEMBRES DE VOTRE ORGANISATION
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setInviteOpen(true)} className="n-btn-primary">
            <UserPlus className="mr-2 h-4 w-4" />
            Inviter un membre
          </Button>
        )}
      </div>

      <div className="space-y-6">
        {/* Members */}
        <div className="n-card overflow-hidden">
          <div className="p-5 flex items-center justify-between" style={{ borderBottom: "1px solid var(--n-border)" }}>
            <div>
              <div className="flex items-center gap-2">
                <p style={{ fontFamily: "'Doto', 'Space Mono', monospace", fontSize: "12px", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--n-text-display)", fontWeight: 700 }}>Membres</p>
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "12px", color: "var(--n-text-secondary)" }}>({members?.length ?? 0})</span>
              </div>
              <p className="n-label mt-0.5" style={{ fontSize: "10px", color: "var(--n-text-secondary)" }}>
                LES MEMBRES DE VOTRE ORGANISATION
              </p>
            </div>
          </div>
          <div className="divide-y" style={{ borderColor: "var(--n-border)" }}>
            {members?.map((member) => {
              const role = member.role as OrganizationRole;
              const config = roleConfig[role] ?? roleConfig.member;

              return (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-4 transition-colors group"
                  style={{ cursor: "default" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "color-mix(in srgb, var(--n-surface-raised) 50%, transparent)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={member.userImage ?? undefined} />
                      <AvatarFallback style={{ fontFamily: "'Space Mono', monospace", fontSize: "12px", background: "var(--n-surface-raised)" }}>
                        {member.userName?.charAt(0).toUpperCase() ?? "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="n-font-body text-sm font-medium" style={{ color: "var(--n-text-primary)" }}>{member.userName}</p>
                      <p style={{ fontFamily: "'Space Mono', monospace", fontSize: "12px", color: "var(--n-text-secondary)" }}>
                        {member.userEmail}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {canManage && role !== "owner" ? (
                      <Select
                        value={role}
                        onValueChange={(value) =>
                          updateRoleMutation.mutate({
                            memberId: member.id,
                            role: value as "admin" | "member" | "writer",
                          })
                        }
                      >
                        <SelectTrigger className="w-[130px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {myRole?.assignableRoles.map((r) => (
                            <SelectItem key={r} value={r}>
                              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "12px" }}>
                                {roleConfig[r].label}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="n-tag" style={{ color: "var(--n-text-secondary)" }}>
                        {config.label.toUpperCase()}
                      </span>
                    )}

                    {canManage && role !== "owner" && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel className="n-label" style={{ fontSize: "10px" }}>ACTIONS</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem
                                onSelect={(e) => e.preventDefault()}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Retirer
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle className="n-font-body">
                                  Retirer ce membre ?
                                </AlertDialogTitle>
                                <AlertDialogDescription className="n-font-body">
                                  {member.userName} sera retire de l&apos;organisation.
                                  Cette action est irreversible.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="n-btn-secondary">Annuler</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() =>
                                    removeMemberMutation.mutate({
                                      memberId: member.id,
                                    })
                                  }
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Retirer
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pending Invitations */}
        {canManage && invitations && invitations.length > 0 && (
          <div className="n-card overflow-hidden">
            <div className="p-5 flex items-center justify-between" style={{ borderBottom: "1px solid var(--n-border)" }}>
              <div>
                <div className="flex items-center gap-2">
                  <p style={{ fontFamily: "'Doto', 'Space Mono', monospace", fontSize: "12px", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--n-text-display)", fontWeight: 700 }}>Invitations en attente</p>
                  <span className="n-tag" style={{ color: "var(--n-warning)", borderColor: "var(--n-warning)" }}>
                    {invitations.length}
                  </span>
                </div>
                <p className="n-label mt-0.5" style={{ fontSize: "10px", color: "var(--n-text-secondary)" }}>
                  INVITATIONS ENVOYEES EN ATTENTE D&apos;ACCEPTATION
                </p>
              </div>
            </div>
            <div className="divide-y" style={{ borderColor: "var(--n-border)" }}>
              {invitations.map((invitation) => {
                const role = invitation.role as OrganizationRole;
                const config = roleConfig[role] ?? roleConfig.member;
                const isExpired = new Date(invitation.expiresAt) < new Date();

                return (
                  <div
                    key={invitation.id}
                    className="flex items-center justify-between p-4"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback style={{ fontFamily: "'Space Mono', monospace", fontSize: "12px", background: "var(--n-surface-raised)" }}>
                          {invitation.email.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p style={{ fontFamily: "'Space Mono', monospace", fontSize: "14px", color: "var(--n-text-primary)" }}>{invitation.email}</p>
                        <div className="flex items-center gap-1.5 mt-0.5" style={{ fontFamily: "'Space Mono', monospace", fontSize: "12px", color: "var(--n-text-secondary)" }}>
                          <Clock className="h-3 w-3" />
                          {isExpired ? (
                            <span style={{ color: "var(--n-warning)" }}>EXPIREE</span>
                          ) : (
                            <span>
                              EXPIRE LE{" "}
                              {new Date(invitation.expiresAt).toLocaleDateString("fr-FR").toUpperCase()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="n-tag" style={{ color: "var(--n-text-secondary)" }}>
                        {config.label.toUpperCase()}
                      </span>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" style={{ fontFamily: "'Space Mono', monospace", fontSize: "12px", color: "var(--n-text-secondary)" }}>
                            Annuler
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle className="n-font-body">
                              Annuler l&apos;invitation ?
                            </AlertDialogTitle>
                            <AlertDialogDescription className="n-font-body">
                              L&apos;invitation pour {invitation.email} sera annulee.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="n-btn-secondary">Retour</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() =>
                                cancelInvitationMutation.mutate({
                                  id: invitation.id,
                                })
                              }
                            >
                              Annuler l&apos;invitation
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <InviteMemberDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        assignableRoles={myRole?.assignableRoles ?? []}
      />
    </div>
  );
}
