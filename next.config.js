/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  // Enable standalone output for Docker deployment.
  // On Windows the trace-file copy step fails with EPERM (symlinks require
  // admin). Disable standalone outside Docker by unsetting NEXT_STANDALONE=1,
  // or just build inside the Dockerfile (Linux handles symlinks fine).
  output: process.env.NEXT_STANDALONE === "0" ? undefined : "standalone",

  // Don't advertise the framework.
  poweredByHeader: false,

  // pdfjs-dist ships its own Node polyfills (DOMMatrix, etc.) inside the
  // legacy build. When bundled by webpack for Next.js server routes those
  // polyfills get tree-shaken, causing `ReferenceError: DOMMatrix is not
  // defined` at runtime. Marking the package as external forces it to be
  // loaded from node_modules at runtime so its init code runs as-is.
  serverExternalPackages: ["pdfjs-dist"],

  // pdfjs-dist loads its worker (`pdf.worker.mjs`) via a runtime `import()`
  // that Next.js file tracing can't follow. In a standalone build the worker
  // file is therefore absent from node_modules and the parser crashes with
  // "Setting up fake worker failed: Cannot find module .../pdf.worker.mjs".
  // Force Next.js to copy the file alongside the upload route.
  outputFileTracingIncludes: {
    "/api/upload/lab-analysis": [
      // Must include pdf.mjs too — Next.js turns the hoisted symlink into
      // a real directory when copying ANY file under it, so a worker-only
      // glob ends up shadowing the main entrypoint.
      "./node_modules/**/pdfjs-dist/legacy/build/pdf.*",
    ],
  },
  images: {
    // /_next/image is public and unauthenticated: every host listed here is
    // a host anyone can make the server fetch and re-encode with sharp.
    // Keep it to the domains we actually serve images from — user uploads
    // are stored locally and referenced by a relative /uploads/ path, so
    // they need no entry at all.
    remotePatterns: [
      { protocol: "https", hostname: "platinumcbdcup.eu" },
      { protocol: "https", hostname: "*.platinumcbdcup.eu" },
      { protocol: "https", hostname: "platinum.aynn.fr" },
      { protocol: "https", hostname: "*.aynn.fr" },
      { protocol: "https", hostname: "localhost" },
      { protocol: "http", hostname: "localhost" },
    ],
    // Bound the on-disk optimizer cache churn.
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  allowedDevOrigins: [
    "platinumcbdcup.eu",
    "*.platinumcbdcup.eu",
    "platinum.aynn.fr",
    "*.aynn.fr",
  ],

  // Canonical domain is platinumcbdcup.eu: send the old platinum.aynn.fr host
  // and www to it. /api/ is left alone so a POST to the old host is not
  // turned into a redirect that drops its body.
  async redirects() {
    return ["platinum.aynn.fr", "www.platinumcbdcup.eu"].map((host) => ({
      source: "/:path((?!api/).*)",
      has: [{ type: "host", value: host }],
      destination: "https://platinumcbdcup.eu/:path",
      permanent: true,
    }));
  },

  // Security Headers
  async headers() {
    return [
      {
        // All routes except /widget — deny framing
        source: "/((?!widget).*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            // Defense-in-depth CSP. 'unsafe-inline' is kept because Next.js
            // inline-hydrates. 'wasm-unsafe-eval' is the narrow replacement
            // for 'unsafe-eval': the 3D emblem GLB is EXT_meshopt-compressed
            // and its decoder is a WebAssembly module, which CSP3 gates —
            // shaders are compiled by WebGL and never needed eval.
            // The real wins are object-src/base-uri/form-action/frame-ancestors
            // (blocks plugin injection, base-tag hijacking, form exfiltration,
            // and clickjacking).
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' data: https://fonts.gstatic.com",
              "img-src 'self' data: blob: https:",
              "media-src 'self' blob:",
              // blob: is required by GLTFLoader: it wraps each texture
              // embedded in a .glb into a blob: URL and loads it through
              // ImageBitmapLoader, which uses fetch() — so the textures fall
              // under connect-src, not img-src. Without it the 3D emblem
              // renders untextured. Blobs are minted by our own page, so
              // this grants nothing an attacker running script lacks.
              "connect-src 'self' blob:",
              "frame-src 'self'",
              "worker-src 'self' blob:",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              "upgrade-insecure-requests",
            ].join("; "),
          },
        ],
      },
      {
        // Widget routes — allow embedding from any origin
        source: "/widget/:path*",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors *",
          },
        ],
      },
      {
        // HSTS only for production (non-localhost)
        source: "/(.*)",
        headers: [
          {
            // `preload` n'a aucun effet tant que platinumcbdcup.eu n'est pas
            // soumis sur hstspreload.org : le jeton est la condition d'entrée,
            // pas l'inscription elle-même. Le déclarer maintenant évite un
            // second passage en production le jour de la soumission.
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
        ],
        // Note: HSTS will be applied but browsers ignore it for localhost
      },
    ];
  },
};

export default config;
