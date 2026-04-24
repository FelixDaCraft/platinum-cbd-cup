"use client";

import { Button } from "~/components/ui/button";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, AlertCircle, Lock, AlertTriangle, Play, CheckCircle } from "lucide-react";
import type { CupStatus } from "~/server/db/schema/cups";
import { Alert, AlertDescription } from "~/components/ui/alert";

interface PublishCupButtonProps {
  cupId: string;
  status: CupStatus;
}

export function PublishCupButton({ cupId, status }: PublishCupButtonProps) {
  const utils = api.useUtils();

  // Pre-check publication status for draft cups
  const { data: publishStatus, isLoading: isCheckingStatus } = api.cup.getPublishStatus.useQuery(
    { cupId },
    { enabled: status === "draft" }
  );

  const publishMutation = api.cup.publish.useMutation({
    onSuccess: () => {
      toast.success("Cup publiée avec succès");
      void utils.cup.getById.invalidate({ id: cupId });
      void utils.cup.list.invalidate();
      void utils.cup.getPublishStatus.invalidate({ cupId });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const unpublishMutation = api.cup.unpublish.useMutation({
    onSuccess: () => {
      toast.success("Cup dépubliée");
      void utils.cup.getById.invalidate({ id: cupId });
      void utils.cup.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const closeRegistrationsMutation = api.cup.closeRegistrations.useMutation({
    onSuccess: () => {
      toast.success("Inscriptions clôturées");
      void utils.cup.getById.invalidate({ id: cupId });
      void utils.cup.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const startRatingMutation = api.cup.startRating.useMutation({
    onSuccess: () => {
      toast.success("Phase de notation démarrée");
      void utils.cup.getById.invalidate({ id: cupId });
      void utils.cup.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const closeRatingMutation = api.cup.closeRating.useMutation({
    onSuccess: () => {
      toast.success("Notation clôturée - Compétition terminée");
      void utils.cup.getById.invalidate({ id: cupId });
      void utils.cup.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const isPending = publishMutation.isPending || unpublishMutation.isPending || closeRegistrationsMutation.isPending || startRatingMutation.isPending || closeRatingMutation.isPending;

  if (status === "draft") {
    const canPublish = publishStatus?.canPublish ?? false;
    const errors = publishStatus?.errors ?? [];
    const warnings = publishStatus?.warnings ?? [];
    const isDisabled = isPending || isCheckingStatus || !canPublish;

    // Show tooltip with errors if can't publish
    if (!canPublish && errors.length > 0) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button disabled className="pointer-events-auto">
                  <AlertCircle className="mr-2 h-4 w-4" />
                  Publier
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs">
              <p className="font-medium mb-1">Configuration requise :</p>
              <ul className="list-disc list-inside text-sm">
                {errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    // Show confirmation dialog with warnings if there are any
    if (warnings.length > 0) {
      return (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button disabled={isDisabled}>
              {isPending || isCheckingStatus ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <>
                  <AlertTriangle className="mr-2 h-4 w-4 text-amber-500" />
                  Publier
                </>
              )}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Publier avec avertissements ?</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  <p>Votre cup peut etre publiee, mais il y a des avertissements :</p>
                  <Alert variant="default" className="border-amber-500 bg-amber-50 dark:bg-amber-950">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <AlertDescription>
                      <ul className="list-disc list-inside text-sm">
                        {warnings.map((warning, index) => (
                          <li key={index}>{warning}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => publishMutation.mutate({ cupId })}
              >
                Publier quand meme
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      );
    }

    return (
      <Button
        onClick={() => publishMutation.mutate({ cupId })}
        disabled={isDisabled}
      >
        {isPending || isCheckingStatus ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Eye className="mr-2 h-4 w-4" />
        )}
        Publier
      </Button>
    );
  }

  if (status === "published") {
    return (
      <div className="flex gap-2">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" disabled={isPending}>
              {unpublishMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <EyeOff className="mr-2 h-4 w-4" />
              )}
              Dépublier
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Dépublier cette cup ?</AlertDialogTitle>
              <AlertDialogDescription>
                Cette action rendra votre cup invisible au public.
                Les inscriptions existantes seront conservées.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => unpublishMutation.mutate({ cupId })}
              >
                Dépublier
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button disabled={isPending}>
              {closeRegistrationsMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Lock className="mr-2 h-4 w-4" />
              )}
              Clôturer les inscriptions
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clôturer les inscriptions ?</AlertDialogTitle>
              <AlertDialogDescription>
                Cette action empêchera toute nouvelle inscription à la cup.
                Les inscriptions existantes seront conservées.
                Vous pourrez ensuite passer à la phase de notation.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => closeRegistrationsMutation.mutate({ cupId })}
              >
                Clôturer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  if (status === "registration_closed") {
    return (
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button disabled={isPending}>
            {startRatingMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-2 h-4 w-4" />
            )}
            Démarrer la notation
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Démarrer la phase de notation ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action permettra aux jurys de commencer à noter les produits.
              Assurez-vous que tous les produits ont été reçus et que les jurys sont prêts.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => startRatingMutation.mutate({ cupId })}
            >
              Démarrer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  if (status === "rating") {
    return (
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button disabled={isPending}>
            {closeRatingMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle className="mr-2 h-4 w-4" />
            )}
            Clôturer la notation
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clôturer la phase de notation ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action mettra fin à la notation. Aucune nouvelle note ne pourra être soumise.
              Les scores finaux seront calculés et la compétition sera marquée comme terminée.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => closeRatingMutation.mutate({ cupId })}
            >
              Clôturer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  // Status is completed - no action available
  return null;
}
