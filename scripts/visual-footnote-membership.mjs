/**
 * MME-0116 — footnote gates assert membership, not document-wide totals.
 *
 * Thirteen gates went red for one shared reason. Each of MME-0056 and MME-0059
 * through MME-0071 shipped semantic support for one more footnote construct, and
 * each conversion applied to *every earlier fixture too* — but only the issue's
 * own gate was written, and every gate had frozen a document-wide total at its
 * authoring date. `expect 7 fallbacks` was true on the day it was written and
 * false one issue later, thirteen times over.
 *
 * There was never a preservation regression: byte identity held throughout and
 * the 16 `tests/rich-footnote-*.test.mjs` suites passed. Every divergence
 * conserved — definitions up by N exactly as fallbacks fell by N — which is the
 * signature of reclassification, not loss.
 *
 * So the counts go. What replaces them is the thing a count was a proxy for:
 * *this* definition is semantic, *that* one is preserved with its bytes. Naming
 * identities means the next construct to gain semantic support changes one line
 * in the gate that owns it, and changes nothing anywhere else — instead of
 * silently invalidating twelve assertions that nobody re-runs.
 *
 * This module is plumbing only. Each gate declares its own expected sets, and
 * each carries its own mutation evidence.
 */

/**
 * Build an expression that reports the footnote membership of the rich editor.
 *
 * Returns `{ semantic, preserved, references }` where `semantic` is the list of
 * definition identifiers mounted as real `data-mme-footnote-definition` nodes
 * and `preserved` is the raw text of each `data-mme-preserved-footnote` figure.
 *
 * `semantic` is keyed on `data-mme-footnote-identifier`, the definition's real
 * identity. The first version read `aria-label` minus its "Footnote " prefix, but
 * that is derived from the *label* attribute — which falls back to the identifier
 * today and would silently diverge the moment a definition carried a distinct
 * label. (Test Reviewer, MME-0116.)
 */
export function footnoteMembershipExpression(host = '[data-testid="rich-editor-host"] .ProseMirror') {
  return `(() => {
    const editor = document.querySelector(${JSON.stringify(host)});
    if (!editor) {
      return null;
    }
    return {
      preserved: [...editor.querySelectorAll('[data-mme-preserved-footnote="true"]')].map((figure) =>
        figure.textContent.replace("Preserved Markdown footnote. Edit in Source mode.", "").trim()
      ),
      references: editor.querySelectorAll('[data-mme-footnote-reference="true"]').length,
      semantic: [...editor.querySelectorAll('[data-mme-footnote-definition="true"]')].map(
        (definition) => definition.getAttribute("data-mme-footnote-identifier") ?? ""
      )
    };
  })()`;
}

/**
 * Check a membership report against what a fixture must contain.
 *
 * @param {{preserved: string[], references: number, semantic: string[]} | null} report
 * @param {{semantic?: string[], preserved?: string[], notPreserved?: string[], references?: number}} expected
 *   `semantic` — identifiers that must mount as real footnote definitions.
 *   `preserved` — substrings that must each appear in some preserved figure.
 *   `notPreserved` — substrings that must appear in NO preserved figure. This is
 *   the half that stops the check being satisfiable by preserving everything:
 *   without it, a rich view that gave up and fell back on the whole document
 *   would still satisfy every `preserved` expectation.
 *   `references` — reference count, a property of the fixture's prose that no
 *   semantic conversion changes.
 * @returns {string | undefined} a failure description, or undefined when it holds
 */
export function describeFootnoteMembershipFailure(report, expected) {
  if (!report) {
    return "the rich editor is not mounted";
  }
  const problems = [];
  for (const identifier of expected.semantic ?? []) {
    if (!report.semantic.includes(identifier)) {
      problems.push(`[^${identifier}] must mount as a semantic definition; semantic: ${JSON.stringify(report.semantic)}`);
    }
  }
  for (const needle of expected.preserved ?? []) {
    if (!report.preserved.some((text) => text.includes(needle))) {
      problems.push(`${JSON.stringify(needle)} must stay a preserved fallback with its bytes intact`);
    }
  }
  for (const needle of expected.notPreserved ?? []) {
    if (report.preserved.some((text) => text.includes(needle))) {
      problems.push(`${JSON.stringify(needle)} must NOT be a preserved fallback — it has semantic support`);
    }
  }
  if (expected.references !== undefined && report.references !== expected.references) {
    return [...problems, `expected ${expected.references} footnote reference(s), found ${report.references}`].join("; ");
  }
  return problems.length > 0 ? problems.join("; ") : undefined;
}

/**
 * Poll the rich mount until it satisfies `expected`, then return the report.
 *
 * Takes the caller's `evaluate` so each gate keeps its own CDP client; the
 * failure message names what was missing rather than saying a wait timed out,
 * because "expected 7, found 5" is what made these gates expensive to diagnose.
 *
 * @param {(cdp: unknown, expression: string) => Promise<unknown>} evaluate
 */
export async function assertFootnoteMembership(evaluate, cdp, expected, options = {}) {
  const deadline = Date.now() + (options.timeoutMs ?? 7000);
  let failure = "never evaluated";
  for (;;) {
    const report = await evaluate(cdp, footnoteMembershipExpression(options.host));
    failure = describeFootnoteMembershipFailure(report, expected);
    if (!failure) {
      return report;
    }
    if (Date.now() >= deadline) {
      throw new Error(`Footnote membership: ${failure}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}
