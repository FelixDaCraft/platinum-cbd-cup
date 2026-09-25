import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { auth } from "~/lib/auth";
import { getUserPortalAccess } from "~/lib/portal/server-auth";

import { DashboardShell } from "./_dashboard-shell";

export const metadata: Metadata = {
  title: {
    default: "Platinum CBD Cup — Organisateur",
    template: "%s — Organisateur",
  },
  description: "Espace organisateur - Pilotez les cups, les jurys et le portail",
  // Espace authentifié : rien à indexer.
  robots: { index: false, follow: false },
};

/**
 * Garde serveur de l'espace organisateur.
 *
 * La coquille (`DashboardShell`) est un composant client : elle ne pouvait
 * donc vérifier le rôle qu'après hydratation, une fois le squelette du
 * tableau de bord déjà envoyé au navigateur. Le middleware, lui, ne contrôle
 * que la PRÉSENCE d'un cookie de session, ni sa validité ni le rôle.
 * Résultat : un producteur ou un juré authentifié recevait la structure de
 * navigation de l'organisateur avant d'être renvoyé.
 *
 * Les données restent protégées par `organizerProcedure` côté tRPC ; cette
 * garde ferme la fuite de structure et évite le clignotement.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect("/login?callbackUrl=/dashboard");
  }

  const access = await getUserPortalAccess();

  if (!access.roles.includes("organizer")) {
    // L'utilisateur est authentifié mais n'est pas organisateur. Ne jamais le
    // renvoyer vers /login, qui redirige selon le rôle et le ferait revenir
    // ici en boucle.
    redirect("/");
  }

  return <DashboardShell>{children}</DashboardShell>;
}
