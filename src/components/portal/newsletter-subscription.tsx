"use client";

import { useState } from "react";
import { Mail, Loader2, CheckCircle } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { api } from "~/trpc/react";

export function NewsletterSubscription() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState("");

  const subscribeMutation = api.newsletter.subscribe.useMutation({
    onSuccess: (data) => {
      setSuccess(true);
      setMessage(data.message);
      setEmail("");
      setName("");
    },
    onError: (error) => {
      setMessage(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    subscribeMutation.mutate({
      email,
      name: name || undefined,
    });
  };

  if (success) {
    return (
      <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
        <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
        <p className="text-sm text-green-700 dark:text-green-300">{message}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          type="email"
          placeholder="Votre email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="flex-1"
        />
        <Input
          type="text"
          placeholder="Votre nom (optionnel)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1"
        />
        <Button type="submit" disabled={subscribeMutation.isPending}>
          {subscribeMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Mail className="mr-2 h-4 w-4" />
              S'inscrire
            </>
          )}
        </Button>
      </div>
      {message && !success && (
        <p className="text-sm text-destructive">{message}</p>
      )}
      <p className="text-xs text-muted-foreground">
        En vous inscrivant, vous acceptez de recevoir nos actualités par email.
        Vous pouvez vous désinscrire à tout moment.
      </p>
    </form>
  );
}

/**
 * Compact inline version for footer
 */
export function NewsletterSubscriptionInline() {
  const [email, setEmail] = useState("");
  const [success, setSuccess] = useState(false);

  const subscribeMutation = api.newsletter.subscribe.useMutation({
    onSuccess: () => {
      setSuccess(true);
      setEmail("");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    subscribeMutation.mutate({
      email,
    });
  };

  if (success) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-500">
        <CheckCircle className="h-4 w-4" />
        <span>Merci pour votre inscription !</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        type="email"
        placeholder="Votre email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        className="max-w-[200px]"
      />
      <Button type="submit" size="sm" disabled={subscribeMutation.isPending}>
        {subscribeMutation.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          "OK"
        )}
      </Button>
    </form>
  );
}
