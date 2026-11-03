import { useTranslations } from "next-intl";
import { Link } from "~/i18n/navigation";

/**
 * 404 du portail public.
 *
 * Capte les `notFound()` des pages de cup, d'article et de partenaire, qui
 * jusqu'ici tombaient sur l'écran Next par défaut : fond blanc, texte anglais,
 * aucun lien de retour. Rendu à l'intérieur du PlatinumShell, il conserve la
 * barre de navigation et le pied de page.
 */
export default function PortalNotFound() {
  const t = useTranslations("notFound");
  const tError = useTranslations("errorPage");
  const tNav = useTranslations("nav");
  return (
    <div className="pg pg--narrow page-enter">
      <header className="pg-head">
        <h1 className="display">{t("title")}</h1>
        <p className="pg-lede">{t("lede")}</p>
      </header>

      <div className="home-actions">
        <Link href="/" className="btn accent">
          {tError("home")} <span className="btn-arrow">→</span>
        </Link>
        <Link href="/palmares" className="btn ghost">
          {tNav("seePalmares")}
        </Link>
      </div>

      <p className="pg-meta" style={{ marginTop: 32, marginBottom: 0 }}>
        {t("mistake")}{" "}
        <Link href="/contact" className="pg-link">
          {tError("contact")}
        </Link>
        .
      </p>
    </div>
  );
}
