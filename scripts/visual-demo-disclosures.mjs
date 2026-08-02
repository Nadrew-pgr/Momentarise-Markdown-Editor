/**
 * MME-0114 — opening the demo's disclosures before reading them.
 *
 * The single systemic cause behind most of the rot this issue uncovered: the
 * reference surface demoted its technical panels into closed `<details>`
 * disclosures ("Technical diagnostics", the document-status popover, preview
 * details). `innerText` returns the empty string for content inside a closed
 * `<details>`, so every gate that read a diagnostic through `innerText` started
 * asserting against `""`. The gates were not wrong and they were not silently
 * passing — they were correctly red, and nothing ran them.
 *
 * The repair is deliberately NOT "read `textContent` instead". That would make
 * the gates assert text no user can see, which is the exact vacuity the
 * `AGENT.md` mutation rule exists to prevent. Instead the gates now perform the
 * interaction a user performs: they open the disclosure, then read what is
 * actually on screen.
 *
 * `openDemoDisclosuresExpression()` returns an expression string so it can be
 * used from both harness styles in this repository — the raw-CDP scripts'
 * `evaluate(cdp, expression)` and the puppeteer scripts' `page.evaluate(...)` —
 * without either having to import the other's machinery.
 */

/** Disclosures the demo renders, keyed by the `data-testid` on their `<details>`. */
export const DEMO_DISCLOSURES = {
  /** "AI" split button in the editor header. */
  aiCommandSurface: "ai-command-surface",
  /** "Technical diagnostics": parser/serializer/round-trip/save-engine/AI/properties/event log. */
  debugInspector: "debug-inspector",
  /** Filename + dirty chip; opens to persistence target, save state, adapter, writability. */
  documentStatus: "document-status-popover",
  /** Sandbox tokens, script policy, save truth for the standalone HTML preview. */
  htmlPreviewDetails: "html-preview-details",
  /** Nested inside the debug inspector: toolbar/AI/status/layout/keymap preference controls. */
  surfaceSettings: "surface-settings-panel"
};

/**
 * Build an expression that opens the named disclosures and reports what it did.
 *
 * The returned object is the tripwire: a gate that asks for a disclosure the
 * demo no longer renders gets `missing: ["…"]` back instead of an empty read,
 * so a renamed panel fails loudly rather than degrading into `""`.
 *
 * @param {string[]} testIds `data-testid` values from `DEMO_DISCLOSURES`.
 */
export function openDemoDisclosuresExpression(testIds) {
  const requested = JSON.stringify(testIds);
  return `(() => {
    const requested = ${requested};
    const opened = [];
    const alreadyOpen = [];
    const missing = [];
    for (const testId of requested) {
      const details = document.querySelector('[data-testid="' + testId + '"]');
      if (!details || details.tagName !== "DETAILS") {
        missing.push(testId);
        continue;
      }
      if (details.open) {
        alreadyOpen.push(testId);
        continue;
      }
      const summary = details.querySelector("summary");
      if (!summary) {
        missing.push(testId);
        continue;
      }
      // A real click on the summary: the browser performs the same default
      // toggle action it performs for the user's pointer.
      summary.click();
      if (!details.open) {
        details.open = true;
      }
      opened.push(testId);
    }
    return JSON.stringify({ alreadyOpen, missing, opened });
  })()`;
}

/**
 * Throw when a disclosure a gate depends on has disappeared. Every caller must
 * use this: silently continuing past a missing panel is how a gate turns into an
 * assertion about `""`.
 */
export function assertDisclosuresOpened(rawResult, label) {
  const result = typeof rawResult === "string" ? JSON.parse(rawResult) : rawResult;
  if (result.missing.length > 0) {
    throw new Error(
      `${label}: the demo no longer renders disclosure(s) ${result.missing.join(", ")}. ` +
        "Update the gate to the panel's new home instead of reading an empty element."
    );
  }
  return result;
}
