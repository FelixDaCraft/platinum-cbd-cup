import { PlatinumShell } from "~/components/portal/platinum";
import PortalNotFound from "./(portal)/not-found";

/**
 * 404 racine.
 *
 * Couvre tout ce qui tombe hors des groupes de routes : une URL inventée, un
 * ancien lien du site précédent, un chemin sous /dashboard ou /jury qui
 * n'existe plus. On la rend dans le shell du portail, avec le même contenu
 * que la 404 du portail : en-tête, navigation (barre basse sur mobile) et
 * pied de page offrent une issue, au lieu d'une page isolée.
 *
 * Le statut « live » n'est pas lu ici (pas d'accès base sur une 404) : le
 * bouton principal de l'en-tête retombe sur « Voir le palmarès ».
 */
export default function RootNotFound() {
  return (
    <PlatinumShell>
      <PortalNotFound />
    </PlatinumShell>
  );
}
