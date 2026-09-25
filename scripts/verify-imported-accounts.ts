/**
 * Marque comme vérifiés les comptes créés par import (CSV producteurs,
 * import de cup) qui n'ont jamais pu confirmer leur adresse.
 *
 * Contexte : `cupImport.importProducers` insère les users avec
 * `email_verified = false` et SANS ligne `accounts`, donc sans mot de passe.
 * Combiné à `emailAndPassword.requireEmailVerification`, ces comptes ne
 * peuvent se connecter par aucun chemin.
 *
 * Usage (depuis la racine du projet, .env chargé) :
 *   pnpm tsx scripts/verify-imported-accounts.ts              # dry-run
 *   pnpm tsx scripts/verify-imported-accounts.ts --apply      # écrit
 *
 * Options :
 *   --apply                 exécute réellement l'UPDATE (sinon : dry-run)
 *   --all-unverified        inclut AUSSI les inscrits publics non confirmés
 *                           (déconseillé : cela contourne la vérification
 *                           d'email pour des comptes choisis par l'internaute)
 *   --created-before=<ISO>  ne traite que les comptes créés avant cette date
 *   --emails=<fichier>      restreint à une liste d'adresses (une par ligne)
 *
 * Par défaut la sélection est volontairement étroite : uniquement les
 * comptes non vérifiés qui n'ont AUCUN compte `credential`, c'est-à-dire
 * ceux que personne n'a jamais créés depuis le formulaire d'inscription.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import { config } from "dotenv";

config({ path: path.resolve(process.cwd(), ".env") });

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const allUnverified = args.includes("--all-unverified");
const createdBefore = args
  .find((a) => a.startsWith("--created-before="))
  ?.split("=")[1];
const emailsFile = args.find((a) => a.startsWith("--emails="))?.split("=")[1];

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

if (createdBefore && Number.isNaN(Date.parse(createdBefore))) {
  console.error(`--created-before: date invalide (${createdBefore})`);
  process.exit(1);
}

// Sécurité : afficher la cible avant toute écriture.
console.log(`▶  target host: ${new URL(databaseUrl).host}`);
console.log(`▶  mode: ${apply ? "APPLY (écriture)" : "dry-run (lecture seule)"}`);

let emailFilter: string[] | null = null;
if (emailsFile) {
  const raw = await readFile(path.resolve(emailsFile), "utf8");
  emailFilter = raw
    .split("\n")
    .map((l) => l.trim().toLowerCase())
    .filter((l) => l.length > 0 && !l.startsWith("#"));
  console.log(`▶  filtre: ${emailFilter.length} adresse(s) depuis ${emailsFile}`);
}

const pool = new Pool({ connectionString: databaseUrl });

const conditions = ["u.email_verified = false"];
const params: unknown[] = [];

if (!allUnverified) {
  // Aucun moyen de connexion choisi par l'utilisateur → compte importé.
  conditions.push(
    "NOT EXISTS (SELECT 1 FROM accounts a WHERE a.user_id = u.id AND a.provider_id = 'credential')"
  );
}

if (createdBefore) {
  params.push(new Date(createdBefore));
  conditions.push(`u.created_at < $${params.length}`);
}

if (emailFilter) {
  params.push(emailFilter);
  conditions.push(`lower(u.email) = ANY($${params.length}::text[])`);
}

const where = conditions.join("\n    AND ");

try {
  const { rows } = await pool.query<{
    id: string;
    email: string;
    name: string;
    created_at: Date;
    has_producer: boolean;
  }>(
    `SELECT u.id,
            u.email,
            u.name,
            u.created_at,
            EXISTS (SELECT 1 FROM producers p WHERE p.user_id = u.id) AS has_producer
       FROM users u
      WHERE ${where}
      ORDER BY u.created_at`,
    params
  );

  console.log(`\n${rows.length} compte(s) concerné(s) :\n`);
  for (const row of rows) {
    console.log(
      `  ${row.email.padEnd(40)} ${row.has_producer ? "producteur" : "—".padEnd(10)}  créé le ${row.created_at.toISOString().slice(0, 10)}`
    );
  }

  if (rows.length === 0) {
    console.log("\nRien à faire.");
  } else if (!apply) {
    console.log(
      `\nDry-run : aucune écriture. Relancer avec --apply pour marquer ces ${rows.length} compte(s) comme vérifiés.`
    );
  } else {
    const ids = rows.map((r) => r.id);
    const result = await pool.query(
      `UPDATE users
          SET email_verified = true,
              updated_at = now()
        WHERE id = ANY($1::text[])`,
      [ids]
    );
    console.log(`\n✔  ${result.rowCount} compte(s) marqué(s) comme vérifiés.`);
    console.log(
      "   Ces comptes n'ont toujours pas de mot de passe : les inviter à passer par « Mot de passe oublié »."
    );
  }
} finally {
  await pool.end();
}
