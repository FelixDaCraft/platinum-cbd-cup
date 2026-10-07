"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { api } from "~/trpc/react";
import { authClient } from "~/lib/auth-client";
import { getErrorMessage } from "../_lib/errors";

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
      toast.success("Code activé !", {
        description: `Vous avez maintenant accès à ${result.categoriesCount} catégorie${result.categoriesCount !== 1 ? "s" : ""}`,
      });
      // Redirect to jury cup page
      router.push(`/jury/cups/${result.cupId}`);
    },
    onError: (err) => {
      // Les erreurs métier du routeur sont déjà rédigées en français
      // (lib/errors.ts) ; une erreur serveur, elle, remonte un libellé
      // technique en anglais qu'il ne faut pas afficher tel quel.
      const isServerFault =
        err.data?.code === "INTERNAL_SERVER_ERROR" || !err.message;
      toast.error(
        isServerFault
          ? "L'activation a échoué. Réessayez dans quelques instants."
          : err.message
      );
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

  // Champ de saisie du code, repris dans les états « saisie », « erreur »
  // et « code inutilisable ».
  const codeField = (id: string, label: string) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <input
        id={id}
        placeholder="XXX-XXX-XXX"
        value={inputCode}
        onChange={(e) => setInputCode(formatCode(e.target.value))}
        className="field-input mono"
        style={{ textAlign: "center", fontSize: 18, letterSpacing: ".08em" }}
        onKeyDown={(e) => e.key === "Enter" && handleSearchCode()}
      />
    </div>
  );

  const verifyButton = (
    <button type="button" className="btn accent" onClick={handleSearchCode}>
      Vérifier le code
    </button>
  );

  // Loading state
  if (sessionLoading) {
    return <ActivatePending label="Chargement…" />;
  }

  // No code yet - show entry form
  if (!searchCode) {
    return (
      <div className="pg pg--form">
        <PageHead
          title="Activer un code jury"
          lede="Saisissez le code d'invitation que vous avez reçu (par email ou sur QR code) pour rejoindre le jury."
        />
        <div className="form-card">
          {codeField("code", "Code d'invitation")}
          <div className="form-actions">{verifyButton}</div>
        </div>
      </div>
    );
  }

  // Loading code info
  if (isLoading) {
    return <ActivatePending label="Vérification du code…" />;
  }

  // Error state
  if (error) {
    return (
      <div className="pg pg--form">
        <PageHead title="Code invalide" />
        <div className="form-card">
          <div className="notice is-error" role="alert">
            {getErrorMessage(error, "Ce code d'activation n'est pas valide.")}
          </div>
          {codeField("code-retry", "Essayer un autre code")}
          <div className="form-actions">
            {verifyButton}
            <Link href="/" className="btn ghost">
              Retour à l&apos;accueil
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Invalid code (expired, already activated, revoked)
  if (data && !data.valid) {
    const isExpired = data.reason === "expired";
    const isActivated = data.reason === "already_activated";
    const isRevoked = data.reason === "revoked";

    return (
      <div className="pg pg--form">
        <PageHead
          title={
            isExpired
              ? "Code expiré"
              : isActivated
                ? "Code déjà utilisé"
                : isRevoked
                  ? "Code révoqué"
                  : "Code invalide"
          }
        />
        <div className="form-card">
          <div
            className={`notice ${isActivated ? "is-info" : "is-error"}`}
            role="alert"
          >
            {data.message}
          </div>
          {codeField("code-retry-2", "Essayer un autre code")}
          <div className="form-actions">
            {verifyButton}
            {session?.user && (
              <Link href="/jury" className="btn ghost">
                Accéder à mon espace jury
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Valid code - show activation UI
  if (!data || !data.valid || !data.cup || !data.categories) return null;

  const { cup, categories } = data;

  const rowStyle: React.CSSProperties = {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: "4px 16px",
    padding: "12px 0",
    borderBottom: "1px solid var(--line)",
  };
  const termStyle: React.CSSProperties = { fontSize: 15, color: "var(--fg-2)" };
  const valueStyle: React.CSSProperties = {
    margin: 0,
    fontSize: 16,
    fontWeight: 600,
    textAlign: "right",
  };

  return (
    <div className="pg pg--form">
      <PageHead
        title={
          <>
            Rejoindre le <em>jury</em>
          </>
        }
        lede={
          <>
            Vous êtes invité à noter les produits de{" "}
            <strong style={{ color: "var(--fg)" }}>{cup.name}</strong>.
          </>
        }
      />

      <div className="form-card">
        <dl style={{ margin: 0 }}>
          <div style={{ ...rowStyle, paddingTop: 0 }}>
            <dt style={termStyle}>Code</dt>
            <dd
              style={{
                ...valueStyle,
                fontFamily: "var(--mono)",
                letterSpacing: ".04em",
              }}
            >
              {data.code}
            </dd>
          </div>
          <div style={rowStyle}>
            <dt style={termStyle}>Concours</dt>
            <dd style={valueStyle}>{cup.name}</dd>
          </div>
          <div style={rowStyle}>
            <dt style={termStyle}>Organisateur</dt>
            <dd style={valueStyle}>Platinum CBD Cup</dd>
          </div>
          <div style={rowStyle}>
            <dt style={termStyle}>
              Catégorie{categories.length !== 1 ? "s" : ""}
            </dt>
            <dd
              style={{
                margin: 0,
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "flex-end",
                gap: 6,
              }}
            >
              {categories.map((cat) => (
                <span key={cat.id} className="pill">
                  {cat.name}
                </span>
              ))}
            </dd>
          </div>
          {data.expiresAt && (
            <div style={rowStyle}>
              <dt style={termStyle}>Valable jusqu&apos;au</dt>
              <dd style={valueStyle}>
                {new Date(data.expiresAt).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </dd>
            </div>
          )}
        </dl>

        {/* Ce que l'activation ouvre */}
        <div>
          <h2 style={{ fontSize: 18, margin: "0 0 10px" }}>
            En activant ce code, vous pourrez :
          </h2>
          <ul
            style={{
              margin: 0,
              paddingLeft: "1.2em",
              fontSize: 16,
              lineHeight: 1.6,
              color: "var(--fg-2)",
            }}
          >
            <li>
              accéder à {categories.length} catégorie
              {categories.length !== 1 ? "s" : ""} :{" "}
              {categories.map((c) => c.name).join(", ")} ;
            </li>
            <li>noter les produits de ces catégories ;</li>
            <li>contribuer aux résultats officiels de la cup.</li>
          </ul>
        </div>

        {/* Connexion */}
        {!session?.user ? (
          <>
            <div className="notice is-info">
              Connectez-vous ou créez un compte pour activer ce code.
            </div>
            <div className="form-actions">
              <Link
                href={`/register?intent=jury&callbackUrl=${encodeURIComponent(callbackUrl)}`}
                className="btn accent"
              >
                Créer un compte
              </Link>
              <Link
                href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}
                className="btn ghost"
              >
                Se connecter
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className="notice is-success">
              Connecté en tant que <b>{session.user.email}</b>
            </div>
            <div className="form-actions">
              <button
                type="button"
                className="btn accent"
                onClick={handleActivate}
                disabled={activateMutation.isPending}
              >
                {activateMutation.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                )}
                Activer ce code et devenir jury
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** En-tête commun aux différents états de la page. */
function PageHead({
  title,
  lede,
}: {
  title: React.ReactNode;
  lede?: React.ReactNode;
}) {
  return (
    <header className="pg-head">
      <p className="eyebrow">Espace jury</p>
      <h1 className="display">{title}</h1>
      {lede && <p className="pg-lede">{lede}</p>}
    </header>
  );
}

/** État d'attente : session ou vérification du code. */
function ActivatePending({ label }: { label: string }) {
  return (
    <div className="pg pg--form">
      <div
        className="form-card"
        style={{ marginTop: 72, alignItems: "center", padding: "56px 24px" }}
        role="status"
      >
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--accent)" }} aria-hidden="true" />
        <p style={{ margin: 0, fontSize: 16, color: "var(--fg-2)" }}>{label}</p>
      </div>
    </div>
  );
}

// Wrap in Suspense for useSearchParams
export default function ActivatePage() {
  return (
    <Suspense fallback={<ActivatePending label="Chargement…" />}>
      <ActivatePageContent />
    </Suspense>
  );
}
