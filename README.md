# Platinum CBD Cup

Standalone event platform for the Platinum CBD Cup competition.

Forked from [CupMetrics v2](https://github.com/FelixDaCraft/cupmetrics-v2) and stripped of all
multi-tenant / SaaS code.

## Quick start

Prérequis : **Node 22** (c'est la version des deux étages du `Dockerfile`, donc
celle de la production). Node 20 est en fin de vie depuis avril 2026 ;
développer sur une version plus récente que 22 expose à des écarts dev/prod
silencieux (undici/fetch, binaires sharp).

> Écart connu : le workflow de déploiement installe encore `node-version: "20"`
> sur le runner. L'image livrée reste en Node 22 — seuls `pnpm typecheck` et
> `pnpm test` tournent sur 20 côté CI. Une régression propre à Node 22 peut
> donc passer la CI. À aligner sur 22 dans `.github/workflows/deploy.yml`.

```bash
# 1. Install deps
pnpm install

# 2. Copy env template and fill real values
cp .env.example .env
# Génère BETTER_AUTH_SECRET / CRON_SECRET / POSTGRES_PASSWORD :
node scripts/generate-secrets.js

# 3. Start the database
docker compose up -d platinum-postgres

# 4. Appliquer les migrations versionnées (même commande qu'en production)
pnpm db:migrate

# 5. Dev
pnpm dev
```

> La migration depuis la base CupMetrics est terminée (one-shot, déjà appliquée en
> production). `scripts/migrate-from-cupmetrics.ts` n'est conservé que comme trace et
> refuse de s'exécuter sans `CONFIRM_ONE_SHOT_MIGRATION=1`.

## Production (homelab)

Sur le homelab :
```bash
mkdir -p /opt/platinum-cbd-cup && cd /opt/platinum-cbd-cup
# (copier docker-compose.yml et .env depuis ce dépôt)
docker compose up -d
```

URL : https://platinumcbdcup.eu (Cloudflare Tunnel ; platinum.aynn.fr redirige dessus).
L'app est publiée sur `127.0.0.1:3017` uniquement : elle n'est **pas** joignable depuis le
LAN, seul le tunnel tournant sur l'hôte peut l'atteindre. Pour un accès de secours, passer
par un tunnel SSH :

```bash
ssh -L 3017:127.0.0.1:3017 homelab   # puis http://localhost:3017
```

### Schéma de base de données

Le déploiement applique désormais des **migrations versionnées**
(`drizzle-kit migrate`) et non plus `drizzle-kit push`. Le dossier `./drizzle`
fait foi :

| Fichier | Rôle |
|---|---|
| `0000_baseline_production.sql` | Photo du schéma tel qu'il existait en production, reconstitué par introspection. **Ne jamais rejouer sur la base de production** : elle est déjà marquée comme appliquée dans `drizzle.__drizzle_migrations`. |
| `0001_corrections_audit.sql` | Correctifs de schéma issus de l'audit (index manquants, reprise du statut hérité `paid`). |
| `0002_corrections_schema.sql` | Le gros œuvre : 108 colonnes de date passées en `timestamptz`, `json` → `jsonb`, compteurs texte → entier, clés étrangères manquantes (avec purge préalable des orphelins), colonnes héritées de Stripe supprimées. **Réécrit à la main** — voir l'en-tête du fichier. |
| `0003_renommage_tables_historiques.sql` | `cupmetrics_historical_*` → `historical_*`. Un `RENAME`, jamais un `DROP` + `CREATE` : ces tables portent les palmarès des éditions antérieures. |
| `0004_checks_etats_restants.sql` | Trois contraintes `CHECK` sur les derniers états métier stockés en `text`. |
| `0005_corrections_enum_et_galerie.sql` | Purge des valeurs d'enum héritées du SaaS, galerie des cups en `jsonb`. |
| `0006_retrait_prefixe_anonymisation.sql` | Retrait de `cups.anonymization_prefix`, jamais lue. |
| `0007_quotas_categories.sql` | Quotas d'inscription par catégorie (`max_products`, `max_products_per_producer`) et réservation des places pendant le paiement (`registrations.payment_reserved_until`). Purement additive. |
| `0008_double_jury_ajout.sql` | Cup unique à deux jurys, étape 1 : `cup_juries.panel`, codes / scores / rangs doublés en `*_pro` et `*_public` sur `products`, avec **report** des données existantes dans les colonnes du panel de leur cup. N'efface rien. |
| `0009_double_jury_retrait.sql` | Étape 2 : retrait de `cups.type` et des anciennes colonnes `anonymous_code`, `final_score`, `category_rank`. **Destructive** — ne s'applique qu'après 0008, dans la même chaîne. |
| `0010_commandes_complementaires.sql` | Plusieurs inscriptions (paiements) par producteur et par cup ; un seul panier `pending_payment` à la fois (index unique partiel). |
| `meta/` | Snapshots et `_journal.json` que drizzle-kit utilise pour calculer le diff suivant. **Se committe avec le SQL**, sinon la migration suivante repart d'un état faux. |

Procédure pour tout changement de schéma :

```bash
# 1. Modifier src/server/db/schema/**, puis générer la migration
pnpm db:generate            # écrit ./drizzle/NNNN_*.sql + meta/ — à committer

# 2. RELIRE le SQL produit. drizzle-kit ne sait pas distinguer un renommage
#    d'un DROP + ADD : une colonne renommée sort en perte de données si on
#    ne récrit pas le fichier à la main.

# 3. Sauvegarder AVANT d'appliquer (voir section suivante)

# 4. Appliquer
pnpm db:migrate
```

`pnpm db:push` est un alias de `db:migrate` : l'ancien nom reste dans les
scripts et dans la CI, la commande sous-jacente n'est plus destructive.
`pnpm db:push:dev` appelle le vrai `drizzle-kit push` — réservé à une base
de développement jetable, jamais sur la production. L'étape du workflow de
déploiement s'intitule encore « Run database migrations (drizzle-kit push) » :
le libellé est faux depuis la bascule, la commande exécutée est bien
`drizzle-kit migrate`.

Reprendre une migration à froid sur une base vide (nouvel environnement) :
`pnpm db:migrate` suffit, les fichiers `0000` → `0010` s'appliquent dans
l'ordre du journal. Ne pas lancer `baseline-migrations.mjs` sur une base
vierge : il marquerait `0000_baseline_production` comme appliquée alors que
rien n'existe, et les migrations suivantes échoueraient sur des tables
absentes. Ce script ne sert qu'aux bases déjà construites par `db:push`.

### Sauvegarde / restauration

```bash
# Sauvegarde (à prendre AVANT toute migration de schéma)
docker exec platinum-postgres pg_dump -U platinum -Fc platinum_cbd_cup \
  > /opt/platinum-cbd-cup/backups/platinum-$(date +%F-%H%M).dump

# Restauration dans une base vierge
docker exec -i platinum-postgres pg_restore -U platinum -d platinum_cbd_cup \
  --clean --if-exists < /opt/platinum-cbd-cup/backups/<fichier>.dump
```

Les fichiers téléversés (analyses de laboratoire, photos produits) vivent hors base, dans le
volume monté `./uploads` → `/app/public/uploads` : les sauvegarder séparément.

### Rotation des secrets

`node scripts/generate-secrets.js` génère les valeurs aléatoires et rappelle, service par
service, ce qui doit être révoqué côté fournisseur (Viva.com, Resend, Postgres). Changer
`BETTER_AUTH_SECRET` invalide toutes les sessions en cours : à faire hors période de notation.

### Outils d'exploitation (`scripts/`)

Ceux qui écrivent en base sont en **simulation par défaut** et n'agissent
qu'avec `--apply` : les lancer sans option affiche ce qui serait fait.
`generate-secrets.js` ne prend aucune option et n'écrit nulle part — il
affiche des valeurs à recopier.

| Script | À quoi il sert | Quand |
|---|---|---|
| `node scripts/generate-secrets.js` | Génère `BETTER_AUTH_SECRET`, `CRON_SECRET`, `POSTGRES_PASSWORD` et rappelle les révocations côté fournisseur | Installation, rotation |
| `DATABASE_URL=… node scripts/baseline-migrations.mjs --apply` | Marque `0000_baseline_production` comme déjà appliquée sur une base construite par `db:push` | Une seule fois, avant le premier `db:migrate` |
| `pnpm tsx scripts/process-account-deletions.ts --apply` | Anonymise les comptes dont la suppression RGPD est arrivée à échéance | **Une fois par jour**, cron ou timer systemd sur l'hôte |
| `pnpm tsx scripts/verify-imported-accounts.ts --apply` | Débloque les comptes créés par import CSV, qui n'ont ni mot de passe ni email vérifié | Après un import de producteurs |
| `TARGET_DATABASE_URL=… pnpm tsx scripts/historical-import/run.ts --apply` | Injecte les palmarès 2023-2025 décrits dans `plan.ts` (5 cups, 60 produits) | Ponctuel, après relecture de `REVIEW.md` |

Attention aux variables d'environnement : seuls `process-account-deletions.ts`
et `verify-imported-accounts.ts` chargent `dotenv` et trouvent donc `.env` tout
seuls. Les autres attendent la variable sur la ligne de commande —
`historical-import/run.ts` et `migrate-from-cupmetrics.ts` lisent
`TARGET_DATABASE_URL`, `baseline-migrations.mjs` lit `DATABASE_URL` — et
sortent aussitôt sur « … is required » si elle manque.

`scripts/migrate-from-cupmetrics.ts` est une **migration one-shot déjà
exécutée** : elle écrit dans `TARGET_DATABASE_URL` et sait tronquer les
tables cibles. Elle n'est conservée que comme trace de ce qui a été transféré
et refuse de démarrer sans `CONFIRM_ONE_SHOT_MIGRATION=1` — y compris pour un
`DRY_RUN=1`.

Ne comptez sur aucun autre garde-fou. Elle nomme les tables d'archives à
l'ancien préfixe `cupmetrics_historical_*`, que la migration `0003` a renommées
côté cible — mais elle **n'échoue pas** pour autant : `copyRows()` interroge
`information_schema`, ne trouve aucune colonne commune, émet un avertissement
et passe à la table suivante. La boucle appelante attrape d'ailleurs chaque
erreur pour poursuivre. Relancée par erreur avec `TRUNCATE_TARGET=1`, elle
viderait donc les autres tables cibles sans jamais s'arrêter.

Ce script est le **seul** consommateur de `@neondatabase/serverless`, `ws` et
`@types/ws` : la source était une base Neon, l'application ne parle qu'au
Postgres du homelab via `pg`. Ces trois dépendances ne servent plus à rien à
l'exécution et pèsent sur l'image. Elles ne sont pas retirées ici parce que
`package.json` est gelé pendant la campagne d'audit — à faire dans une passe
dédiée, avec `pnpm remove` et un `pnpm typecheck` de contrôle.

`scripts/debug-lab-pdf.ts` et `scripts/test-lab-parser.ts` lisent des
échantillons dans `tmp/lab-samples/`, volontairement hors dépôt (documents
producteurs) : sans ce dossier ils sortent en erreur, c'est attendu.

### Diagnostic

```bash
docker compose ps                          # état des conteneurs
docker compose logs -f --tail=200 platinum-app
curl -s http://127.0.0.1:3017/api/health   # version déployée + état DB
```

Les logs Docker sont plafonnés (json-file, 10 Mo × 5) dans `docker-compose.yml`.

## Interfaces

| Path | Audience |
|---|---|
| `/` | Public — landing Platinum |
| `/cups`, `/cups/[id]` | Public — list cups, cup detail |
| `/palmares`, `/archives`, `/articles`, `/press`, `/sponsors`, `/about`, `/contact` | Public content |
| `/login`, `/register` | Any user |
| `/dashboard` | Organizers (role=organizer or isAdmin) |
| `/producer` | Producers |
| `/jury` | Juries (+ `/jury/public` for QR-code public jury flow) |

## Auth model
- `users.role` ∈ `organizer | jury | producer`
- `users.isAdmin` boolean — full admin override (the original Platinum organizer)
- New public sign-ups default to `producer`

## Tests

Voir [tests/README.md](tests/README.md).

## License
Private. Not for redistribution.
