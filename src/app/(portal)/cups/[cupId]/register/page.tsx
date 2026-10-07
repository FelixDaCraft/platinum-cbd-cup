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

/** Champs du produit, remis à zéro après chaque ajout au panier. */
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
  { n: 1, l: "Catégorie", title: "Choisissez une catégorie" },
  { n: 2, l: "Produit", title: "Décrivez votre produit" },
  { n: 3, l: "Panier", title: "Votre panier" },
  { n: 4, l: "Coordonnées", title: "Vos coordonnées" },
  { n: 5, l: "Paiement", title: "Paiement" },
];

const STEP_CART = 3;
const STEP_PAY = 5;

/** Taux affiché à la française : 0.3 → « 0,3 % ». */
const MAX_THC_LABEL = `${String(MAX_THC_PERCENT).replace(".", ",")} %`;

function Stepper({ step }: { step: number }) {
  return (
    <nav aria-label="Étapes de l'inscription">
      <ol className="reg-steps">
        {STEPS.map((s) => {
          const done = step > s.n;
          const cur = step === s.n;
          return (
            <li
              key={s.n}
              aria-current={cur ? "step" : undefined}
              className={`reg-step${cur ? " is-current" : done ? " is-done" : ""}`}
            >
              <span aria-hidden="true" className="tabular reg-step-n">
                {done ? "✓" : s.n}
              </span>
              <span className="reg-step-label">{s.l}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Places restantes, sur le modèle de la page de l'édition. */
function placesText(remaining: number): string {
  if (remaining === 1) return "Plus qu'une place";
  if (remaining <= 3) return `Plus que ${remaining} places`;
  return `${remaining} places restantes`;
}

/** Ligne de panier : produit, catégorie, prix, action éventuelle. */
function CartLine({
  name,
  category,
  price,
  muted = false,
  action,
}: {
  name: string;
  category: string;
  price: string;
  muted?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <li className="reg-line" style={{ opacity: muted ? 0.65 : 1 }}>
      <span className="reg-line-info">
        <span className="reg-line-name">{name}</span>
        <span className="reg-line-cat">{category}</span>
      </span>
      <span className="reg-line-side">
        <span className="tabular reg-line-price">{price}</span>
        {action}
      </span>
    </li>
  );
}

const listReset = { listStyle: "none", margin: 0, padding: 0 } as const;

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
      setSubmitError("Le nom du produit et le producteur sont obligatoires.");
      return;
    }

    const thc = Number(data.thc.replace(",", "."));
    if (!data.thc.trim() || Number.isNaN(thc)) {
      setSubmitError("Renseignez le taux de Δ9-THC déclaré.");
      return;
    }
    if (thc > MAX_THC_PERCENT) {
      setSubmitError(
        `Le taux de Δ9-THC déclaré (${data.thc} %) dépasse la limite de ${MAX_THC_LABEL} : ce produit ne peut pas être inscrit.`
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
      <div className="pg pg--narrow page-enter">
        <p role="status" className="pg-lede" style={{ paddingTop: 80 }}>
          Chargement…
        </p>
      </div>
    );
  }

  if (!session?.user) {
    // Redirect is in flight; show nothing
    return null;
  }

  if (cupLoading) {
    return (
      <div className="pg pg--narrow page-enter">
        <p role="status" className="pg-lede" style={{ paddingTop: 80 }}>
          Chargement de la cup…
        </p>
      </div>
    );
  }

  if (!cupData?.canRegister) {
    return (
      <div className="pg pg--narrow page-enter">
        <header className="pg-head">
          <h1 className="display">Inscriptions fermées</h1>
          <p className="pg-lede">
            Les inscriptions à cette cup ne sont pas ouvertes actuellement.
          </p>
        </header>
        <div className="form-actions">
          <Link href={`/cups/${cupId}`} className="btn ghost">
            ← Retour à la cup
          </Link>
        </div>
      </div>
    );
  }

  // Producer profile missing
  if (getOrCreate.error?.data?.code === "FORBIDDEN") {
    return (
      <div className="pg pg--narrow page-enter">
        <header className="pg-head">
          <h1 className="display">Profil producteur requis</h1>
          <p className="pg-lede">
            Complétez votre profil producteur pour pouvoir inscrire des produits.
          </p>
        </header>
        <div className="form-actions">
          <Link href="/producer/complete-profile" className="btn accent">
            Compléter mon profil <span className="btn-arrow">→</span>
          </Link>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------

  const currentStep = STEPS[step - 1] ?? STEPS[0]!;

  const errorNotice = submitError && (
    <div className="notice is-error" role="alert">
      {submitError}
    </div>
  );

  return (
    <div className="pg page-enter reg-flow" data-step={step}>
      {/* ── EN-TÊTE ───────────────────────────────────────────────────────── */}
      <header className="pg-head">
        <Eyebrow>Inscription · {cupData.cup.name}</Eyebrow>
        <h1 className="display">Inscrire vos produits</h1>
        <p className="pg-lede">
          Choisissez une catégorie, décrivez votre produit et ajoutez-le au
          panier. Vous pouvez inscrire plusieurs produits, dans une ou plusieurs
          catégories, et tout régler en un seul paiement.
        </p>
        {getOrCreate.data?.isSupplement && (
          <div className="notice is-info">
            <b>Commande complémentaire.</b> Vous avez déjà{" "}
            {getOrCreate.data.paidProductsCount} produit
            {getOrCreate.data.paidProductsCount > 1 ? "s" : ""} réglé
            {getOrCreate.data.paidProductsCount > 1 ? "s" : ""} pour cette cup.
            Cette nouvelle commande fait l&apos;objet d&apos;un paiement et
            d&apos;une facture séparés.
          </div>
        )}
      </header>

      {/* ── ÉTAPES ────────────────────────────────────────────────────────── */}
      <div className="reg-stepper">
        <Stepper step={step} />
      </div>

      {/* ── DEUX COLONNES (une seule sur mobile et tablette portrait) ─────── */}
      <div className="reg-layout">
        {/* ── GAUCHE : CONTENU DE L'ÉTAPE ─────────────────────────────────── */}
        <section
          className="form-card reg-main"
          aria-labelledby="register-step-title"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <p className="eyebrow" style={{ margin: 0 }}>
              Étape {step} sur {STEPS.length}
            </p>
            <h2 id="register-step-title">{currentStep.title}</h2>
          </div>

          {/* ── ÉTAPE 1 — CATÉGORIE ───────────────────────────────────────── */}
          {step === 1 &&
            (categories.length === 0 ? (
              <div className="notice">
                Aucune catégorie n&apos;est ouverte sur cette cup pour
                l&apos;instant. L&apos;organisateur doit les créer avant que les
                inscriptions soient possibles.
              </div>
            ) : (
              <ul style={{ ...listReset, display: "flex", flexDirection: "column", gap: 12 }}>
                {categories.map((category) => {
                  const sel = data.categoryId === category.id;
                  const held = heldInCategory(category.id);
                  // Maximum par producteur atteint : panier et commandes
                  // réglées compris.
                  const atProducerMax =
                    category.maxProductsPerProducer !== null &&
                    held >= category.maxProductsPerProducer;
                  const full = category.isFull || atProducerMax;
                  const low =
                    !full &&
                    category.remainingPlaces !== null &&
                    category.remainingPlaces <= 3;
                  const quota = category.isFull
                    ? "Catégorie complète"
                    : atProducerMax
                      ? `Maximum atteint : ${held} sur ${category.maxProductsPerProducer} par producteur`
                      : [
                          category.remainingPlaces !== null
                            ? placesText(category.remainingPlaces)
                            : null,
                          category.maxProductsPerProducer !== null
                            ? `${category.maxProductsPerProducer} produit${category.maxProductsPerProducer > 1 ? "s" : ""} maximum par producteur`
                            : null,
                          held > 0
                            ? `Déjà ${held} dans votre inscription`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ");
                  return (
                    <li key={category.id}>
                      <button
                        type="button"
                        onClick={() => !full && set("categoryId", category.id)}
                        disabled={full}
                        aria-disabled={full}
                        aria-pressed={sel}
                        className="reg-cat"
                        style={{
                          cursor: full ? "not-allowed" : "pointer",
                          opacity: full ? 0.55 : 1,
                          background: sel ? "var(--accent-dim)" : "var(--bg)",
                          border: `1px solid ${sel ? "var(--accent)" : "var(--line-strong)"}`,
                        }}
                      >
                        <span className="reg-cat-info">
                          <span className="reg-cat-name">{category.name}</span>
                          {category.description && (
                            <span style={{ fontSize: 15, lineHeight: 1.5, color: "var(--fg-2)" }}>
                              {category.description}
                            </span>
                          )}
                          {quota && (
                            <span
                              style={{
                                fontSize: 15,
                                fontWeight: full || low ? 600 : 400,
                                color: full
                                  ? "var(--danger)"
                                  : low
                                    ? "var(--accent-hi)"
                                    : "var(--fg-2)",
                              }}
                            >
                              {quota}
                            </span>
                          )}
                        </span>
                        <span
                          className="tabular reg-cat-price"
                          style={{ color: sel ? "var(--accent-hi)" : "var(--fg)" }}
                        >
                          {formatEuros(categoryPriceInCents(category))}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ))}

          {/* ── ÉTAPE 2 — PRODUIT ─────────────────────────────────────────── */}
          {step === 2 && (
            <>
              {selectedCategory && (
                <p style={{ margin: 0, fontSize: 16, color: "var(--fg-2)" }}>
                  Catégorie :{" "}
                  <b style={{ color: "var(--fg)" }}>{selectedCategory.name}</b>{" "}
                  ·{" "}
                  <span className="tabular">
                    {formatEuros(categoryPriceInCents(selectedCategory))}
                  </span>
                </p>
              )}
              <div className="form-row">
                <Field
                  label="Nom du produit *"
                  placeholder="Platinum Haze v2"
                  value={data.name}
                  onChange={(v) => set("name", v)}
                  required
                />
                <Field
                  label="Producteur *"
                  placeholder="Studio Garden"
                  value={data.producer}
                  onChange={(v) => set("producer", v)}
                  required
                />
                <Field
                  label="Pays d'origine"
                  placeholder="Portugal"
                  value={data.origin}
                  onChange={(v) => set("origin", v)}
                />
                <Field
                  label="Année de récolte"
                  placeholder="2026"
                  value={data.vintage}
                  onChange={(v) => set("vintage", v)}
                />
              </div>
              {/* Déclaratif laboratoire */}
              <fieldset className="reg-fieldset">
                <legend style={{ padding: "0 6px", fontSize: 17, fontWeight: 600 }}>
                  Analyse déclarée
                </legend>
                <div className="form-row">
                  <Field
                    label="Taux de Δ9-THC (%) *"
                    name="thc"
                    placeholder="0,28"
                    value={data.thc}
                    onChange={(v) => set("thc", v)}
                    hint={`${MAX_THC_LABEL} maximum (réglementation européenne)`}
                    required
                  />
                  <Field
                    label="Taux de CBD total (%)"
                    name="cbd"
                    placeholder="12,4"
                    value={data.cbd}
                    onChange={(v) => set("cbd", v)}
                  />
                </div>
                <label
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    cursor: "pointer",
                  }}
                >
                  <Check
                    on={data.hasCoa}
                    onClick={() => set("hasCoa", !data.hasCoa)}
                  />
                  <span style={{ fontSize: 16, lineHeight: 1.5, color: "var(--fg-2)" }}>
                    Je fournirai un certificat d&apos;analyse (COA) à réception
                    de l&apos;échantillon.
                  </span>
                </label>
              </fieldset>
              {errorNotice}
            </>
          )}

          {/* ── ÉTAPE 3 — PANIER ──────────────────────────────────────────── */}
          {step === STEP_CART && (
            <>
              <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: "var(--fg-2)" }}>
                Inscrivez tous vos produits, dans une ou plusieurs catégories :
                ils seront réglés en un seul paiement, sur une seule facture.
              </p>
              {cartProducts.length === 0 ? (
                <div className="notice">Votre panier est vide pour l&apos;instant.</div>
              ) : (
                <div>
                  <ul style={{ ...listReset, borderTop: "1px solid var(--line)" }}>
                    {cartProducts.map((product) => (
                      <CartLine
                        key={product.id}
                        name={product.name}
                        category={product.category.name}
                        price={formatEuros(product.priceAtRegistration)}
                        action={
                          <button
                            type="button"
                            className="btn ghost reg-remove"
                            disabled={removeProduct.isPending}
                            onClick={() => void handleRemove(product.id)}
                            aria-label={`Retirer ${product.name}`}
                          >
                            Retirer
                          </button>
                        }
                      />
                    ))}
                  </ul>
                  <p
                    style={{
                      margin: 0,
                      paddingTop: 16,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      gap: 16,
                      fontSize: 17,
                      fontWeight: 600,
                    }}
                  >
                    <span>
                      Total · {cartProducts.length} produit
                      {cartProducts.length > 1 ? "s" : ""}
                    </span>
                    <span className="tabular" style={{ fontSize: 20, fontWeight: 700 }}>
                      {formatEuros(totalInCents)}
                    </span>
                  </p>
                </div>
              )}
              <div>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => {
                    setSubmitError(null);
                    setStep(1);
                  }}
                >
                  + Ajouter un autre produit
                </button>
              </div>
              {errorNotice}
            </>
          )}

          {/* ── ÉTAPE 4 — COORDONNÉES ─────────────────────────────────────── */}
          {step === 4 && (
            <>
              {/*
                Les coordonnées de facturation viennent du profil producteur :
                les saisir ici serait trompeur, `addProduct` ne les accepte pas
                et la facture les lit sur le profil.
              */}
              <div>
                <div className="kv">
                  <span className="kv-k">Email du compte</span>
                  <span className="kv-v reg-kv-v">
                    {session.user.email ?? "—"}
                  </span>
                </div>
                <div className="kv">
                  <span className="kv-k">Raison sociale</span>
                  <span className="kv-v reg-kv-v">
                    {producerProfile?.companyName ?? "—"}
                  </span>
                </div>
                <div className="kv">
                  <span className="kv-k">SIRET</span>
                  <span className="kv-v reg-kv-v">
                    {producerProfile?.siret ?? "Non renseigné"}
                  </span>
                </div>
                <div className="kv">
                  <span className="kv-k">Téléphone</span>
                  <span className="kv-v reg-kv-v">
                    {producerProfile?.phone ?? "Non renseigné"}
                  </span>
                </div>
              </div>
              <p className="form-foot" style={{ margin: 0 }}>
                Ces informations figureront sur votre facture.{" "}
                <Link href="/producer/profile">Modifier mon profil producteur</Link>
              </p>
              <div className="notice is-info">
                <b>Envoi des échantillons.</b> Après paiement, chaque produit
                reçoit un code anonyme et un QR code, à retrouver dans « Mes
                inscriptions ». Les instructions d&apos;envoi vous seront
                communiquées.
              </div>
            </>
          )}

          {/* ── ÉTAPE 5 — PAIEMENT ────────────────────────────────────────── */}
          {step === STEP_PAY && (
            <>
              {/*
                Aucun champ de carte ici : la saisie se fait sur la page de
                paiement hébergée par Viva.com, seule à voir les données de
                carte. Le moyen de paiement se choisit là-bas.
              */}
              <div className="reg-pay-box">
                <h3 style={{ margin: 0, fontSize: 18 }}>Paiement sécurisé par Viva.com</h3>
                {/* Logo viva.com : exigé par Viva sur les écrans de paiement
                    (validation de la source de paiement). Logo sombre, posé
                    sur un fond clair pour rester lisible en thème sombre. */}
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "8px 12px",
                    borderRadius: "var(--radius-control)",
                    background: "#ffffff",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/viva-logo.svg" alt="viva.com" width={104} height={18} />
                </span>
                <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: "var(--fg-2)" }}>
                  En validant, vous serez redirigé vers la page de paiement de{" "}
                  <b style={{ color: "var(--fg)" }}>Viva.com</b> pour régler{" "}
                  <b className="tabular" style={{ color: "var(--fg)" }}>
                    {formatEuros(totalInCents)}
                  </b>{" "}
                  pour {cartProducts.length} produit{cartProducts.length > 1 ? "s" : ""}, en
                  une seule fois. Votre inscription est confirmée dès que le
                  paiement est encaissé ; vous recevez alors votre facture par
                  email.
                </p>
              </div>

              {/* Terms checkbox */}
              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  cursor: "pointer",
                }}
              >
                <Check
                  on={data.accept}
                  onClick={() => set("accept", !data.accept)}
                />
                <span style={{ fontSize: 16, lineHeight: 1.5, color: "var(--fg-2)" }}>
                  J&apos;accepte le règlement de la Platinum CBD Cup et je
                  certifie que chacun des produits inscrits respecte la
                  réglementation européenne en vigueur (Δ9-THC ≤ {MAX_THC_LABEL}).
                </span>
              </label>

              {errorNotice}
            </>
          )}

          {/* ── NAVIGATION ────────────────────────────────────────────────── */}
          <div className="reg-nav">
            <button
              type="button"
              className="btn ghost"
              disabled={step === 1 && cartProducts.length === 0}
              onClick={() => {
                setSubmitError(null);
                // Depuis le choix de catégorie, « Précédent » ramène au panier
                // quand il contient déjà des produits.
                setStep((s) => (s === 1 ? STEP_CART : Math.max(1, s - 1)));
              }}
              style={{
                opacity: step === 1 && cartProducts.length === 0 ? 0.3 : 1,
              }}
            >
              {step === 1 && cartProducts.length > 0 ? "← Retour au panier" : "← Précédent"}
            </button>
            <button
              type="button"
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
        </section>

        {/* ── DROITE : RÉCAPITULATIF ──────────────────────────────────────── */}
        <aside
          className="form-card reg-summary"
          aria-labelledby="register-summary-title"
        >
          <h2 id="register-summary-title" style={{ fontSize: 20, marginBottom: 8 }}>
            Récapitulatif
          </h2>
          <ul style={listReset}>
            {cartProducts.map((product) => (
              <CartLine
                key={product.id}
                name={product.name}
                category={product.category.name}
                price={formatEuros(product.priceAtRegistration)}
              />
            ))}
            {/* Produit en cours de saisie, pas encore ajouté au panier */}
            {step <= 2 && selectedCategory && (
              <CartLine
                muted
                name={data.name || "Nouveau produit"}
                category={`${selectedCategory.name} · pas encore ajouté`}
                price={formatEuros(categoryPriceInCents(selectedCategory))}
              />
            )}
          </ul>
          {cartProducts.length === 0 && !(step <= 2 && selectedCategory) && (
            <p style={{ margin: "8px 0 0", fontSize: 16, color: "var(--fg-3)" }}>
              Votre panier est vide.
            </p>
          )}
          <p
            style={{
              margin: "16px 0 0",
              paddingTop: 16,
              borderTop: "1px solid var(--line-strong)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              gap: 16,
            }}
          >
            <span style={{ fontSize: 17, fontWeight: 600 }}>Total</span>
            <span className="tabular" style={{ fontSize: 28, fontWeight: 700 }}>
              {formatEuros(totalInCents)}
            </span>
          </p>
        </aside>
      </div>
    </div>
  );
}
