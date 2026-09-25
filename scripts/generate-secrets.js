#!/usr/bin/env node
/**
 * Platinum CBD Cup — générateur de secrets et aide-mémoire de rotation.
 * Lancer : node scripts/generate-secrets.js
 *
 * Génère les secrets aléatoires du fichier .env de production et rappelle
 * les rotations à faire à la main sur chaque service. Seules les clés
 * réellement lues par l'application sont listées : rien de l'ancien
 * CupMetrics (ENCRYPTION_KEY, Neon, Cloudflare) n'est plus proposé.
 */

const crypto = require("crypto");

// BETTER_AUTH_SECRET : z.string().min(32) dans src/env.js. base64 de 32
// octets fait 44 caractères, la contrainte est donc toujours satisfaite.
const betterAuthSecret = crypto.randomBytes(32).toString("base64");
// CRON_SECRET : lu directement via process.env par phaseAutomation (il n'est
// pas déclaré dans src/env.js), donc hex pour éviter tout caractère à
// échapper au passage en argument ou en en-tête.
const cronSecret = crypto.randomBytes(32).toString("hex");
// Mot de passe Postgres du conteneur platinum-postgres (docker-compose.yml).
// base64url : pas de « / » ni de « + » à encoder dans la DATABASE_URL.
const postgresPassword = crypto.randomBytes(24).toString("base64url");

console.log(`
╔════════════════════════════════════════════════════════════════╗
║        Platinum CBD Cup — générateur de secrets                 ║
╚════════════════════════════════════════════════════════════════╝

🔐 Secrets générés (à recopier dans /opt/platinum-cbd-cup/.env) :
────────────────────────────────────────────────────────────────

BETTER_AUTH_SECRET="${betterAuthSecret}"

CRON_SECRET="${cronSecret}"

POSTGRES_PASSWORD="${postgresPassword}"
# puis répercuter le même mot de passe dans DATABASE_URL :
# DATABASE_URL="postgresql://platinum:${postgresPassword}@platinum-postgres:5432/platinum_cbd_cup"

────────────────────────────────────────────────────────────────

⚠️  ROTATIONS MANUELLES (une clé par service, à révoquer côté fournisseur) :
────────────────────────────────────────────────────────────────

1. POSTGRES (conteneur platinum-postgres, pas de service externe) :
   → docker exec platinum-postgres psql -U platinum -d platinum_cbd_cup \\
       -c "ALTER USER platinum WITH PASSWORD '<nouveau>';"
   → mettre à jour POSTGRES_PASSWORD et DATABASE_URL dans .env
   → docker compose up -d platinum-app

2. VIVA.COM :
   → https://www.vivapayments.com — Réglages › Accès API
   → renouveler VIVA_CLIENT_ID / VIVA_CLIENT_SECRET
   → Réglages › Sécurité › Clés API pour VIVA_MERCHANT_ID / VIVA_API_KEY
   → Ventes › Sources de paiement pour VIVA_SOURCE_CODE

3. RESEND :
   → https://resend.com/api-keys — créer la nouvelle clé, déployer,
     puis seulement supprimer l'ancienne (sinon les e-mails tombent)
   → mettre à jour RESEND_API_KEY

4. BETTER_AUTH_SECRET :
   → changer ce secret invalide TOUTES les sessions en cours :
     jurés et producteurs devront se reconnecter. À faire hors période
     de notation.

────────────────────────────────────────────────────────────────

🗑️  APRÈS ROTATION :
────────────────────────────────────────────────────────────────

# Ne jamais commiter de .env : vérifier qu'il reste ignoré.
git check-ignore -v .env .env.local

# Un secret ayant fuité doit être révoqué côté fournisseur : le retirer
# du dépôt ou de l'historique ne suffit pas.

`);
