import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Explicit rather than relying on the framework default: this example exists specifically to
  // prove @momentarise/md-react survives StrictMode's dev-mode double-mount (MME-0081/MME-0085).
  reactStrictMode: true,
  // This example lives inside the momentarise-markdown-editor monorepo, which has its own
  // root package-lock.json; without this, Next.js infers the wrong workspace root and warns.
  turbopack: {
    root: fileURLToPath(new URL(".", import.meta.url))
  }
};

export default nextConfig;
