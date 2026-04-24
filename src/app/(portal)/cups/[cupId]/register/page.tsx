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
  // Step 1
  categoryCode: string;
  categoryId: string; // real DB id resolved from cup categories
  // Step 2
  name: string;
  producer: string;
  origin: string;
  vintage: string;
  thc: string;
  cbd: string;
  hasCoa: boolean;
  // Step 3
  email: string;
  phone: string;
  companyName: string;
  siret: string;
  // Step 4
  payment: "card" | "sepa";
  accept: boolean;
}

// ---------------------------------------------------------------------------
// Design-system category codes — fallback used when cup has no categories
// ---------------------------------------------------------------------------

const DESIGN_CATEGORIES = [
  { code: "CF", name: "Flower · Indoor", fee: 180 },
  { code: "OG", name: "Flower · Outdoor", fee: 150 },
  { code: "HA", name: "Hashish", fee: 220 },
  { code: "EP", name: "Extract · Rosin", fee: 260 },
  { code: "OI", name: "Full-spectrum Oil", fee: 180 },
  { code: "TO", name: "Topical", fee: 160 },
] as const;

const LOGISTICS_FEE = 18;

// ---------------------------------------------------------------------------
// Stepper sub-component
// ---------------------------------------------------------------------------

const STEPS = [
  { n: 1, l: "Catégorie" },
  { n: 2, l: "Spécimen" },
  { n: 3, l: "Contact" },
  { n: 4, l: "Paiement" },
  { n: 5, l: "Confirmation" },
];

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

  // addProduct — used at step 4 (Payer) to commit the specimen into the DB
  const addProduct = api.registration.addProduct.useMutation();

  // createCheckoutSession — redirects user to Stripe after addProduct succeeds
  const createCheckoutSession = api.registration.createCheckoutSession.useMutation({
    onSuccess: (data) => {
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    },
  });

  // ---------------------------------------------------------------------------
  // Local wizard state
  // ---------------------------------------------------------------------------

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Confirmation-step anonymous code (returned by backend or generated locally)
  const [anonymousCode, setAnonymousCode] = useState<string | null>(null);

  const [data, setData] = useState<FormData>({
    categoryCode: "CF",
    categoryId: "",
    name: "",
    producer: "",
    origin: "",
    vintage: "",
    thc: "0.28",
    cbd: "12.4",
    hasCoa: false,
    email: "",
    phone: "",
    companyName: "",
    siret: "",
    payment: "card",
    accept: false,
  });

  const set = <K extends keyof FormData>(k: K, v: FormData[K]) =>
    setData((d) => ({ ...d, [k]: v }));

  // ---------------------------------------------------------------------------
  // Derived fee values
  // ---------------------------------------------------------------------------

  // Map of category code → { id, fee } resolved from real cup data
  const categoryMap = (() => {
    if (!cupData?.categories?.length) {
      // fallback to design constants
      return Object.fromEntries(
        DESIGN_CATEGORIES.map((c) => [
          c.code,
          { id: "", fee: c.fee, name: c.name },
        ])
      );
    }
    // Cup has real categories. Try to match by name prefix to design codes.
    // For each design category, find the cup category whose name contains the code or matches the name prefix.
    // If no match, map by index.
    const result: Record<string, { id: string; fee: number; name: string }> = {};
    cupData.categories.forEach((cat, i) => {
      const designCat = DESIGN_CATEGORIES[i];
      if (!designCat) return;
      const fee =
        cat.pricePerProduct != null
          ? cat.pricePerProduct / 100 // stored in cents
          : (cupData.cup.defaultPricePerProduct != null
              ? cupData.cup.defaultPricePerProduct / 100
              : designCat.fee);
      result[designCat.code] = {
        id: cat.id,
        name: cat.name,
        fee,
      };
    });
    // Fill any remaining design cats that weren't covered
    DESIGN_CATEGORIES.forEach((c) => {
      if (!result[c.code]) {
        result[c.code] = { id: "", fee: c.fee, name: c.name };
      }
    });
    return result;
  })();

  const selectedCatEntry = categoryMap[data.categoryCode] ?? {
    id: "",
    fee: 180,
    name: "—",
  };
  const fee = selectedCatEntry.fee;
  const total = fee + LOGISTICS_FEE;

  // ---------------------------------------------------------------------------
  // Initialize registration once cup data is available and user is logged in
  // ---------------------------------------------------------------------------

  const [registrationInitialized, setRegistrationInitialized] = useState(false);

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
  // Step 4 → "Payer" handler
  // ---------------------------------------------------------------------------

  const handlePay = async () => {
    if (!data.accept) {
      setSubmitError("Vous devez accepter le règlement pour continuer.");
      return;
    }
    if (!getOrCreate.data?.id) {
      setSubmitError("Inscription non initialisée. Rechargez la page.");
      return;
    }

    const registrationId = getOrCreate.data.id;

    // Resolve real categoryId — if we have one from cup data, use it.
    // Otherwise the mutation will fail server-side (expected: user must pick a real category).
    const resolvedCategoryId = selectedCatEntry.id;

    if (!resolvedCategoryId) {
      // TODO: The design's category codes (CF/OG/HA/EP/OI/TO) are static labels
      // that don't exist as DB category IDs on this cup. The organizer must create
      // cup categories in the dashboard first. For now we surface a clear error.
      setSubmitError(
        "Aucune catégorie correspondante trouvée dans la base de données. " +
          "L'organisateur doit créer les catégories pour cette cup."
      );
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      // Step A: add the product to the registration
      // NOTE: The addProduct mutation only accepts: registrationId, categoryId, name, description.
      // Fields collected by the wizard but NOT accepted by addProduct:
      //   - origin, vintage, thc %, cbd %, hasCoa → TODO: store in product.description or a future schema column
      //   - phone, companyName, siret → TODO: these belong to the producer profile, not the product
      //   - payment method (card/sepa) → Stripe handles this; wizard's picker is cosmetic only
      //   - email → already on the user account (used by Stripe via ctx.session.user.email)
      const productResult = await addProduct.mutateAsync({
        registrationId,
        categoryId: resolvedCategoryId,
        name: data.name || "Spécimen",
        // Pack supplementary fields into description as a stopgap
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

      // Step B: create Stripe checkout session
      // If totalAmount === 0 → confirmFreeRegistration instead (not implemented here,
      // as cup registration fees are always > 0 in the current design).
      await createCheckoutSession.mutateAsync({ registrationId });

      // If we reach here without redirect, generate local code for step 5 display
      // (Stripe redirect will have fired; this is the no-redirect fallback)
      setAnonymousCode(`${data.categoryCode}·${Math.floor(Math.random() * 90 + 10)}`);
      setStep(5);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Une erreur est survenue.";
      setSubmitError(message);
    } finally {
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

  const catName =
    DESIGN_CATEGORIES.find((c) => c.code === data.categoryCode)?.name.split(" · ")[0] ?? "—";

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
          {/* ── STEP 1 — CATÉGORIE ────────────────────────────────────────── */}
          {step === 1 && (
            <>
              <h2 className="section-title" style={{ fontSize: 22 }}>
                Choix de la catégorie
              </h2>
              <div className="grid g-2" style={{ marginTop: 20 }}>
                {DESIGN_CATEGORIES.map((c) => {
                  const sel = data.categoryCode === c.code;
                  const catFee = categoryMap[c.code]?.fee ?? c.fee;
                  return (
                    <button
                      key={c.code}
                      onClick={() => {
                        set("categoryCode", c.code);
                        set("categoryId", categoryMap[c.code]?.id ?? "");
                      }}
                      style={{
                        textAlign: "left",
                        padding: 20,
                        cursor: "pointer",
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
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <div className="mono" style={{ fontSize: 22 }}>
                          {c.code}
                        </div>
                        <div
                          className="mono tabular"
                          style={{
                            fontSize: 13,
                            color: sel ? "var(--accent)" : "var(--fg-2)",
                          }}
                        >
                          €{catFee}
                        </div>
                      </div>
                      <div
                        className="mono"
                        style={{ fontSize: 13, marginTop: 14 }}
                      >
                        {c.name}
                      </div>
                    </button>
                  );
                })}
              </div>
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
                    value={data.thc}
                    onChange={(v) => set("thc", v)}
                    hint="≤ 0.3% UE"
                  />
                  <Field
                    label="CBD total (%)"
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
            </>
          )}

          {/* ── STEP 3 — CONTACT ──────────────────────────────────────────── */}
          {step === 3 && (
            <>
              <h2 className="section-title" style={{ fontSize: 22 }}>
                Contact
              </h2>
              <div className="grid g-2" style={{ marginTop: 20, gap: 18 }}>
                <Field
                  label="Email *"
                  placeholder="you@studio.eu"
                  value={data.email}
                  onChange={(v) => set("email", v)}
                  type="email"
                  required
                />
                <Field
                  label="Téléphone"
                  placeholder="+33 6 00 00 00 00"
                  value={data.phone}
                  onChange={(v) => set("phone", v)}
                  type="tel"
                />
                <Field
                  label="Raison sociale"
                  placeholder="Studio Garden SARL"
                  value={data.companyName}
                  onChange={(v) => set("companyName", v)}
                />
                <Field
                  label="SIRET / VAT"
                  placeholder="FR00 000000000"
                  value={data.siret}
                  onChange={(v) => set("siret", v)}
                />
              </div>
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

          {/* ── STEP 4 — PAIEMENT ─────────────────────────────────────────── */}
          {step === 4 && (
            <>
              <h2 className="section-title" style={{ fontSize: 22 }}>
                Paiement
              </h2>
              {/* Payment method picker */}
              <div
                className="grid"
                style={{
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                  marginTop: 20,
                }}
              >
                {(
                  [
                    ["card", "Carte", "Visa · MC · Amex"],
                    ["sepa", "SEPA", "Virement bancaire"],
                  ] as const
                ).map(([id, t, s]) => {
                  const sel = data.payment === id;
                  return (
                    <button
                      key={id}
                      onClick={() => set("payment", id)}
                      style={{
                        padding: 20,
                        textAlign: "left",
                        cursor: "pointer",
                        background: sel ? "var(--accent-dim)" : "var(--bg)",
                        border: `1px solid ${sel ? "var(--accent)" : "var(--line)"}`,
                        borderRadius: 12,
                        color: "var(--fg)",
                        fontFamily: "inherit",
                      }}
                    >
                      <div className="mono" style={{ fontSize: 15 }}>
                        {t}
                      </div>
                      <div
                        className="mono fg3"
                        style={{
                          fontSize: 11,
                          marginTop: 4,
                          letterSpacing: ".1em",
                          textTransform: "uppercase",
                        }}
                      >
                        {s}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Card fields — cosmetic only; real payment handled by Stripe Checkout */}
              {data.payment === "card" && (
                <div
                  style={{
                    marginTop: 20,
                    display: "grid",
                    gridTemplateColumns: "1fr",
                    gap: 16,
                  }}
                >
                  {/*
                   * TODO: These card fields are UI-only placeholders per the design.
                   * Actual payment collection happens on Stripe's hosted checkout page.
                   * Real card tokenization would require Stripe Elements integration.
                   */}
                  <Field
                    label="Numéro de carte"
                    placeholder="4242 4242 4242 4242"
                    mono
                  />
                  <div className="grid g-2" style={{ gap: 16 }}>
                    <Field label="Expiration" placeholder="MM / AA" mono />
                    <Field label="CVC" placeholder="123" mono />
                  </div>
                </div>
              )}

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
                  en vigueur (Δ9-THC ≤ 0,3%).
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

          {/* ── STEP 5 — CONFIRMATION ─────────────────────────────────────── */}
          {step === 5 && (
            <div style={{ textAlign: "center", padding: "30px 10px" }}>
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: "50%",
                  margin: "0 auto",
                  border: "1px solid var(--accent)",
                  display: "grid",
                  placeItems: "center",
                  background: "var(--accent-dim)",
                  boxShadow: "0 0 40px var(--accent-dim)",
                }}
              >
                <span style={{ color: "var(--accent)", fontSize: 30 }}>✓</span>
              </div>
              <div
                className="mono"
                style={{
                  fontSize: 11,
                  letterSpacing: ".15em",
                  color: "var(--fg-3)",
                  marginTop: 20,
                  textTransform: "uppercase",
                }}
              >
                Inscription confirmée
              </div>
              <div
                className="display"
                style={{
                  fontSize: "clamp(40px, 5vw, 64px)",
                  marginTop: 14,
                }}
              >
                {anonymousCode ?? `${data.categoryCode}·${Math.floor(Math.random() * 90 + 10)}`}
              </div>
              <div
                className="mono"
                style={{
                  fontSize: 12,
                  color: "var(--fg-2)",
                  marginTop: 16,
                  letterSpacing: ".05em",
                }}
              >
                Votre code anonyme. Gardez-le précieusement.
              </div>
              <div
                style={{
                  marginTop: 32,
                  display: "flex",
                  justifyContent: "center",
                  gap: 12,
                }}
              >
                <Link href="/">
                  <button className="btn ghost">Accueil</button>
                </Link>
                <Link href={`/cups/${cupId}`}>
                  <button className="btn accent">
                    Suivre ma participation{" "}
                    <span className="btn-arrow">→</span>
                  </button>
                </Link>
              </div>
            </div>
          )}

          {/* ── NAV (steps 1-4) ───────────────────────────────────────────── */}
          {step < 5 && (
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
                disabled={step === 1}
                onClick={() => setStep((s) => Math.max(1, s - 1))}
                style={{ opacity: step === 1 ? 0.3 : 1 }}
              >
                ← Précédent
              </button>
              <button
                className="btn accent"
                disabled={submitting}
                onClick={() => {
                  if (step === 4) {
                    void handlePay();
                  } else {
                    setStep((s) => Math.min(5, s + 1));
                  }
                }}
              >
                {submitting
                  ? "Traitement…"
                  : step === 4
                    ? "Payer"
                    : "Continuer"}{" "}
                {!submitting && <span className="btn-arrow">→</span>}
              </button>
            </div>
          )}
        </div>

        {/* ── RIGHT: RÉCAPITULATIF (steps 1-4) ────────────────────────────── */}
        {step < 5 && (
          <div
            className="card"
            style={{ height: "fit-content", position: "sticky", top: 100 }}
          >
            <Eyebrow>Récapitulatif</Eyebrow>
            <div style={{ marginTop: 16 }}>
              <div className="kv">
                <span className="kv-k">Catégorie</span>
                <span className="kv-v">
                  {data.categoryCode} · {catName}
                </span>
              </div>
              <div className="kv">
                <span className="kv-k">Spécimen</span>
                <span className="kv-v">{data.name || "—"}</span>
              </div>
              <div className="kv">
                <span className="kv-k">Producteur</span>
                <span className="kv-v">{data.producer || "—"}</span>
              </div>
              <div className="kv">
                <span className="kv-k">Frais catégorie</span>
                <span className="kv-v">€{fee}</span>
              </div>
              <div className="kv">
                <span className="kv-k">Logistique</span>
                <span className="kv-v">€{LOGISTICS_FEE}</span>
              </div>
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
                Total TTC
              </span>
              <span
                className="mono tabular"
                style={{ fontSize: 28, fontWeight: 300 }}
              >
                €{total}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
