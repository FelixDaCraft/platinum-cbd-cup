import Link from "next/link";

/**
 * 404 racine.
 *
 * Le portail a la sienne — (portal)/not-found.tsx, rendue dans le shell
 * Platinum. Celle-ci couvre tout ce qui tombe hors des groupes de routes :
 * une URL inventée, un ancien lien du site précédent, un chemin sous
 * /dashboard ou /jury qui n'existe plus. Sans elle, ces adresses servaient
 * l'écran Next par défaut — fond blanc, « This page could not be found »,
 * aucun retour possible.
 *
 * Elle n'utilise que les classes du design system déjà injectées par le
 * layout racine : pas de shell, donc pas de barre de navigation ici, mais
 * l'identité visuelle et une issue.
 */
export default function RootNotFound() {
  return (
    // `.shell` conditionne l'usage de la police d'affichage Louize sur les
    // titres, `.page` porte les marges latérales du design system.
    <div className="shell">
      <div className="page page-enter" style={{ paddingTop: 96, maxWidth: 620 }}>
        <p
          className="mono fg3"
          style={{ fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase" }}
        >
          Erreur 404
        </p>
        <h1 className="display" style={{ marginTop: 18, marginBottom: 12 }}>
          Page introuvable<em>.</em>
        </h1>
        <p className="lede">
          L&apos;adresse demandée n&apos;existe pas, ou plus. Elle a pu être
          déplacée, dépubliée, ou simplement mal recopiée.
        </p>

        <div style={{ display: "flex", gap: 12, marginTop: 36, flexWrap: "wrap" }}>
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
      </div>
    </div>
  );
}
