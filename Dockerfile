# syntax=docker/dockerfile:1

# ============ Base ============
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# ============ Dependencies ============
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ============ Builder ============
FROM base AS builder
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* values are inlined into the bundle at build time (server code
# included), so the real public URL must be known here — not only at runtime.
ARG NEXT_PUBLIC_APP_URL="https://platinumcbdcup.eu"
# Version déployée, renvoyée par /api/health. Le workflow passe le SHA court ;
# à défaut on garde "unknown" plutôt qu'une valeur fausse.
ARG APP_VERSION="unknown"
# Next.js "collect page data" imports route modules, which eagerly construct
# the Resend client. Supply placeholder env values during build — the
# container reads real values from env_file at runtime. (Stripe was removed
# with the CupMetrics SaaS layer; only Resend still builds eagerly.)
RUN SKIP_ENV_VALIDATION=1 \
    DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    BETTER_AUTH_SECRET="build-time-placeholder-secret-32chars" \
    BETTER_AUTH_URL="http://localhost:3000" \
    RESEND_API_KEY="re_build_placeholder" \
    NEXT_PUBLIC_APP_URL="${NEXT_PUBLIC_APP_URL}" \
    pnpm run build

# ============ Runner ============
FROM node:22-alpine AS runner
WORKDIR /app

ARG APP_VERSION="unknown"
ENV APP_VERSION=${APP_VERSION}
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
# Next.js standalone defaults to HOSTNAME=localhost which only binds to the
# container hostname resolution (not 127.0.0.1), so in-container healthchecks
# and the published port both break. Bind to all interfaces instead.
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Standalone output from next.config.js (output: "standalone")
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Uploads are written at runtime; mount a volume at /app/public/uploads.
# On purge d'abord ce que la copie a pu apporter : `public/uploads` est
# ignoré par git mais pas par le contexte Docker, donc un build lancé depuis
# un poste de développement embarquerait ses fichiers réels (PDF d'analyses,
# logos producteurs) dans une couche de l'image de production.
RUN rm -rf ./public/uploads && \
    mkdir -p ./public/uploads && \
    chown -R nextjs:nodejs ./public/uploads

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
