import { useLocale, useTranslations } from "next-intl";
import { Link } from "~/i18n/navigation";
import type { Locale } from "~/i18n/locales";
import { LiquidText, Sparkle } from "~/components/portal/street/street";
import {
  formatPrice,
  formatShortDay,
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
 * d'une édition (direction « street » 2027, styles .st-* du portail).
 */

export function EditionStatus({ text, open }: { text: string; open: boolean }) {
  return (
    <p className={`st-status${open ? " is-open" : ""}`}>{text}</p>
  );
}

/** Dates condensées d'une étape : « 10.10 → 31.12.2026 ». */
function stepDates(step: Step): string | null {
  if (step.start != null && step.end != null) {
    return `${formatShortDay(step.start)} → ${formatShortDay(step.end, true)}`;
  }
  const one = step.end ?? step.start;
  return one != null ? formatShortDay(one, true) : null;
}

/** Bandeau pleine largeur du calendrier ; rien si aucune date n'est connue. */
export function EditionSteps({ steps, year }: { steps: Step[]; year: number }) {
  const t = useTranslations("edition");
  if (steps.length === 0) return null;
  return (
    <section className="st-steps" aria-label={t("calendarAria", { year })}>
      <ol>
        {steps.map((step) => {
          const dates = stepDates(step);
          return (
            <li key={step.title} className={`st-step is-${step.state}`}>
              <span className="st-step-tag">
                {step.state === "current" && <Sparkle size={12} decorative />}
                {t(`stepTag.${step.state}`)}
              </span>
              <span className="st-step-title">{step.title}</span>
              {dates && (
                <span className="st-step-dates" aria-hidden="true">
                  {dates}
                </span>
              )}
              <span className={dates ? "st-step-when" : "st-step-when is-visible"}>{step.when}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function JuriesExplainer({ labels }: { labels: LabelTier[] }) {
  const t = useTranslations("juries");
  const tEdition = useTranslations("edition");
  const locale = useLocale() as Locale;
  const tiers = uniqueTiers(labels);
  return (
    <section className="st-sec st-juries" aria-labelledby="deux-jurys">
      <div className="st-sec-head">
        <h2 id="deux-jurys" className="st-h2">
          {t.rich("title", { br: () => <br /> })}
        </h2>
        <p className="st-sec-lede">{t("lede")}</p>
      </div>

      <div className="st-juries-grid">
        <article className="st-jury">
          <LiquidText className="st-jury-word" seed={3} intensity={0.8} fit={t("proWord").length}>
            {t("proWord")}
          </LiquidText>
          <h3>{t("proTitle")}</h3>
          <p>{t("proText")}</p>
        </article>

        <figure className="st-sample">
          <figcaption className="st-sample-head">
            <span>{t("sampleLabel")}</span>
            <span className="st-sample-flag">{t("sampleFlag")}</span>
          </figcaption>
          <dl className="st-sample-codes">
            <div>
              <dt>{t("proCode")}</dt>
              <dd>FI27</dd>
            </div>
            <div>
              <dt>{t("publicCode")}</dt>
              <dd>FI64</dd>
            </div>
          </dl>
          <p className="st-sample-note">{t("sampleNote")}</p>
        </figure>

        <article className="st-jury is-public">
          <LiquidText className="st-jury-word" seed={9} intensity={0.8} fit={t("publicWord").length}>
            {t("publicWord")}
          </LiquidText>
          <h3>{t("publicTitle")}</h3>
          <p>{t(tiers.length > 0 ? "publicTextWithTiers" : "publicText")}</p>
          {tiers.length > 0 && (
            <ul className="st-tiers">
              {tiers.map((tier) => (
                <li key={tier.name}>
                  <span
                    className="st-dot"
                    style={{ background: tier.color ?? "var(--accent)" }}
                    aria-hidden="true"
                  />
                  <b>{tierName(tier.name)}</b>
                  <span>{tierRange(tier, tEdition, locale)}</span>
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
  const t = useTranslations("edition");
  const tNav = useTranslations("nav");
  const tPanels = useTranslations("panels");
  const locale = useLocale() as Locale;
  if (edition.categories.length === 0) return null;
  const showPlaces = phase === "open" || phase === "upcoming";
  // Les éditions terminées n'ont souvent pas de tarif enregistré : afficher
  // « Gratuit » y serait faux.
  const showPrices = phase !== "done";
  return (
    <section className="st-sec st-cats" aria-labelledby="categories">
      <div className="st-sec-head is-split">
        <h2 id="categories" className="st-h2">
          {t(showPrices ? "categoriesAndPrices" : "categoriesTitle", { year: edition.year })}
        </h2>
        {showPrices && <p className="st-sec-lede">{t("pricesLede")}</p>}
      </div>
      <ul className="st-cats-list">
        {edition.categories.map((cat) => {
          const places = showPlaces ? placesLine(cat.remaining, t) : { text: "", tone: "" };
          return (
            <li key={cat.id} className={places.tone === "full" ? "is-full" : undefined}>
              <span className="st-cat-name">
                {cat.name}
                {showCriteria &&
                  cat.criteria.map((group) => (
                    <span key={group.panel} className="st-cat-criteria">
                      {/* Une seule grille (édition à un jury) : pas d'étiquette. */}
                      {cat.criteria.length > 1 && t("criteriaPrefix", { panel: tPanels(group.panel) })}
                      {/* Les numéros internes (« 1.1 ») n'aident pas le producteur. */}
                      {group.names.map((n) => n.replace(/^\d+(\.\d+)*\.?\s+/, "")).join(" · ")}
                    </span>
                  ))}
              </span>
              <span className={`st-cat-places${places.tone ? ` is-${places.tone}` : ""}`}>
                {places.text}
              </span>
              <span className="st-cat-price">
                {showPrices ? formatPrice(cat.priceCents, edition.currency, locale, t("free")) : ""}
              </span>
            </li>
          );
        })}
      </ul>
      {phase === "open" && (
        <Link href={registerHref} className="btn accent btn-lg st-cats-cta">
          {tNav("registerProducts")}
        </Link>
      )}
    </section>
  );
}
