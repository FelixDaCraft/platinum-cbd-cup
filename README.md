# Platinum CBD Cup

Standalone event platform for the Platinum CBD Cup competition.

Forked from [CupMetrics v2](https://github.com/FelixDaCraft/cupmetrics-v2) and stripped of all
multi-tenant / SaaS code.

## Quick start

```bash
# 1. Install deps
pnpm install

# 2. Copy env template and fill real values
cp .env.example .env

# 3. Start the database
docker compose up -d platinum-postgres

# 4. Run migrations
pnpm db:push

# 5. (Optional) migrate data from CupMetrics
SOURCE_DATABASE_URL="postgresql://...neon..." \
TARGET_DATABASE_URL="postgresql://platinum:...@localhost:5432/platinum_cbd_cup" \
PLATINUM_ORG_ID="<the Platinum org id>" \
pnpm migrate-from-cupmetrics

# 6. Dev
pnpm dev
```

## Production (homelab)

On the homelab:
```bash
mkdir -p /opt/platinum-cbd-cup && cd /opt/platinum-cbd-cup
# (copy docker-compose.yml and .env from this repo)
docker compose up -d
```

URL: https://platinum.aynn.fr (via Traefik). Fallback: http://192.168.1.122:3017.

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

## License
Private. Not for redistribution.
