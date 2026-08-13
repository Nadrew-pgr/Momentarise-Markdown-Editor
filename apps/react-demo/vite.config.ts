import { defineConfig } from "vite";

/**
 * MME-0125.
 *
 * The workspace hoists React 18 for `packages/md-react`'s own jsdom suites, while
 * this host runs React 19. Vite currently resolves `react` from the app root for
 * the linked workspace package, so a single copy ends up in the bundle — but
 * nothing in the repository *declared* that. If it ever resolved the other way,
 * `useMarkdownEditor` would call React 18's hooks under a React 19 root and the
 * host would die with "Invalid hook call", in the one app whose purpose is to
 * prove the binding renders.
 */
export default defineConfig({
  resolve: {
    dedupe: ["react", "react-dom"]
  }
});
