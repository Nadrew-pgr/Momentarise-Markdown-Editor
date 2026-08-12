/**
 * MME-0116 — reading a rich block's document text, not its chrome.
 *
 * MME-0029 renders a block-affordance widget inside every top-level block: a
 * `contenteditable="false"` `<span data-rich-block-affordance>` carrying the
 * insert and drag-handle buttons. It is a ProseMirror decoration, so it is not
 * part of the document — but it *is* part of the DOM subtree, and `textContent`
 * does not know the difference. A heading reading `Reco` became `+::Reco`, which
 * is why `mme-0013.5` and `mme-0014` went red without anything being broken.
 *
 * Stripping the widget is the whole repair. Deliberately not a `startsWith`
 * tolerance or a `.includes` loosening: those would also accept a heading whose
 * real text had gained a prefix, which is a corruption this project exists to
 * catch. This removes the decoration and then compares exactly.
 */

/** The decoration wrapper MME-0029 mounts inside every top-level block. */
export const BLOCK_AFFORDANCE_SELECTOR = "[data-rich-block-affordance]";

/**
 * An expression yielding the document text of the first `selector` match, with
 * block-affordance decorations removed, or `null` when nothing matches.
 *
 * @param {string} selector a CSS selector, e.g. `.ProseMirror h1`
 */
export function richTextExpression(selector) {
  return `(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!element) {
      return null;
    }
    const clone = element.cloneNode(true);
    for (const widget of clone.querySelectorAll(${JSON.stringify(BLOCK_AFFORDANCE_SELECTOR)})) {
      widget.remove();
    }
    return clone.textContent;
  })()`;
}

/**
 * An expression yielding the top-level content blocks of the rich editor, with
 * every ProseMirror widget decoration excluded.
 *
 * A gate that wants "the last block" means the last block of the *document*.
 * `.ProseMirror`'s children also include decorations, and filtering only
 * `[data-rich-block-affordance]` is not enough: the fold gutter mounts a second
 * widget after it, so `children.at(-1)` returned a 16px button and MME-0042
 * computed its click point off the gutter, 24px outside the editor. Filtering on
 * ProseMirror's own `.ProseMirror-widget` marker covers every decoration rather
 * than the one that happened to exist when the gate was written.
 */
export function richContentBlocksExpression(host = '[data-testid="rich-editor-host"] .ProseMirror') {
  return `(() => {
    const editor = document.querySelector(${JSON.stringify(host)});
    if (!editor) {
      return [];
    }
    return [...editor.children].filter((child) => !child.classList.contains("ProseMirror-widget"));
  })()`;
}

/**
 * An expression yielding the trimmed document text of every `selector` match,
 * with block-affordance decorations removed.
 *
 * Gates compare these with `Array.prototype.includes`, which is exact equality —
 * so an undetected `+::` prefix does not merely loosen the check, it makes every
 * comparison false.
 */
export function richTextListExpression(selector) {
  return `[...document.querySelectorAll(${JSON.stringify(selector)})].map((element) => {
    const clone = element.cloneNode(true);
    for (const widget of clone.querySelectorAll(${JSON.stringify(BLOCK_AFFORDANCE_SELECTOR)})) {
      widget.remove();
    }
    return clone.textContent.trim();
  })`;
}

/**
 * An expression yielding the index of the first `selector` match whose document
 * text equals `text` (decorations stripped), or `-1`.
 *
 * Used by gates that locate a block by what the user reads, then act on it by
 * position — hovering a heading, for instance.
 */
export function richTextIndexExpression(selector, text) {
  return `(() => {
    const elements = [...document.querySelectorAll(${JSON.stringify(selector)})];
    return elements.findIndex((element) => {
      const clone = element.cloneNode(true);
      for (const widget of clone.querySelectorAll(${JSON.stringify(BLOCK_AFFORDANCE_SELECTOR)})) {
        widget.remove();
      }
      return clone.textContent.trim() === ${JSON.stringify(text)};
    });
  })()`;
}
