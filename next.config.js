/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  // Enable standalone output for Docker deployment
  // Note: On Windows, this may fail due to symlink permissions - use Linux/macOS or CI/CD
  output: "standalone",

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
    remotePatterns: [
      { protocol: "https", hostname: "platinum.aynn.fr" },
      { protocol: "https", hostname: "*.aynn.fr" },
      { protocol: "https", hostname: "localhost" },
      { protocol: "http", hostname: "localhost" },
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      // User-uploaded images (producer logos, etc.)
      { protocol: "https", hostname: "**" },
    ],
  },
  allowedDevOrigins: [
    "platinum.aynn.fr",
    "*.aynn.fr",
  ],

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
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
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
            key: "X-XSS-Protection",
            value: "1; mode=block",
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
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
        // Note: HSTS will be applied but browsers ignore it for localhost
      },
    ];
  },
};

export default config;
