"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

import { useSession } from "~/lib/auth-client";
import { api } from "~/trpc/react";
import { Eyebrow, Field, Check } from "~/components/portal/platinum";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FormData {
  // Étape 1
  categoryId: string;
  // Étape 2
  name: string;
  producer: string;
  origin: string;
  vintage: string;
  thc: string;
  cbd: string;
  hasCoa: boolean;
  // Étape 5
  accept: boolean;
}

/** Champs du spécimen, remis à zéro après chaque ajout au panier. */
const EMPTY_SPECIMEN = {
  categoryId: "",
  name: "",
  origin: "",
  vintage: "",
  thc: "",
  cbd: "",
  hasCoa: false,
} as const;

/** Taux de Δ9-THC maximal admis par la réglementation européenne, en %. */
const MAX_THC_PERCENT = 0.3;

/** Les prix sont stockés en centimes côté serveur. */
function formatEuros(cents: number): string {
  return (cents / 100).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  });
}

// ---------------------------------------------------------------------------
// Stepper sub-component
// ---------------------------------------------------------------------------

const STEPS = [
  { n: 1, l: "Catégorie" },
  { n: 2, l: "Spécimen" },
  { n: 3, l: "Panier" },
  { n: 4, l: "Contact" },
  { n: 5, l: "Paiement" },
];

const STEP_CART = 3;
const STEP_PAY = 5;

