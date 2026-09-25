import Link from "next/link";
import { Eyebrow } from "~/components/portal/platinum";

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
    <div className="page-enter">
      <section
        style={{
          paddingTop: 72,
          paddingBottom: 72,
          maxWidth: 680,
          margin: "0 auto",
        }}
      >
        <Eyebrow>Erreur 404</Eyebrow>
        <h1 className="display" style={{ marginTop: 18, marginBottom: 12 }}>
          Page introuvable<em>.</em>
        </h1>
        <p className="lede">
          Cette page n&apos;existe pas, ou plus : une édition dépubliée, un
          article retiré ou une adresse mal recopiée.
        </p>

        <div
          style={{
            display: "flex",
            gap: 12,
            marginTop: 36,
            flexWrap: "wrap",
          }}
        >
          <Link href="/" className="btn accent">
            Retour à l&apos;accueil <span className="btn-arrow">→</span>
          </Link>
          <Link href="/palmares" className="btn ghost">
            Voir le palmarès
          </Link>
          <Link href="/contact" className="btn ghost">
            Nous contacter
          </Link>
        </div>
      </section>
    </div>
  );
}
