/**
 * Flux des participants pour InstaPlanner (planificateur Instagram de la cup).
 *
 * InstaPlanner interroge ce point d'accès, prépare un brouillon de
 * publication par marque confirmée et attend qu'un humain le valide avant de
 * le programmer. Lecture seule, sans session : l'appel vient d'un serveur et
 * s'authentifie par la clé partagée `INSTAPLANNER_API_KEY` (en-tête
 * `Authorization: Bearer …`). Sans clé configurée, la route n'existe pas.
 *
 * Contenu et minimisation : voir `social-participants.service.ts`.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { env } from "~/env";
import { secretsMatch } from "~/lib/secret";
import { db } from "~/server/db";
import { getPortalBaseUrl } from "~/server/services/app-url";
import { listSocialParticipants } from "~/server/services/social-participants.service";

export const dynamic = "force-dynamic";

// Identifiants au format nanoid (alphabet URL-safe), voir schema/id.ts.
const querySchema = z.object({
  cupId: z
    .string()
    .regex(/^[A-Za-z0-9_-]{1,64}$/)
    .optional(),
});

function bearerToken(request: Request): string | null {
  const match = /^Bearer (.+)$/.exec(request.headers.get("authorization") ?? "");
  return match?.[1] ?? null;
}

export async function GET(request: Request) {
  const expectedKey = env.INSTAPLANNER_API_KEY;
  if (!expectedKey) {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }

  const token = bearerToken(request);
  if (!token || !secretsMatch(token, expectedKey)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const query = querySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams)
  );
  if (!query.success) {
    return NextResponse.json({ error: "Paramètre cupId invalide" }, { status: 400 });
  }

  const participants = await listSocialParticipants(db, {
    cupId: query.data.cupId,
    baseUrl: getPortalBaseUrl(),
  });

  return NextResponse.json(
    { participants },
    { headers: { "cache-control": "no-store" } }
  );
}