function Stepper({ step }: { step: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 0,
        marginTop: 20,
        marginBottom: 32,
        flexWrap: "wrap",
      }}
    >
      {STEPS.map((s, i) => {
        const done = step > s.n;
        const cur = step === s.n;
        return (
          <div
            key={s.n}
            style={{ display: "flex", alignItems: "center", gap: 0 }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  border: `1px solid ${cur ? "var(--accent)" : done ? "var(--fg-2)" : "var(--line-strong)"}`,
                  background: cur ? "var(--accent-dim)" : "transparent",
                  display: "grid",
                  placeItems: "center",
                  fontFamily: "var(--mono)",
                  fontSize: 11,
                  color: cur
                    ? "var(--accent)"
                    : done
                      ? "var(--fg-2)"
                      : "var(--fg-3)",
                }}
              >
                {done ? "✓" : s.n}
              </span>
              <span
                className="mono"
                style={{
                  fontSize: 11,
                  letterSpacing: ".1em",
                  textTransform: "uppercase",
                  color: cur ? "var(--fg)" : done ? "var(--fg-2)" : "var(--fg-3)",
                }}
              >
                {s.l}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <span
                style={{
                  flex: "0 1 40px",
                  height: 1,
                  background: "var(--line)",
                  margin: "0 14px",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function RegisterPage() {
  const params = useParams();
  const router = useRouter();
  const cupId = params.cupId as string;

  // Auth guard — redirect to login if not authenticated
  const { data: session, isPending: sessionLoading } = useSession();

  useEffect(() => {
    if (!sessionLoading && !session?.user) {
      router.replace(`/login?callbackUrl=/cups/${cupId}/register`);
    }
  }, [session, sessionLoading, cupId, router]);

  // ---------------------------------------------------------------------------
  // tRPC queries / mutations
  // ---------------------------------------------------------------------------

  // Use publicProcedure so the page still loads even before getOrCreate resolves
  const { data: cupData, isLoading: cupLoading } =
    api.cup.getPublicDetails.useQuery({ cupId }, { enabled: !!cupId });

  // Get-or-create registration (protectedProcedure — fires once user is confirmed present)
  const getOrCreate = api.registration.getOrCreate.useMutation();

  // Coordonnées de facturation : lues sur le profil producteur, pas ressaisies.
  const { data: producerProfile } = api.producer.getProfile.useQuery(undefined, {
    enabled: !!session?.user,
  });

  // Panier : chaque spécimen est enregistré sur l'inscription dès l'étape 2
  // (« Ajouter au panier »), ce qui fait jouer les quotas tout de suite ; un
  // seul paiement, une seule facture règlent ensuite tout le panier.
  const addProduct = api.registration.addProduct.useMutation();
  const removeProduct = api.registration.removeProduct.useMutation();

  // createCheckoutSession — la redirection est déclenchée dans handlePay, qui
  // traite l'absence d'URL comme une erreur au lieu de laisser croire au succès.
  const createCheckoutSession = api.registration.createCheckoutSession.useMutation();

  // ---------------------------------------------------------------------------
  // Local wizard state
  // ---------------------------------------------------------------------------

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [data, setData] = useState<FormData>({
    categoryId: "",
    name: "",
    producer: "",
    origin: "",
    vintage: "",
    thc: "",
    cbd: "",
    hasCoa: false,
    accept: false,
  });

  const set = <K extends keyof FormData>(k: K, v: FormData[K]) =>
    setData((d) => ({ ...d, [k]: v }));

  // ---------------------------------------------------------------------------
  // Catégories et frais — lus tels quels dans la cup, jamais devinés
  // ---------------------------------------------------------------------------

  const categories = cupData?.categories ?? [];

  /** Prix d'un produit dans cette catégorie, en centimes (override ou défaut cup). */
  const categoryPriceInCents = (category: { pricePerProduct: number | null }) =>
    category.pricePerProduct ?? cupData?.cup.defaultPricePerProduct ?? 0;

  const selectedCategory =
    categories.find((category) => category.id === data.categoryId) ?? null;

  // Panier : lu sur l'inscription en attente, source de vérité du montant.
  const registrationId = getOrCreate.data?.id;
  const { data: cart, refetch: refetchCart } = api.registration.getById.useQuery(
    { registrationId: registrationId ?? "" },
    { enabled: !!registrationId }
  );
  const cartProducts = cart?.products ?? [];

  // Le montant débité est celui que le serveur recalcule à partir des produits ;
  // c'est donc ce total-là qui doit s'afficher, pas une grille locale.
  const totalInCents = cart?.totalAmount ?? 0;

  /** Produits du producteur dans une catégorie : panier + commandes réglées. */
  const heldInCategory = (categoryId: string) =>
    cartProducts.filter((p) => p.categoryId === categoryId).length +
    (getOrCreate.data?.paidProductsByCategory?.[categoryId] ?? 0);

  // ---------------------------------------------------------------------------
  // Initialize registration once cup data is available and user is logged in
  // ---------------------------------------------------------------------------

  const [registrationInitialized, setRegistrationInitialized] = useState(false);

  // Un panier laissé en attente (paiement abandonné) se reprend au panier.
  const [resumed, setResumed] = useState(false);
  useEffect(() => {
    if (!resumed && cart) {
      setResumed(true);
      if (cart.products.length > 0) setStep(STEP_CART);
    }
  }, [cart, resumed]);

  useEffect(() => {
    if (
      !registrationInitialized &&
      cupData &&
      session?.user &&
      !getOrCreate.isPending &&
      !getOrCreate.data
    ) {
      setRegistrationInitialized(true);
      getOrCreate.mutate({ cupId });
    }
  }, [cupData, session, registrationInitialized, getOrCreate, cupId]);

  // ---------------------------------------------------------------------------
  // Étape 2 → « Ajouter au panier »
  // ---------------------------------------------------------------------------

  const handleAddToCart = async () => {
    if (!selectedCategory) {
      setSubmitError("Choisissez une catégorie à l'étape 1.");
      return;
    }
    if (!data.name.trim() || !data.producer.trim()) {
      setSubmitError("Le nom du spécimen et le producteur sont obligatoires.");
      return;
    }

    const thc = Number(data.thc.replace(",", "."));
    if (!data.thc.trim() || Number.isNaN(thc)) {
      setSubmitError("Renseignez le taux de Δ9-THC déclaré.");
      return;
    }
    if (thc > MAX_THC_PERCENT) {
      setSubmitError(
        `Le taux de Δ9-THC déclaré (${data.thc}%) dépasse la limite de ${MAX_THC_PERCENT}% : le spécimen ne peut pas être inscrit.`
      );
      return;
    }

    if (!registrationId) {
      setSubmitError("Inscription non initialisée. Rechargez la page.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      // Le serveur contrôle ici les quotas de la catégorie (places restantes,
      // maximum par producteur, panier et commandes réglées compris).
      // TODO: origine, millésime, THC, CBD et COA sont empaquetés dans `description`
      // faute de colonnes dédiées ; ils devraient devenir des attributs structurés
      // du produit pour alimenter les PDF, les analyses labo et les filtres.
      await addProduct.mutateAsync({
        registrationId,
        categoryId: selectedCategory.id,
        name: data.name.trim(),
        description: [
          data.producer ? `Producteur: ${data.producer}` : null,
          data.origin ? `Origine: ${data.origin}` : null,
          data.vintage ? `Millésime: ${data.vintage}` : null,
          data.thc ? `THC: ${data.thc}%` : null,
          data.cbd ? `CBD: ${data.cbd}%` : null,
          data.hasCoa ? "COA fourni à réception" : null,
        ]
          .filter(Boolean)
          .join(" · ") || undefined,
      });
      await refetchCart();
      // Le producteur / lab est conservé : c'est souvent le même d'un spécimen à l'autre.
      setData((d) => ({ ...d, ...EMPTY_SPECIMEN }));
      setStep(STEP_CART);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (productId: string) => {
    setSubmitError(null);
    try {
      await removeProduct.mutateAsync({ productId });
      await refetchCart();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Une erreur est survenue.");
    }
  };

  // ---------------------------------------------------------------------------
  // Étape 5 → « Payer » : un paiement, une facture pour tout le panier
  // ---------------------------------------------------------------------------

  const handlePay = async () => {
    if (!data.accept) {
      setSubmitError("Vous devez accepter le règlement pour continuer.");
      return;
    }
    if (!registrationId || cartProducts.length === 0) {
      setSubmitError("Votre panier est vide : ajoutez au moins un produit.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      // Commande Viva pour tout le panier, puis checkout hébergé.
      // L'inscription reste `pending_payment` : elle n'est confirmée qu'au
      // retour de Viva (page /register/success) ou par le webhook.
      const session = await createCheckoutSession.mutateAsync({ registrationId });

      if (!session.checkoutUrl) {
        setSubmitError(
          "Le paiement n'est pas disponible pour le moment. Votre panier est conservé : réessayez depuis « Mes inscriptions »."
        );
        setSubmitting(false);
        return;
      }

      // `submitting` reste vrai : le bouton affiche « Redirection… » jusqu'à ce
      // que le navigateur quitte la page.
      window.location.href = session.checkoutUrl;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Une erreur est survenue.";
      setSubmitError(message);
      setSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Loading / auth guard render states
  // ---------------------------------------------------------------------------

  if (sessionLoading) {
    return (
      <div className="page-enter" style={{ paddingTop: 80, textAlign: "center" }}>
        <span className="mono fg3" style={{ fontSize: 12, letterSpacing: ".1em" }}>
          CHARGEMENT…
        </span>
      </div>
    );
  }

  if (!session?.user) {
    // Redirect is in flight; show nothing
    return null;
  }

  if (cupLoading) {
    return (
      <div className="page-enter" style={{ paddingTop: 80, textAlign: "center" }}>
        <span className="mono fg3" style={{ fontSize: 12, letterSpacing: ".1em" }}>
          CHARGEMENT DE LA CUP…
        </span>
      </div>
    );
  }

  if (!cupData?.canRegister) {
    return (
      <div className="page-enter" style={{ paddingTop: 80, textAlign: "center" }}>
        <div className="mono fg3" style={{ fontSize: 12, letterSpacing: ".1em", marginBottom: 16 }}>
          INSCRIPTIONS FERMÉES
        </div>
        <Link href={`/cups/${cupId}`}>
          <button className="btn ghost">← Retour à la cup</button>
        </Link>
      </div>
    );
  }

  // Producer profile missing
  if (getOrCreate.error?.data?.code === "FORBIDDEN") {
    return (
      <div className="page-enter" style={{ paddingTop: 80, textAlign: "center" }}>
        <div className="mono" style={{ fontSize: 13, marginBottom: 16, color: "var(--fg-2)" }}>
          Profil producteur requis pour s&apos;inscrire.
        </div>
        <Link href="/producer/complete-profile">
          <button className="btn accent">Compléter mon profil →</button>
        </Link>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------

  return (
    <div className="page-enter">
      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <section style={{ paddingTop: 40, paddingBottom: 24 }}>
        <Eyebrow idx={3}>Inscription · Édition 03</Eyebrow>
        <h1
          className="display"
          style={{ marginTop: 18, marginBottom: 8 }}
        >
          Enter<em>.</em>
        </h1>
        <p className="lede" style={{ marginTop: 0 }}>
          Cinq étapes. Douze minutes. Spécimen anonymisé automatiquement dès réception.
        </p>
        {getOrCreate.data?.isSupplement && (
          <p
            className="mono"
            style={{ marginTop: 16, fontSize: 12.5, color: "var(--accent)", lineHeight: 1.6 }}
          >
            Commande complémentaire : vous avez déjà {getOrCreate.data.paidProductsCount}{" "}
            produit{getOrCreate.data.paidProductsCount > 1 ? "s" : ""} réglé
            {getOrCreate.data.paidProductsCount > 1 ? "s" : ""} pour cette cup. Ce nouveau
            produit fait l&apos;objet d&apos;un paiement et d&apos;une facture séparés.
          </p>
        )}
      </section>

      {/* ── STEPPER ───────────────────────────────────────────────────────── */}
      <Stepper step={step} />

      {/* ── TWO-COLUMN GRID ───────────────────────────────────────────────── */}
      <div
        className="grid"
        style={{ gridTemplateColumns: "1.6fr 1fr", gap: 24 }}
      >
        {/* ── LEFT: STEP CONTENT ──────────────────────────────────────────── */}
        <div className="card">
          {/* ── ÉTAPE 1 — CATÉGORIE ───────────────────────────────────────── */}
          {step === 1 && (
            <>
              <h2 className="section-title" style={{ fontSize: 22 }}>
                Choix de la catégorie
              </h2>
              {categories.length === 0 ? (
                <p
                  style={{
                    marginTop: 20,
                    fontSize: 13,
                    color: "var(--fg-2)",
                    lineHeight: 1.6,
                  }}
                >
                  Aucune catégorie n&apos;est ouverte sur cette cup pour
                  l&apos;instant. L&apos;organisateur doit les créer avant que
                  les inscriptions soient possibles.
                </p>
              ) : (
                <div className="grid g-2" style={{ marginTop: 20 }}>
                  {categories.map((category) => {
                    const sel = data.categoryId === category.id;
                    const held = heldInCategory(category.id);
                    // Maximum par producteur atteint : panier et commandes
                    // réglées compris.
                    const atProducerMax =
                      category.maxProductsPerProducer !== null &&
                      held >= category.maxProductsPerProducer;
                    const full = category.isFull || atProducerMax;
                    return (
                      <button
                        key={category.id}
                        onClick={() => !full && set("categoryId", category.id)}
                        disabled={full}
                        aria-disabled={full}
                        style={{
                          textAlign: "left",
                          padding: 20,
                          cursor: full ? "not-allowed" : "pointer",
                          opacity: full ? 0.5 : 1,
                          background: sel ? "var(--accent-dim)" : "var(--bg)",
                          border: `1px solid ${sel ? "var(--accent)" : "var(--line)"}`,
                          borderRadius: 12,
                          color: "var(--fg)",
                          fontFamily: "inherit",
                          transition:
                            "border-color .15s ease, background .15s ease",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "baseline",
                            justifyContent: "space-between",
                            gap: 12,
                          }}
                        >
                          <div className="mono" style={{ fontSize: 15 }}>
                            {category.name}
                          </div>
                          <div
                            className="mono tabular"
                            style={{
                              fontSize: 13,
                              whiteSpace: "nowrap",
                              color: sel ? "var(--accent)" : "var(--fg-2)",
                            }}
                          >
                            {formatEuros(categoryPriceInCents(category))}
                          </div>
                        </div>
                        {category.description && (
                          <div
                            style={{
                              fontSize: 12.5,
                              color: "var(--fg-2)",
                              marginTop: 12,
                              lineHeight: 1.5,
                            }}
                          >
                            {category.description}
                          </div>
                        )}
                        {(full ||
                          held > 0 ||
                          category.remainingPlaces !== null ||
                          category.maxProductsPerProducer !== null) && (
                          <div
                            className="mono"
                            style={{
                              fontSize: 11.5,
                              marginTop: 12,
                              color: full ? "var(--danger)" : "var(--fg-2)",
                            }}
                          >
                            {category.isFull
                              ? "Complet"
                              : atProducerMax
                                ? `Maximum atteint (${held}/${category.maxProductsPerProducer} par producteur)`
                              : [
                                  category.remainingPlaces !== null
                                    ? `${category.remainingPlaces} place${category.remainingPlaces > 1 ? "s" : ""} restante${category.remainingPlaces > 1 ? "s" : ""}`
                                    : null,
                                  category.maxProductsPerProducer !== null
                                    ? `${category.maxProductsPerProducer} produit${category.maxProductsPerProducer > 1 ? "s" : ""} max. par producteur`
                                    : null,
                                  held > 0 ? `${held} déjà dans votre inscription` : null,
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* ── STEP 2 — SPÉCIMEN ─────────────────────────────────────────── */}
          {step === 2 && (
            <>
              <h2 className="section-title" style={{ fontSize: 22 }}>
                Spécimen
              </h2>
              <div className="grid g-2" style={{ marginTop: 20, gap: 18 }}>
                <Field
                  label="Nom du spécimen *"
                  placeholder="Platinum Haze v2"
                  value={data.name}
                  onChange={(v) => set("name", v)}
                  required
                />
                <Field
                  label="Producteur / Lab *"
                  placeholder="Studio Garden"
                  value={data.producer}
                  onChange={(v) => set("producer", v)}
                  required
                />
                <Field
                  label="Origine (pays)"
                  placeholder="Portugal"
                  value={data.origin}
                  onChange={(v) => set("origin", v)}
                />
                <Field
                  label="Millésime"
                  placeholder="2026"
                  value={data.vintage}
                  onChange={(v) => set("vintage", v)}
                />
              </div>
              {/* Déclaratif laboratoire */}
              <div
                style={{
                  marginTop: 20,
                  padding: 18,
                  border: "1px solid var(--line)",
                  borderRadius: 10,
                }}
              >
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    letterSpacing: ".1em",
                    color: "var(--fg-3)",
                    textTransform: "uppercase",
                    marginBottom: 14,
                  }}
                >
                  Déclaratif laboratoire
                </div>
                <div className="grid g-2" style={{ gap: 18 }}>
                  <Field
                    label="Δ9-THC (%) *"
                    name="thc"
                    placeholder="0.28"
                    value={data.thc}
                    onChange={(v) => set("thc", v)}
                    hint={`≤ ${MAX_THC_PERCENT}% UE`}
                    required
                  />
                  <Field
                    label="CBD total (%)"
                    name="cbd"
                    placeholder="12.4"
                    value={data.cbd}
                    onChange={(v) => set("cbd", v)}
                  />
                </div>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    marginTop: 16,
                    cursor: "pointer",
                  }}
                >
                  <Check
                    on={data.hasCoa}
                    onClick={() => set("hasCoa", !data.hasCoa)}
                  />
                  <span
                    className="mono"
                    style={{ fontSize: 12, color: "var(--fg-2)" }}
                  >
                    Je fournirai un COA (Certificate of Analysis) à réception.
                  </span>
                </label>
              </div>
              {submitError && (
                <div
                  style={{
                    marginTop: 16,
                    padding: "12px 16px",
                    border: "1px solid var(--line-strong)",
                    borderRadius: 10,
                    background: "var(--bg)",
                    color: "var(--fg-2)",
                    fontSize: 13,
                  }}
                >
                  {submitError}
                </div>
              )}
            </>
          )}

          {/* ── ÉTAPE 3 — PANIER ──────────────────────────────────────────── */}
          {step === STEP_CART && (
            <>
              <h2 className="section-title" style={{ fontSize: 22 }}>
                Votre panier
              </h2>
              <p style={{ marginTop: 8, fontSize: 13, color: "var(--fg-2)", lineHeight: 1.6 }}>
                Inscrivez tous vos spécimens, dans une ou plusieurs catégories :
                ils seront réglés en un seul paiement, sur une seule facture.
              </p>
              {cartProducts.length === 0 ? (
                <p style={{ marginTop: 20, fontSize: 13, color: "var(--fg-3)" }}>
                  Aucun produit pour l&apos;instant.
                </p>
              ) : (
                <div style={{ marginTop: 20 }}>
                  {cartProducts.map((product) => (
                    <div
                      key={product.id}
                      className="kv"
                      style={{ alignItems: "center", gap: 12 }}
                    >
                      <span className="kv-k" style={{ textTransform: "none" }}>
                        <span style={{ color: "var(--fg)" }}>{product.name}</span>
                        <span style={{ display: "block", fontSize: 11, color: "var(--fg-3)" }}>
                          {product.category.name}
                        </span>
                      </span>
                      <span className="kv-v" style={{ display: "flex", gap: 14, alignItems: "center" }}>
                        <span className="tabular">{formatEuros(product.priceAtRegistration)}</span>
                        <button
                          type="button"
                          className="btn ghost"
                          style={{ padding: "4px 10px", fontSize: 11 }}
                          disabled={removeProduct.isPending}
                          onClick={() => void handleRemove(product.id)}
                          aria-label={`Retirer ${product.name}`}
                        >
                          Retirer
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <button
                type="button"
                className="btn"
                style={{ marginTop: 20 }}
                onClick={() => {
                  setSubmitError(null);
                  setStep(1);
                }}
              >
                + Ajouter un autre produit
              </button>
              {submitError && (
                <div
                  style={{
                    marginTop: 16,
                    padding: "12px 16px",
                    border: "1px solid var(--line-strong)",
                    borderRadius: 10,
                    background: "var(--bg)",
                    color: "var(--fg-2)",
                    fontSize: 13,
                  }}
                >
                  {submitError}
                </div>
              )}
            </>
          )}

          {/* ── ÉTAPE 4 — CONTACT ─────────────────────────────────────────── */}
          {step === 4 && (
            <>
              <h2 className="section-title" style={{ fontSize: 22 }}>
                Contact
              </h2>
              {/*
                Les coordonnées de facturation viennent du profil producteur :
                les saisir ici serait trompeur, `addProduct` ne les accepte pas
                et la facture les lit sur le profil.
              */}
              <div style={{ marginTop: 20 }}>
                <div className="kv">
                  <span className="kv-k">Email du compte</span>
                  <span className="kv-v">{session.user.email ?? "—"}</span>
                </div>
                <div className="kv">
                  <span className="kv-k">Raison sociale</span>
                  <span className="kv-v">
                    {producerProfile?.companyName ?? "—"}
                  </span>
                </div>
                <div className="kv">
                  <span className="kv-k">SIRET</span>
                  <span className="kv-v">
                    {producerProfile?.siret ?? "Non renseigné"}
                  </span>
                </div>
                <div className="kv">
                  <span className="kv-k">Téléphone</span>
                  <span className="kv-v">
                    {producerProfile?.phone ?? "Non renseigné"}
                  </span>
                </div>
              </div>
              <p
                style={{
                  marginTop: 16,
                  fontSize: 12.5,
                  color: "var(--fg-2)",
                  lineHeight: 1.6,
                }}
              >
                Ces informations figureront sur votre facture.{" "}
                <Link
                  href="/producer/profile"
                  style={{ color: "var(--accent)", textDecoration: "underline" }}
                >
                  Modifier mon profil producteur
                </Link>
              </p>
              {/* Envoi du spécimen sub-card */}
              <div
                style={{
                  marginTop: 20,
                  padding: 18,
                  border: "1px solid var(--line)",
                  borderRadius: 10,
                  background: "var(--bg)",
                }}
              >
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    letterSpacing: ".1em",
                    color: "var(--fg-3)",
                    textTransform: "uppercase",
                    marginBottom: 10,
                  }}
                >
                  Envoi du spécimen
                </div>
                <p
                  style={{
                    fontSize: 13,
                    color: "var(--fg-2)",
                    lineHeight: 1.55,
                    margin: 0,
                  }}
                >
                  Un{" "}
                  <b style={{ color: "var(--fg)" }}>QR code</b> et une
                  étiquette anonyme seront générés après paiement. Vous disposez
                  de{" "}
                  <b style={{ color: "var(--fg)" }}>10 jours</b> pour expédier
                  votre colis au laboratoire partenaire (Amsterdam, NL).
                </p>
              </div>
            </>
          )}

          {/* ── ÉTAPE 5 — PAIEMENT ────────────────────────────────────────── */}
          {step === STEP_PAY && (
            <>
              <h2 className="section-title" style={{ fontSize: 22 }}>
                Paiement
              </h2>
              {/*
                Aucun champ de carte ici : la saisie se fait sur la page de
                paiement hébergée par Viva.com, seule à voir les données de
                carte. Le moyen de paiement se choisit là-bas.
              */}
              <div
                style={{
                  marginTop: 20,
                  padding: 18,
                  border: "1px solid var(--line)",
                  borderRadius: 10,
                  background: "var(--bg)",
                }}
              >
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    letterSpacing: ".1em",
                    color: "var(--fg-3)",
                    textTransform: "uppercase",
                    marginBottom: 10,
                  }}
                >
                  Paiement sécurisé Viva.com
                </div>
                {/* Logo viva.com : exigé par Viva sur les écrans de paiement
                    (validation de la source de paiement). Logo sombre, posé
                    sur un fond clair pour rester lisible en thème sombre. */}
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "8px 12px",
                    marginBottom: 12,
                    borderRadius: 8,
                    background: "#ffffff",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/viva-logo.svg" alt="viva.com" width={104} height={18} />
                </span>
                <p
                  style={{
                    fontSize: 13,
                    color: "var(--fg-2)",
                    lineHeight: 1.55,
                    margin: 0,
                  }}
                >
                  En validant, vous serez redirigé vers la page de paiement de{" "}
                  <b style={{ color: "var(--fg)" }}>Viva.com</b> pour régler{" "}
                  <b style={{ color: "var(--fg)" }}>{formatEuros(totalInCents)}</b>{" "}
                  pour {cartProducts.length} produit{cartProducts.length > 1 ? "s" : ""}
                  , en une seule fois. Votre inscription est confirmée dès que le paiement est
                  encaissé ; vous recevez alors votre facture par email.
                </p>
              </div>

              {/* Terms checkbox */}
              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  marginTop: 20,
                  cursor: "pointer",
                }}
              >
                <Check
                  on={data.accept}
                  onClick={() => set("accept", !data.accept)}
                />
                <span
                  style={{
                    fontSize: 12.5,
                    color: "var(--fg-2)",
                    lineHeight: 1.5,
                  }}
                >
                  J&apos;accepte le règlement de la Platinum CBD Cup. Je
                  certifie que le spécimen respecte la réglementation européenne
                  en vigueur (Δ9-THC ≤ 0,3%) pour chacun des spécimens inscrits.
                </span>
              </label>

              {/* Submit error */}
              {submitError && (
                <div
                  style={{
                    marginTop: 16,
                    padding: "12px 16px",
                    border: "1px solid var(--line-strong)",
                    borderRadius: 10,
                    background: "var(--bg)",
                    color: "var(--fg-2)",
                    fontSize: 13,
                  }}
                >
                  {submitError}
                </div>
              )}
            </>
          )}

          {/* ── NAV ───────────────────────────────────────────────────────── */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 32,
              paddingTop: 24,
              borderTop: "1px solid var(--line)",
            }}
          >
            <button
              className="btn ghost"
              disabled={step === 1 && cartProducts.length === 0}
              onClick={() => {
                setSubmitError(null);
                // Depuis le choix de catégorie, « Précédent » ramène au panier
                // quand il contient déjà des produits.
                setStep((s) => (s === 1 ? STEP_CART : Math.max(1, s - 1)));
              }}
              style={{ opacity: step === 1 && cartProducts.length === 0 ? 0.3 : 1 }}
            >
              {step === 1 && cartProducts.length > 0 ? "← Panier" : "← Précédent"}
            </button>
            <button
              className="btn accent"
              disabled={
                submitting ||
                (step === 1 && !selectedCategory) ||
                (step === STEP_CART && cartProducts.length === 0)
              }
              onClick={() => {
                setSubmitError(null);
                if (step === 2) {
                  void handleAddToCart();
                } else if (step === STEP_PAY) {
                  void handlePay();
                } else {
                  setStep((s) => Math.min(STEPS.length, s + 1));
                }
              }}
            >
              {submitting
                ? step === STEP_PAY
                  ? "Redirection vers le paiement…"
                  : "Ajout…"
                : step === 2
                  ? "Ajouter au panier"
                  : step === STEP_PAY
                    ? `Payer ${formatEuros(totalInCents)}`
                    : "Continuer"}{" "}
              {!submitting && <span className="btn-arrow">→</span>}
            </button>
          </div>
        </div>

        {/* ── DROITE : RÉCAPITULATIF ──────────────────────────────────────── */}
        <div
          className="card"
          style={{ height: "fit-content", position: "sticky", top: 100 }}
        >
          <Eyebrow>Récapitulatif</Eyebrow>
          <div style={{ marginTop: 16 }}>
            {cartProducts.map((product) => (
              <div key={product.id} className="kv">
                <span className="kv-k" style={{ textTransform: "none" }}>
                  {product.name}
                  <span style={{ display: "block", fontSize: 11, color: "var(--fg-3)" }}>
                    {product.category.name}
                  </span>
                </span>
                <span className="kv-v tabular">{formatEuros(product.priceAtRegistration)}</span>
              </div>
            ))}
            {/* Spécimen en cours de saisie, pas encore ajouté au panier */}
            {step <= 2 && selectedCategory && (
              <div className="kv" style={{ opacity: 0.6 }}>
                <span className="kv-k" style={{ textTransform: "none" }}>
                  {data.name || "Nouveau spécimen"}
                  <span style={{ display: "block", fontSize: 11, color: "var(--fg-3)" }}>
                    {selectedCategory.name} · à ajouter
                  </span>
                </span>
                <span className="kv-v tabular">
                  {formatEuros(categoryPriceInCents(selectedCategory))}
                </span>
              </div>
            )}
            {cartProducts.length === 0 && !(step <= 2 && selectedCategory) && (
              <p style={{ fontSize: 12.5, color: "var(--fg-3)", margin: 0 }}>
                Panier vide.
              </p>
            )}
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginTop: 16,
              paddingTop: 16,
              borderTop: "1px solid var(--line-strong)",
            }}
          >
            <span
              className="mono"
              style={{
                fontSize: 11,
                letterSpacing: ".1em",
                color: "var(--fg-3)",
                textTransform: "uppercase",
              }}
            >
              Total
            </span>
            <span
              className="mono tabular"
              style={{ fontSize: 28, fontWeight: 300 }}
            >
              {formatEuros(totalInCents)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
