"use client";

import { useState } from "react";
import { Send, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { api } from "~/trpc/react";
import { useInvalidateJury } from "./shared";

/** Invitation e-mail d'un juré pro (nouvelle personne). */
export function InviteEmailForm({
  cupId,
  onDone,
  onOpenCsvImport,
}: {
  cupId: string;
  onDone: () => void;
  onOpenCsvImport: () => void;
}) {
  const invalidate = useInvalidateJury(cupId);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [message, setMessage] = useState("");

  const inviteMutation = api.jury.invite.useMutation({
    onSuccess: (data) => {
      if (data.reinvited) {
        toast.success("Invitation expirée rouverte : nouveau lien envoyé");
      } else if (data.alreadyInvited) {
        toast.info("Invitation renvoyée");
      } else {
        toast.success("Invitation envoyée");
      }
      setEmail("");
      setFirstName("");
      setLastName("");
      setMessage("");
      invalidate();
      onDone();
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!email) return;
        inviteMutation.mutate({
          cupId,
          email: email.trim(),
          firstName: firstName.trim() || undefined,
          lastName: lastName.trim() || undefined,
          customMessage: message.trim() || undefined,
        });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="invite-email" className="n-label">E-MAIL *</Label>
        <Input
          id="invite-email"
          type="email"
          required
          placeholder="jure@exemple.fr"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="invite-first-name" className="n-label">PRÉNOM</Label>
          <Input id="invite-first-name" placeholder="Jean" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="invite-last-name" className="n-label">NOM</Label>
          <Input id="invite-last-name" placeholder="Dupont" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="invite-message" className="n-label">MESSAGE PERSONNALISÉ (OPTIONNEL)</Label>
        <Textarea
          id="invite-message"
          placeholder="Nous serions honorés de vous compter parmi le jury…"
          value={message}
          maxLength={500}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
        />
      </div>
      <p className="n-label" style={{ textTransform: "none", letterSpacing: "0.02em" }}>
        Lien personnel valable 14 jours, renvoyable même expiré. Une fois l&apos;invitation acceptée, affectez ses
        catégories depuis l&apos;onglet « Par juré ».
      </p>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Button type="button" variant="outline" onClick={onOpenCsvImport} className="n-label">
          <Upload className="mr-2 h-4 w-4" />
          Importer un CSV
        </Button>
        <Button type="submit" disabled={!email || inviteMutation.isPending} className="n-label">
          {inviteMutation.isPending ? "[...]" : <Send className="mr-2 h-4 w-4" />}
          Envoyer l&apos;invitation
        </Button>
      </div>
    </form>
  );
}
