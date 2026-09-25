/**
 * Exécute les demandes de suppression de compte RGPD arrivées à échéance.
 *
 * `profile.requestAccountDeletion` pose `deletion_scheduled_for = now + 30 j`
 * et l'interface annonce cette date, mais rien ne lisait la colonne : les
 * comptes restaient indéfiniment en place. Ce script est le consommateur
 * manquant ; il réutilise l'anonymisation du routeur profil pour qu'il n'y
 * ait qu'une seule implémentation.
 *
 * Usage (depuis la racine du projet, .env chargé) :
 *   pnpm tsx scripts/process-account-deletions.ts           # dry-run
 *   pnpm tsx scripts/process-account-deletions.ts --apply   # anonymise
 *
 * À planifier une fois par jour sur l'hôte (cron / systemd timer). Le
 * traitement est idempotent : l'anonymisation remet `deletion_scheduled_for`
 * à NULL, un compte déjà traité n'est plus sélectionné.
 */

import path from "node:path";
import { config } from "dotenv";

config({ path: path.resolve(process.cwd(), ".env") });

const apply = process.argv.slice(2).includes("--apply");

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

console.log(`▶  target host: ${new URL(databaseUrl).host}`);
console.log(`▶  mode: ${apply ? "APPLY (anonymisation)" : "dry-run (lecture seule)"}`);

// Import différé : le module charge la configuration de l'app, qui exige un
// .env complet (Better Auth, Resend). Le faire après le garde-fou ci-dessus
// donne un message d'erreur lisible quand DATABASE_URL manque.
const { db } = await import("~/server/db");
const { processDueAccountDeletions } = await import(
  "~/server/api/routers/profile"
);

const due = await processDueAccountDeletions(db, { dryRun: !apply });

console.log(`\n${due.length} compte(s) arrivé(s) à échéance :\n`);
for (const user of due) {
  console.log(
    `  ${user.id.padEnd(24)} échéance ${user.scheduledFor?.toISOString().slice(0, 10) ?? "?"}`
  );
}

if (due.length === 0) {
  console.log("Rien à faire.");
} else if (!apply) {
  console.log("\nDry-run : aucune écriture. Relancer avec --apply pour anonymiser.");
} else {
  console.log(`\n✔  ${due.length} compte(s) anonymisé(s).`);
}

process.exit(0);
