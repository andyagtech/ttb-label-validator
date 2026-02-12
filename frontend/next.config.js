/**
 * Next.js configuration — production-hardened defaults.
 *
 * Next.js automatically handles minification (SWC), code splitting (per-route),
 * tree-shaking, CSS purge (Tailwind), and static prerendering during `next build`.
 * No manual optimization steps are needed for prod vs. local.
 *
 * @see https://nextjs.org/docs/app/api-reference/next-config-js
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  /** Double-invoke effects/renders in dev to surface side-effect bugs early. */
  reactStrictMode: true,

  /** Strip the `X-Powered-By: Next.js` header — reduces fingerprinting surface. */
  poweredByHeader: false,
};

module.exports = nextConfig;
