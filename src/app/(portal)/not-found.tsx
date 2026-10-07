import Link from "next/link";

/**
 * 404 du portail public.
 *
 * Capte les `notFound()` des pages de cup, d'article et de partenaire, qui
 * jusqu'ici tombaient sur l'écran Next par défaut : fond blanc, texte anglais,
 * aucun lien de retour. Rendu à l'intérieur du PlatinumShell, il conserve la
 * barre de navigation et le pied de page.
 */
export default function PortalNotFound() {
  return (
    <div className="pg pg--narrow page-enter">
      <header className="pg-head">
        <h1 className="display">Page introuvable</h1>
        <p className="pg-lede">
          Cette page n&apos;existe pas, ou plus : une édition dépubliée, un
          article retiré ou une adresse mal recopiée.
        </p>
      </header>

      <div className="home-actions">
        <Link href="/" className="btn accent">
          Retour à l&apos;accueil <span className="btn-arrow">→</span>
        </Link>
        <Link href="/palmares" className="btn ghost">
          Voir le palmarès
        </Link>
      </div>

      <p className="pg-meta" style={{ marginTop: 32, marginBottom: 0 }}>
        Vous pensez qu&apos;il s&apos;agit d&apos;une erreur ?{" "}
        <Link href="/contact" className="pg-link">
          Contactez-nous
        </Link>
        .
      </p>
    </div>
  );
}
