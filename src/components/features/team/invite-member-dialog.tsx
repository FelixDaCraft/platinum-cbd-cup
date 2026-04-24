"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { api } from "~/trpc/react";
import { roleConfig, type OrganizationRole } from "~/lib/permissions";

type AssignableRole = "admin" | "member" | "writer";

const inviteSchema = z.object({
  email: z.string().email("Email invalide"),
  role: z.enum(["admin", "member", "writer"]),
});

type InviteFormValues = z.infer<typeof inviteSchema>;

interface InviteMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignableRoles: OrganizationRole[];
}

export function InviteMemberDialog({
  open,
  onOpenChange,
  assignableRoles,
}: InviteMemberDialogProps) {
  const utils = api.useUtils();

  // Filter out 'owner' since it can't be assigned
  const validRoles = assignableRoles.filter(
    (r): r is AssignableRole => r !== "owner"
  );
  const defaultRole: AssignableRole = validRoles[0] ?? "member";

  const form = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: "",
      role: defaultRole,
    },
  });

  const inviteMutation = api.team.invite.useMutation({
    onSuccess: () => {
      toast.success("Invitation envoyée");
      void utils.team.getInvitations.invalidate();
      form.reset();
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const onSubmit = (values: InviteFormValues) => {
    inviteMutation.mutate(values);
  };

  // Use the valid filtered roles
  const filteredRoles = validRoles;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Inviter un membre</DialogTitle>
          <DialogDescription>
            Envoyez une invitation par email pour ajouter un nouveau membre à
            votre organisation.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="collegue@example.com"
                      type="email"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rôle</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un rôle" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {filteredRoles.map((role) => {
                        const config = roleConfig[role];
                        return (
                          <SelectItem key={role} value={role}>
                            <div className="flex flex-col">
                              <span className={config.color}>{config.label}</span>
                              <span className="text-xs text-muted-foreground">
                                {config.description}
                              </span>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {form.watch("role") === "writer" ? (
                      <span className="text-amber-500">
                        Les rédacteurs ont uniquement accès à la gestion des
                        articles.
                      </span>
                    ) : (
                      "Le rôle détermine les permissions du membre."
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={inviteMutation.isPending}>
                {inviteMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Envoyer l'invitation
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
