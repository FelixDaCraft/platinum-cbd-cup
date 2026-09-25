import { defineConfig, devices } from "@playwright/test";

/**
 * Configuration E2E Playwright — Platinum CBD Cup.
 *
 * Les tests sont tagués @P0/@P1/@P2 dans leur titre : c'est ce que
 * `pnpm test:e2e:p0` (--grep '@P0') filtre. L'ancienne convention `[P0]`
 * rendait ces deux scripts silencieusement vides — aucun test ne sortait
 * du filtre et la commande finissait en succès.
 *
 * Les specs supposent une base peuplée et un serveur applicatif joignable :
 * elles ne créent aucun compte et ne modifient rien.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],

  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Si E2E_BASE_URL est fourni (préprod, conteneur déjà lancé), on ne
  // démarre pas de serveur : Playwright attaquerait une instance déjà là.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "pnpm dev",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000,
      },

  timeout: 30 * 1000,
  expect: {
    timeout: 5 * 1000,
  },
});
