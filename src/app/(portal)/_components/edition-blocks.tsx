import Link from "next/link";
import { JURY_PANEL_LABELS } from "~/lib/enums";
import {
  formatPrice,
  placesLine,
  tierName,
  tierRange,
  uniqueTiers,
  type EditionDetails,
  type LabelTier,
  type Phase,
  type Step,
} from "../_lib/edition";

/**
 * Blocs de présentation d'une édition, partagés par l'accueil et la page
 * d'une édition (direction « Grand Cru », styles .home-* du portail).
 */

const STEP_TAG: Record<Step["state"], string> = {
  done: "Terminé",
  current: "En cours",
  next: "À venir",
};

export function EditionStatus({ text, open }: { text: string; open: boolean }) {
  return (
    <p className={`home-status${open ? " is-open" : ""}`}>
      <span className="home-status-dot" aria-hidden="true" />
      {text}
    </p>
  );
}

/** Bandeau pleine largeur du calendrier ; rien si aucune date n'est connue. */
export function EditionSteps({ steps, year }: { steps: Step[]; year: number }) {
  if (steps.length === 0) return null;
  return (
    <section className="home-band" aria-label={`Calendrier de l'édition ${year}`}>
      <ol className="home-steps">
        {steps.map((step) => (
          <li key={step.title} className={`home-step is-${step.state}`}>
            <span className="home-step-tag">{STEP_TAG[step.state]}</span>
            <span className="home-step-title">{step.title}</span>
            <span className="home-step-when">{step.when}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function JuriesExplainer({ labels }: { labels: LabelTier[] }) {
  const tiers = uniqueTiers(labels);
  return (
    <section className="home-section">
      <div className="home-section-head">
        <h2 className="section-title">Deux jurys, deux palmarès</h2>
        <p className="home-section-lede">
          Les échantillons sont anonymisés, avec un code différent pour chaque
          jury. Personne ne voit ni la marque, ni l&apos;origine, ni le prix.
        </p>
      </div>
      <div className="home-juries">
        <article className="home-jury">
          <p className="eyebrow home-jury-kicker is-pro">Jury professionnel</p>
          <h3>Le classement des experts</h3>
          <p>
            Producteurs, sommeliers, analystes : chaque juré note l&apos;aspect,
            l&apos;odeur, le goût et l&apos;effet. Il en sort un classement par
            catégorie.
          </p>
        </article>
        <article className="home-jury">
          <p className="eyebrow home-jury-kicker">Jury public</p>
          <h3>Les labels et le Prix du public</h3>
          <p>
            Des consommateurs notent chez eux, à partir d&apos;un coffret
            d&apos;échantillons. Leur note décerne le Prix du public
            {tiers.length > 0 ? " et les labels :" : " et les labels."}
          </p>
          {tiers.length > 0 && (
            <ul className="home-tiers">
              {tiers.map((tier) => (
                <li key={tier.name}>
                  <span
                    className="home-tier-dot"
                    style={{ background: tier.color ?? "var(--accent)" }}
                    aria-hidden="true"
                  />
                  {tierName(tier.name)} · {tierRange(tier)}
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>
    </section>
  );
}

/**
 * Catégories, tarifs et places restantes. Les places ne s'affichent que tant
 * qu'on peut encore s'inscrire.
 */
export function CategoryPrices({
  edition,
  phase,
  registerHref,
  showCriteria = false,
}: {
  edition: EditionDetails;
  phase: Phase;
  registerHref: string;
  showCriteria?: boolean;
}) {
  if (edition.categories.length === 0) return null;
  const showPlaces = phase === "open" || phase === "upcoming";
  // Les éditions terminées n'ont souvent pas de tarif enregistré : afficher
  // « Gratuit » y serait faux.
  const showPrices = phase !== "done";
  return (
    <section className="home-section">
      <div className="home-section-head is-split">
        <h2 className="section-title">
          {showPrices ? "Catégories et tarifs" : "Catégories"} {edition.year}
        </h2>
        {showPrices && (
          <p className="home-section-note">
            Tarif par produit inscrit · plusieurs catégories en une seule commande
          </p>
        )}
      </div>
      <ul className="home-cats">
        {edition.categories.map((cat) => {
          const places = showPlaces ? placesLine(cat.remaining) : { text: "", tone: "" };
          return (
            <li key={cat.id} className={places.tone === "full" ? "is-full" : undefined}>
              <span className="home-cat-name">
                {cat.name}
                {showCriteria &&
                  cat.criteria.map((group) => (
                    <span key={group.panel} className="home-cat-criteria">
                      {/* Une seule grille (édition à un jury) : pas d'étiquette. */}
                      {cat.criteria.length > 1 && `${JURY_PANEL_LABELS[group.panel]} : `}
                      {group.names.join(" · ")}
                    </span>
                  ))}
              </span>
              <span className={`home-cat-places${places.tone === "low" ? " is-low" : ""}`}>
                {places.text}
              </span>
              <span className="home-cat-price">
                {showPrices ? formatPrice(cat.priceCents, edition.currency) : ""}
              </span>
            </li>
          );
        })}
      </ul>
      {phase === "open" && (
        <Link href={registerHref} className="btn accent btn-lg home-cats-cta">
          Inscrire mes produits
        </Link>
      )}
    </section>
  );
}
