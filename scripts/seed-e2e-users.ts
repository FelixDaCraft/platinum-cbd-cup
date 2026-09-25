/**
 * Comptes de test pour la campagne Playwright.
 *
 * Pourquoi un script plutôt que des comptes créés à la main : la base de test
 * est une copie de la production, restaurée avant chaque campagne. Tout compte
 * créé à la main disparaît au rechargement suivant. Et surtout, les 140 comptes
 * qu'elle contient appartiennent à de vraies personnes : les tests ne doivent
 * jamais s'authentifier avec l'un d'eux.
 *
 * Le hachage passe par `hashPassword` de better-auth/crypto et la ligne
 * `accounts` porte `providerId: "credential"` — exactement ce que fait
 * `jury.registerAndAcceptInvitation` en production. Un hachage maison ne
 * permettrait tout simplement pas de se connecter.
 *
 * Les adresses sont en `.test`, TLD réservé par la RFC 2606 : même si un envoi
 * d'email passait malgré le mode développement, il ne pourrait atteindre
 * personne.
 *
 * Usage :
 *   E2E_PASSWORD='…' pnpm tsx scripts/seed-e2e-users.ts            # simulation
 *   E2E_PASSWORD='…' pnpm tsx scripts/seed-e2e-users.ts --apply
 *   E2E_PASSWORD='…' pnpm tsx scripts/seed-e2e-users.ts --apply --reset
 */

import { hashPassword } from "better-auth/crypto";
import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "~/server/db";
import * as schema from "~/server/db/schema";
import { generateId } from "~/server/db/schema/id";

const APPLY = process.argv.includes("--apply");
const RESET = process.argv.includes("--reset");

const MOT_DE_PASSE = process.env.E2E_PASSWORD;
if (!MOT_DE_PASSE) {
  console.error("E2E_PASSWORD est requis (12 caractères minimum, dont un spécial).");
  process.exit(1);
}
if (MOT_DE_PASSE.length < 12 || !/[^A-Za-z0-9]/.test(MOT_DE_PASSE)) {
  console.error(
    "E2E_PASSWORD ne respecte pas la politique du serveur : 12 caractères minimum, dont un caractère spécial. " +
      "Les tests de connexion échoueraient sans que la cause soit visible."
  );
  process.exit(1);
}

const COMPTES = {
  organisateur: "e2e-organisateur@platinum-cbd-cup.test",
  jure: "e2e-jure@platinum-cbd-cup.test",
  producteur: "e2e-producteur@platinum-cbd-cup.test",
} as const;

const TOUTES_ADRESSES = Object.values(COMPTES);

/** Refus net si la base ne ressemble pas à une base de test. */
async function garderLaProduction(): Promise<void> {
  const url = process.env.DATABASE_URL ?? "";
  const nomBase = url.split("/").pop()?.split("?")[0] ?? "";
  if (nomBase === "platinum_cbd_cup") {
    throw new Error(
      `Refus : DATABASE_URL pointe sur « ${nomBase} », la base de production. ` +
        "Ce script crée des comptes et doit rester sur une copie jetable."
    );
  }
  console.log(`▶  base   : ${nomBase}`);
}

async function supprimerLesComptes(): Promise<void> {
  const existants = await db.query.users.findMany({
    where: inArray(schema.users.email, [...TOUTES_ADRESSES]),
    columns: { id: true, email: true },
  });
  if (existants.length === 0) {
    console.log("   rien à supprimer");
    return;
  }
  const ids = existants.map((u) => u.id);
  if (!APPLY) {
    console.log(`   ${existants.length} compte(s) seraient supprimés`);
    return;
  }
  // L'ordre suit les dépendances : les cascades couvrent le reste.
  await db.transaction(async (tx) => {
    const producteurs = await tx.query.producers.findMany({
      where: inArray(schema.producers.userId, ids),
      columns: { id: true },
    });
    if (producteurs.length > 0) {
      await tx.delete(schema.registrations).where(
        inArray(schema.registrations.producerId, producteurs.map((p) => p.id))
      );
    }
    await tx.delete(schema.producers).where(inArray(schema.producers.userId, ids));
    await tx.delete(schema.juryProfiles).where(inArray(schema.juryProfiles.userId, ids));
    await tx.delete(schema.sessions).where(inArray(schema.sessions.userId, ids));
    await tx.delete(schema.accounts).where(inArray(schema.accounts.userId, ids));
    await tx.delete(schema.users).where(inArray(schema.users.id, ids));
  });
  console.log(`   ${existants.length} compte(s) supprimé(s)`);
}

