"use client";

import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle, Package, ArrowRight, Loader2, XCircle } from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { api } from "~/trpc/react";

export default function PortalRegistrationSuccessPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const cupId = params.cupId as string;
  const sessionId = searchParams.get("session_id");

  // Get registration to verify it's confirmed
  const { data: registrations, isLoading } = api.registration.listMyRegistrations.useQuery();

  // Find the registration for this cup
  const registration = registrations?.find((r) => r.cup.id === cupId);

  // Loading state
  if (isLoading) {
    return (
      <div className="container mx-auto py-12 px-4">
        <Card className="max-w-lg mx-auto">
          <CardContent className="py-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">Verification du paiement...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Registration not confirmed yet (webhook may not have processed)
  if (!registration || registration.status !== "confirmed") {
    // If we have a session_id, payment might still be processing
    if (sessionId) {
      return (
        <div className="container mx-auto py-12 px-4">
          <Card className="max-w-lg mx-auto">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
                <Loader2 className="h-10 w-10 text-amber-600 animate-spin" />
              </div>
              <CardTitle className="text-2xl">Paiement en cours de traitement</CardTitle>
              <CardDescription className="text-base">
                Votre paiement est en cours de verification. Cette page se mettra a jour automatiquement.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-sm text-muted-foreground text-center">
                Si cette page ne se met pas a jour dans quelques secondes, veuillez rafraichir ou contacter le support.
              </p>
              <div className="flex flex-col gap-3">
                <Button onClick={() => window.location.reload()} variant="outline" className="w-full">
                  Rafraichir la page
                </Button>
                <Link href={`/cups/${cupId}/register`}>
                  <Button variant="ghost" className="w-full">
                    Retour a l&apos;inscription
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    // No session_id and no confirmed registration
    return (
      <div className="container mx-auto py-12 px-4">
        <Card className="max-w-lg mx-auto">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <XCircle className="h-10 w-10 text-red-600" />
            </div>
            <CardTitle className="text-2xl">Inscription non trouvee</CardTitle>
            <CardDescription className="text-base">
              Aucune inscription confirmee n&apos;a ete trouvee pour cette cup.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href={`/cups/${cupId}/register`}>
              <Button className="w-full">S&apos;inscrire a la cup</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success - registration is confirmed
  return (
    <div className="container mx-auto py-12 px-4">
      <Card className="max-w-lg mx-auto">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle className="h-10 w-10 text-green-600" />
          </div>
          <CardTitle className="text-2xl">Inscription confirmee !</CardTitle>
          <CardDescription className="text-base">
            Votre inscription a {registration.cup.name} a ete enregistree avec succes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg bg-muted p-4 space-y-3">
            <div className="flex items-start gap-3">
              <Package className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">Prochaine etape</p>
                <p className="text-sm text-muted-foreground">
                  Vous recevrez prochainement un email avec les instructions pour
                  l&apos;envoi de vos echantillons.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-medium">{registration.productCount} produit(s) inscrit(s)</p>
                <p className="text-sm text-muted-foreground">
                  Vous pouvez consulter l&apos;etat de votre inscription a tout
                  moment depuis votre espace producteur.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Link href={`/cups/${cupId}`}>
              <Button className="w-full" size="lg">
                Voir la cup
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
            <Link href="/producer">
              <Button variant="outline" className="w-full">
                Espace producteur
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
