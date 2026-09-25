"use client";

import { NothingOrganizerLayout } from "~/components/dashboard/nothing-organizer-layout";

/**
 * Coquille cliente de l'espace organisateur.
 *
 * Elle ne contient plus AUCUNE garde d'accès : `layout.tsx` (composant
 * serveur) vérifie la session et le rôle avant même de rendre cet arbre.
 * Dupliquer la vérification ici ne protégeait rien — la structure était déjà
 * envoyée — mais coûtait un écran « [LOADING...] » à chaque navigation froide
 * et faisait diverger deux logiques d'autorisation.
 */
export function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return <NothingOrganizerLayout>{children}</NothingOrganizerLayout>;
}