async function creerCompte(options: {
  email: string;
  nom: string;
  role: "organizer" | "jury" | "producer";
  isAdmin?: boolean;
}): Promise<string> {
  const existant = await db.query.users.findFirst({
    where: eq(schema.users.email, options.email),
    columns: { id: true },
  });
  if (existant) {
    console.log(`   = ${options.email} (déjà présent)`);
    return existant.id;
  }
  if (!APPLY) {
    console.log(`   + ${options.email} (serait créé)`);
    return "simulation";
  }

  const userId = generateId();
  const motDePasseHache = await hashPassword(MOT_DE_PASSE!);
  const maintenant = new Date();

  await db.transaction(async (tx) => {
    await tx.insert(schema.users).values({
      id: userId,
      name: options.nom,
      email: options.email,
      // Vérifié d'office : sans cela, chaque connexion de test bute sur
      // l'écran « vérifiez votre adresse » et aucun email ne part en local.
      emailVerified: true,
      role: options.role,
      isAdmin: options.isAdmin ?? false,
      createdAt: maintenant,
      updatedAt: maintenant,
    });
    await tx.insert(schema.accounts).values({
      id: generateId(),
      accountId: userId,
      providerId: "credential",
      userId,
      password: motDePasseHache,
      createdAt: maintenant,
      updatedAt: maintenant,
    });
  });
  console.log(`   + ${options.email}`);
  return userId;
}

async function main(): Promise<void> {
  await garderLaProduction();
  console.log(`▶  mode   : ${APPLY ? "APPLY (écriture)" : "simulation"}\n`);

  if (RESET) {
    console.log("▶  remise à zéro");
    await supprimerLesComptes();
    console.log();
  }

  console.log("▶  comptes");
  const idOrganisateur = await creerCompte({
    email: COMPTES.organisateur,
    nom: "E2E Organisateur",
    role: "organizer",
    isAdmin: true,
  });
  const idJure = await creerCompte({
    email: COMPTES.jure,
    nom: "E2E Juré",
    role: "jury",
  });
  const idProducteur = await creerCompte({
    email: COMPTES.producteur,
    nom: "E2E Producteur",
    role: "producer",
  });

  if (!APPLY) {
    console.log("\nRelancez avec --apply pour écrire.");
    // `process.exit` comme les autres scripts du dossier : le pool pg n'est
    // pas exporté et garde la boucle d'événements ouverte.
    process.exit(0);
  }

  console.log("\n▶  profils");

  // Profil juré
  const jureExistant = await db.query.juryProfiles.findFirst({
    where: eq(schema.juryProfiles.userId, idJure),
    columns: { id: true },
  });
  if (!jureExistant) {
    await db.insert(schema.juryProfiles).values({
      id: generateId(),
      userId: idJure,
      expertise: "Test automatisé",
      bio: "Compte de test — ne pas utiliser.",
      showOnPublicResults: false,
    });
    console.log("   + profil juré");
  } else {
    console.log("   = profil juré");
  }

  // Profil producteur
  const producteurExistant = await db.query.producers.findFirst({
    where: eq(schema.producers.userId, idProducteur),
    columns: { id: true },
  });
  if (!producteurExistant) {
    await db.insert(schema.producers).values({
      id: generateId(),
      userId: idProducteur,
      companyName: "E2E Test SARL",
      brandName: "E2E Test",
    });
    console.log("   + profil producteur");
  } else {
    console.log("   = profil producteur");
  }

  console.log("\n▶  état final");
  for (const email of TOUTES_ADRESSES) {
    const u = await db.query.users.findFirst({
      where: eq(schema.users.email, email),
      columns: { id: true, role: true, isAdmin: true, emailVerified: true },
    });
    const aUnMotDePasse = u
      ? (
          await db.query.accounts.findFirst({
            where: and(
              eq(schema.accounts.userId, u.id),
              eq(schema.accounts.providerId, "credential")
            ),
            columns: { id: true },
          })
        )
        ? "oui"
        : "NON"
      : "—";
    console.log(
      `   ${email}  role=${u?.role ?? "—"} admin=${u?.isAdmin ?? "—"} vérifié=${u?.emailVerified ?? "—"} mot de passe=${aUnMotDePasse}`
    );
  }

  process.exit(0);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
