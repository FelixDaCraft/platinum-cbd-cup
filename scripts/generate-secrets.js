#!/usr/bin/env node
/**
 * CupMetrics V2 - Generate New Secrets
 * Run: node scripts/generate-secrets.js
 *
 * This generates new random secrets for your .env.production file.
 * You still need to update API keys manually from each service dashboard.
 */

const crypto = require("crypto");

console.log(`
╔════════════════════════════════════════════════════════════════╗
║           CupMetrics V2 - Secret Generator                     ║
╚════════════════════════════════════════════════════════════════╝

🔐 Generated Secrets (copy these to your .env.production):
────────────────────────────────────────────────────────────────

BETTER_AUTH_SECRET="${crypto.randomBytes(32).toString("base64")}"

ENCRYPTION_KEY="${crypto.randomBytes(32).toString("hex")}"

────────────────────────────────────────────────────────────────

⚠️  MANUAL ACTIONS REQUIRED:
────────────────────────────────────────────────────────────────

1. DATABASE (Neon):
   → Go to: https://console.neon.tech
   → Reset your database password
   → Update DATABASE_URL in .env.production

2. VIVA.COM:
   → Go to: https://www.vivapayments.com (Settings › API Access)
   → Roll the OAuth2 credentials (VIVA_CLIENT_ID / VIVA_CLIENT_SECRET)
   → Settings › Security › API Keys for VIVA_MERCHANT_ID / VIVA_API_KEY
   → Sales › Payment Sources for VIVA_SOURCE_CODE

3. RESEND:
   → Go to: https://resend.com/api-keys
   → Delete old key, create new one
   → Update RESEND_API_KEY

4. CLOUDFLARE (if used):
   → Go to: https://dash.cloudflare.com/profile/api-tokens
   → Revoke old token, create new one
   → Update CLOUDFLARE_API_TOKEN

────────────────────────────────────────────────────────────────

🗑️  CLEANUP (after rotating secrets):
────────────────────────────────────────────────────────────────

# Remove sensitive files from current directory:
rm -f .env TEST_CREDENTIALS.txt

# Note: These files are already in git history.
# The secrets MUST be rotated even if you clean git history.

`);
