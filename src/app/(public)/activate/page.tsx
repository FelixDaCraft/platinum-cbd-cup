"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  AlertCircle,
  Trophy,
  Package,
  CheckCircle,
  LogIn,
  UserPlus,
  Clock,
  QrCode,
  Layers,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { api } from "~/trpc/react";
import { authClient } from "~/lib/auth-client";

function ActivatePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const codeFromUrl = searchParams.get("code") ?? "";

  const [inputCode, setInputCode] = useState(codeFromUrl);

  const formatCode = (value: string) => {
    const raw = value.replace(/[-\s]/g, "").toUpperCase();
    return raw.replace(/(.{3})(?=.)/g, "$1-");
  };
  const [searchCode, setSearchCode] = useState(codeFromUrl);

  // Check session
  const { data: session, isPending: sessionLoading } = authClient.useSession();

  // Get code info - only query when we have a code
  const {
    data,
    isLoading,
    error,
  } = api.juryCodes.getByCode.useQuery(
    { code: searchCode },
    { enabled: !!searchCode }
  );

  // Activate mutation
  const activateMutation = api.juryCodes.activate.useMutation({
    onSuccess: (result) => {
      localStorage.removeItem("pendingActivationCode");
      toast.success("Code active!", {
        description: `Vous avez maintenant acces a ${result.categoriesCount} categorie${result.categoriesCount !== 1 ? "s" : ""}`,
      });
      // Redirect to jury cup page
      router.push(`/jury/cups/${result.cupId}`);
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  // Update searchCode when URL changes
  useEffect(() => {
    if (codeFromUrl) {
      setInputCode(codeFromUrl);
      setSearchCode(codeFromUrl);
    }
  }, [codeFromUrl]);

  const handleSearchCode = () => {
    const normalizedCode = inputCode.trim().toUpperCase();
    if (!normalizedCode) {
      toast.error("Veuillez entrer un code");
      return;
    }
    setSearchCode(normalizedCode);
  };

  const handleActivate = () => {
    if (!searchCode) return;
    activateMutation.mutate({ code: searchCode });
  };

  const callbackUrl = searchCode ? `/activate?code=${searchCode}` : "/activate";

  // Persist activation code so login can redirect back here even if callbackUrl is lost
  useEffect(() => {
    if (searchCode) {
      localStorage.setItem("pendingActivationCode", searchCode);
    }
  }, [searchCode]);

  // Loading state
  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/20">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-muted-foreground">Chargement...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // No code yet - show entry form
  if (!searchCode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/20 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 rounded-full bg-primary/10 p-3 w-fit">
              <QrCode className="h-8 w-8 text-primary" />
            </div>
            <CardTitle>Activer un code d&apos;invitation</CardTitle>
            <CardDescription>
              Entrez le code d&apos;invitation que vous avez recu pour devenir jury
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Code d&apos;invitation</Label>
              <Input
                id="code"
                placeholder="XXX-XXX-XXX"
                value={inputCode}
                onChange={(e) => setInputCode(formatCode(e.target.value))}
                className="text-center font-mono text-lg tracking-wider"
                onKeyDown={(e) => e.key === "Enter" && handleSearchCode()}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button className="w-full" onClick={handleSearchCode}>
              Verifier le code
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Loading code info
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/20">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-muted-foreground">Verification du code...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/20 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 rounded-full bg-destructive/10 p-3 w-fit">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle>Code invalide</CardTitle>
            <CardDescription>{error.message}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="code-retry">Essayer un autre code</Label>
              <Input
                id="code-retry"
                placeholder="XXX-XXX-XXX"
                value={inputCode}
                onChange={(e) => setInputCode(formatCode(e.target.value))}
                className="text-center font-mono text-lg tracking-wider"
                onKeyDown={(e) => e.key === "Enter" && handleSearchCode()}
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button className="w-full" onClick={handleSearchCode}>
              Verifier le code
            </Button>
            <Link href="/" className="w-full">
              <Button variant="outline" className="w-full">
                Retour a l&apos;accueil
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Invalid code (expired, already activated, revoked)
  if (data && !data.valid) {
    const isExpired = data.reason === "expired";
    const isActivated = data.reason === "already_activated";
    const isRevoked = data.reason === "revoked";

    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/20 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className={`mx-auto mb-4 rounded-full p-3 w-fit ${
              isActivated ? "bg-amber-500/10" : "bg-destructive/10"
            }`}>
              {isExpired && <Clock className="h-8 w-8 text-destructive" />}
              {isActivated && <CheckCircle className="h-8 w-8 text-amber-500" />}
              {isRevoked && <AlertCircle className="h-8 w-8 text-destructive" />}
            </div>
            <CardTitle>
              {isExpired && "Code expire"}
              {isActivated && "Code deja utilise"}
              {isRevoked && "Code revoque"}
            </CardTitle>
            <CardDescription>{data.message}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="code-retry-2">Essayer un autre code</Label>
              <Input
                id="code-retry-2"
                placeholder="XXX-XXX-XXX"
                value={inputCode}
                onChange={(e) => setInputCode(formatCode(e.target.value))}
                className="text-center font-mono text-lg tracking-wider"
                onKeyDown={(e) => e.key === "Enter" && handleSearchCode()}
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button className="w-full" onClick={handleSearchCode}>
              Verifier le code
            </Button>
            {session?.user && (
              <Link href="/jury" className="w-full">
                <Button variant="outline" className="w-full">
                  Acceder a mon espace jury
                </Button>
              </Link>
            )}
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Valid code - show activation UI
  if (!data || !data.valid || !data.cup || !data.categories) return null;

  const { cup, categories } = data;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/20 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 rounded-full bg-primary/10 p-3 w-fit">
            <Trophy className="h-8 w-8 text-primary" />
          </div>
          <CardTitle>Devenez Jury</CardTitle>
          <CardDescription>
            Participez a la notation de{" "}
            <strong className="text-foreground">{cup.name}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Code info */}
          <div className="bg-muted rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Code</span>
              <code className="font-mono font-semibold bg-background px-2 py-0.5 rounded">
                {data.code}
              </code>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Cup</span>
              <span className="font-medium">{cup.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Organisateur</span>
              <span className="font-medium">Platinum CBD Cup</span>
            </div>
            <div className="flex items-start justify-between">
              <span className="text-sm text-muted-foreground">Categories</span>
              <div className="flex flex-wrap gap-1 justify-end max-w-[60%]">
                {categories.map((cat) => (
                  <Badge key={cat.id} variant="secondary">
                    {cat.name}
                  </Badge>
                ))}
              </div>
            </div>
            {data.expiresAt && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Expire le</span>
                <span className="text-sm flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(data.expiresAt).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
            )}
          </div>

          {/* What happens next */}
          <div className="border rounded-lg p-4">
            <p className="text-sm font-medium mb-3">En activant ce code, vous pourrez :</p>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li className="flex items-start gap-2">
                <Layers className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                <span>
                  Acceder a {categories.length} categorie{categories.length !== 1 ? "s" : ""} : {categories.map((c) => c.name).join(", ")}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Package className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                <span>Noter les produits de ces categories</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                <span>Contribuer aux resultats officiels de la cup</span>
              </li>
            </ul>
          </div>

          {/* Auth section */}
          {!session?.user ? (
            <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <p className="text-sm text-amber-800 dark:text-amber-200 font-medium mb-3">
                Connectez-vous ou creez un compte pour activer ce code
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Link href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`} className="flex-1">
                  <Button variant="outline" className="w-full">
                    <LogIn className="mr-2 h-4 w-4" />
                    Se connecter
                  </Button>
                </Link>
                <Link href={`/register?intent=jury&callbackUrl=${encodeURIComponent(callbackUrl)}`} className="flex-1">
                  <Button className="w-full">
                    <UserPlus className="mr-2 h-4 w-4" />
                    Creer un compte
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                <p className="text-sm font-medium text-green-800 dark:text-green-200">
                  Connecte en tant que
                </p>
              </div>
              <p className="text-sm text-green-700 dark:text-green-300">
                {session.user.email}
              </p>
            </div>
          )}
        </CardContent>
        <CardFooter>
          {session?.user ? (
            <Button
              className="w-full"
              onClick={handleActivate}
              disabled={activateMutation.isPending}
            >
              {activateMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              <Trophy className="mr-2 h-4 w-4" />
              Activer ce code et devenir jury
            </Button>
          ) : (
            <p className="w-full text-center text-sm text-muted-foreground">
              Veuillez vous connecter ou creer un compte pour continuer
            </p>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}

// Wrap in Suspense for useSearchParams
export default function ActivatePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/20">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-muted-foreground">Chargement...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    }>
      <ActivatePageContent />
    </Suspense>
  );
}
