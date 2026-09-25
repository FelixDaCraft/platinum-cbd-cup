/**
 * Authentification partagée par les routes REST de `src/app/api/*`.
 *
 * Les routes REST ne passent pas par le contexte tRPC : chacune refaisait sa
 * propre lecture de session puis son propre contrôle de rôle, avec des
 * messages d'erreur et des codes différents pour la même situation. Un seul
 * endroit décide désormais qui est le demandeur et ce qu'il a le droit de
 * faire, pour qu'un durcissement futur (journalisation, comptes suspendus…)
 * n'ait qu'un point d'entrée à modifier.
 *
 * Dossier privé (`_lib`) : Next.js ne le route jamais.
 */

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "~/lib/auth";
import { db } from "~/server/db";
import type { UserRole } from "~/server/db/schema/auth";

/** Demandeur authentifié, avec son rôle effectif. */
export type ApiCaller = {
  userId: string;
  role: UserRole;
  isOrganizer: boolean;
};

export function unauthorized(): NextResponse {
  return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
}

export function forbidden(): NextResponse {
  return NextResponse.json({ error: "Permission refusée" }, { status: 403 });
}

/**
 * Rôle effectif du compte, lu dans la table users (source de vérité unique).
 * L'admin plateforme est traité partout comme un organisateur.
 */
export async function getCallerRole(userId: string): Promise<UserRole | null> {
  const caller = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.id, userId),
    columns: { role: true, isAdmin: true },
  });
  if (!caller) return null;
  return caller.isAdmin ? "organizer" : caller.role;
}

/**
 * Session seule, sans lecture du rôle : pour les routes dont l'autorisation
 * se joue ensuite sur la propriété des données (facture, notes du juré) et
 * qui n'ont donc pas besoin d'une requête supplémentaire.
 *
 * Renvoie la réponse 401 à retourner telle quelle quand il n'y a pas de
 * session — l'appelant teste `instanceof NextResponse`.
 */
export async function requireSession(): Promise<
  { userId: string } | NextResponse
> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return unauthorized();
  return { userId: session.user.id };
}

/** Session + rôle. 401 si la session ou le compte a disparu. */
export async function requireCaller(): Promise<ApiCaller | NextResponse> {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;

  const role = await getCallerRole(session.userId);
  if (!role) return unauthorized();

  return {
    userId: session.userId,
    role,
    isOrganizer: role === "organizer",
  };
}

/** Session + rôle, réservé aux organisateurs (ou à l'admin plateforme). */
export async function requireOrganizer(): Promise<ApiCaller | NextResponse> {
  const caller = await requireCaller();
  if (caller instanceof NextResponse) return caller;
  if (!caller.isOrganizer) return forbidden();
  return caller;
}
