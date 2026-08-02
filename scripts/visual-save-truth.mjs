/**
 * MME-0114 — the save-truthfulness invariant, expressed on the pair.
 *
 * `MME-0008`, `MME-0009` and `MME-0011` each asserted that the `save-state`
 * field must never read exactly `saved`, and `MME-0008` asserted the same of the
 * Save Engine panel's `save-engine-state`. That was right when each was a single
 * self-describing label. `MME-0028` split the status popover: it now renders
 * `persistence-target` ("fixture, memory only, not persisted") immediately above
 * `save-state` ("saved"), so the user does see where the content went, and Gate
 * 6 is satisfied — the gates had become over-strict by reading one field in
 * isolation.
 *
 * Relaxing them was the wrong repair. Asserting the *pair* is stronger than the
 * original, because it also fails if a future change drops the target line,
 * moves it out of the panel, reorders it below the status, or leaves it where no
 * user can read it — none of which the single-field check could ever catch.
 *
 * Two things this module learned from review, both of which had made the first
 * version weaker than what it replaced:
 *
 *  - **Visibility is part of the claim.** Both lines live inside a collapsed
 *    `<details>`. Reading `textContent` out of a closed disclosure would assert
 *    text no user can see — the exact vacuity `visual-demo-disclosures.mjs`
 *    exists to prevent. The pair therefore reports whether the panel is open and
 *    laid out, and the invariant rejects it when it is not.
 *  - **Both panels, not one.** The demo shows the same truth twice: the status
 *    popover for users, the Save Engine diagnostics for developers. Dropping the
 *    second would have been a silent coverage loss, so both are checked.
 *
 * The invariant, in Gate 6's own terms: the UI may say `saved` only when the
 * user can read, next to it, what it was saved to.
 */

/** Status words that describe state without naming a persistence target. */
const BARE_STATUS_WORDS = new Set(["clean", "conflict", "dirty", "error", "saved", "saving", "unsaved"]);

/**
 * An expression that reads both panels and their structural relationships.
 *
 * Spliced into a gate's own snapshot as `savePair: ${SAVE_TRUTH_PAIR_EXPRESSION}`.
 * It deliberately reports adjacency and visibility rather than text alone: "the
 * target label exists somewhere in the DOM" is not the same claim as "the user
 * reads it next to the word saved".
 */
export const SAVE_TRUTH_PAIR_EXPRESSION = `(() => {
  /*
   * Open the popover the way a user does, immediately before reading it. Opening
   * once at page load is not enough: the demo re-renders the status panel on
   * every document/save-state change, which replaces the <details> and resets it
   * to closed. Reading a collapsed panel would assert text nobody can see.
   */
  const popover = document.querySelector('[data-testid="document-status-popover"]');
  if (popover && !popover.open) {
    const summary = popover.querySelector("summary");
    if (summary) {
      summary.click();
    }
  }

  const read = (testId) => {
    const element = document.querySelector('[data-testid="' + testId + '"]');
    return element ? element.textContent.trim() : null;
  };
  const target = document.querySelector('[data-testid="persistence-target"]');
  const save = document.querySelector('[data-testid="save-state"]');
  const panel = document.querySelector('[data-testid="document-status-popover"]');
  return {
    engineState: read("save-engine-state"),
    engineTarget: read("save-engine-target"),
    inSamePanel: Boolean(panel && target && save && panel.contains(target) && panel.contains(save)),
    saveState: read("save-state"),
    targetLabel: read("persistence-target"),
    targetPrecedesStatus: Boolean(
      target && save && target.compareDocumentPosition(save) & Node.DOCUMENT_POSITION_FOLLOWING
    ),
    // Open *and* laid out. A disclosure the gate never opened would make every
    // text assertion below a statement about invisible DOM.
    visible: Boolean(panel && panel.open && save && save.offsetParent !== null)
  };
})()`;

/**
 * Assert both panels satisfy Gate 6.
 *
 * @param {object} pair the value produced by `SAVE_TRUTH_PAIR_EXPRESSION`
 * @param {string} label the scenario being checked, for the failure message
 */
export function assertSaveTruthPair(pair, label) {
  const context = `\n${label}: ${JSON.stringify(pair)}`;

  if (!pair?.saveState) {
    throw new Error(`Save UI must render a non-empty save-state line.${context}`);
  }
  if (!pair.targetLabel) {
    throw new Error(
      `Save UI must render a persistence-target line beside the status. Dropping it is exactly the regression this pair assertion exists to catch.${context}`
    );
  }
  if (!pair.inSamePanel) {
    throw new Error(
      `The persistence target and the save status must live in the same status panel; a target the user cannot read beside the status does not satisfy Gate 6.${context}`
    );
  }
  if (!pair.targetPrecedesStatus) {
    throw new Error(`The persistence target must be rendered above the save status.${context}`);
  }
  if (!pair.visible) {
    throw new Error(
      `The status panel must be open and laid out when this is asserted. Reading it while collapsed asserts text no user can see.${context}`
    );
  }
  if (BARE_STATUS_WORDS.has(pair.targetLabel.toLowerCase())) {
    throw new Error(
      `The persistence target must name a real target, not repeat a bare status word.${context}`
    );
  }

  /*
   * The Save Engine diagnostics panel carries the same truth for developers, and
   * the assertion this module replaced checked it too — dropping it would have
   * been a silent coverage loss.
   *
   * Scope, deliberately: only a bare `saved` is rejected, exactly as before.
   * `dirty`, `saving`, `conflict` and `error` claim no persistence, so a bare one
   * of those is honest; `saveEngineStatusLabel` returns them verbatim by design.
   * Rejecting every status word here would fail the panel for saying `dirty`,
   * which is not what Gate 6 is about.
   */
  if (!pair.engineState) {
    throw new Error(`The Save Engine panel must render a state.${context}`);
  }
  if (pair.engineState.toLowerCase() === "saved") {
    throw new Error(
      `The Save Engine panel must not display a bare "saved"; it has to name the target it saved to.${context}`
    );
  }
}
