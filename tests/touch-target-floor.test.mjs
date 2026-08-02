/**
 * MME-0117 — the packaged coarse-pointer touch floor cannot be undercut by a
 * host rule of equal specificity.
 *
 * MME-0100 moved the 44px coarse-pointer sizing out of the demo stylesheet and
 * into `@momentarise/md-theme`. The demo `@import`s the theme first, so its own
 * rules — `.command-palette-button { min-width: 30px }`, and
 * `.editor-ai-button { min-width: 34px }` inside a narrow-viewport block — had
 * equal specificity, loaded later, and won. Two controls shipped at 30px and
 * 34px against a 44px accessibility contract, and the only thing that would have
 * caught it was one of the visual gates nothing ran.
 *
 * This check is the structural half of that contract, and it runs on every push:
 * a host stylesheet may not set a sizing property below the touch floor on any
 * class that shares an element with a class the packaged floor targets, unless
 * the rule is explicitly scoped to a fine pointer.
 *
 * It reads three real files rather than a fixture, because the defect lived in
 * the relationship between them: the packaged floor, the host stylesheet that
 * competes with it, and the markup that puts both classes on one element.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(join(repoRoot, relativePath), "utf8");

const TOUCH_FLOOR_PX = 44;
const SIZING_PROPERTY = /^(min-)?(inline-size|block-size|width|height)$/;

/**
 * Deliberate exclusions, each with the reason it is not a tap target.
 * An entry here is a decision, not a way to silence the check.
 */
const NOT_A_TAP_TARGET = {
  "asset-upload-icon": "An icon inside a button; the button is the target and carries the floor.",
  "file-input": "A visually-hidden 1px file input. Its label/button is the tap target; sizing it would break the hidden-input pattern.",
  "markdown-read-banner": "A non-interactive banner."
};

/* ------------------------------------------------------------------ *
 * A brace-aware walk, so nested `@media` blocks keep their conditions.
 * ------------------------------------------------------------------ */

function declarations(rawCss) {
  // Comments first: a `{` inside one would desynchronise the brace walk.
  const css = rawCss.replace(/\/\*[\s\S]*?\*\//g, "");
  const found = [];
  const stack = [];
  let buffer = "";

  const flushBlock = (prelude, body) => {
    for (const raw of body.split(";")) {
      const [property, value] = raw.split(":").map((part) => part?.trim());
      if (!property || !value) {
        continue;
      }
      /*
       * `0` counts. `min-width: 0` is the commonest flex idiom in this codebase
       * and it defeats a `min-inline-size: 44px` floor completely, so treating it
       * as "not a size" would leave the likeliest future mistake unguarded.
       * rem/em are normalised at the 16px root this project uses; anything else
       * fails closed rather than being skipped.
       */
      const length = value.match(/^(-?[\d.]+)(px|rem|em)?$/);
      const pixels = length
        ? Number(length[1]) * (length[2] === "rem" || length[2] === "em" ? 16 : 1)
        : /^(calc|min|max|clamp)\(/.test(value)
          ? Number.NaN
          : undefined;
      if (pixels === undefined) {
        continue;
      }
      found.push({
        conditions: stack.filter((entry) => entry.startsWith("@media")).join(" and "),
        property,
        pixels,
        raw: value,
        selector: prelude
      });
    }
  };

  for (let index = 0; index < css.length; index += 1) {
    const character = css[index];
    if (character === "{") {
      stack.push(buffer.trim().replace(/\s+/g, " "));
      buffer = "";
    } else if (character === "}") {
      const prelude = stack.pop();
      if (prelude && !prelude.startsWith("@")) {
        flushBlock(prelude, buffer);
      }
      buffer = "";
    } else {
      buffer += character;
    }
  }
  return found;
}

/** Every class named anywhere in a selector list. */
function classesIn(selector) {
  return [...selector.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map((match) => match[1]);
}

/* ------------------------------------------------------------------ *
 * 1. What the packaged stylesheet promises under a coarse pointer.
 * ------------------------------------------------------------------ */

const theme = read("packages/md-theme/src/styles.css");
const floorClasses = new Set();

{
  const start = theme.indexOf("@media (any-pointer: coarse)");
  assert.ok(
    start > -1,
    "packages/md-theme/src/styles.css must define an `@media (any-pointer: coarse)` block. " +
      "`(pointer: coarse)` is not sufficient: it describes the primary device, so the floor vanishes on every touchscreen laptop."
  );
  // Balanced scan of the coarse block.
  let depth = 0;
  let end = start;
  for (let index = theme.indexOf("{", start); index < theme.length; index += 1) {
    if (theme[index] === "{") depth += 1;
    else if (theme[index] === "}") {
      depth -= 1;
      if (depth === 0) {
        end = index;
        break;
      }
    }
  }
  const block = theme.slice(start, end);
  assert.match(
    block,
    /var\(--mme-touch-target-size\)/,
    "The packaged coarse-pointer block must size targets from --mme-touch-target-size, not a raw value."
  );
  /*
   * Every sizing declaration in the block, not merely one of them. A raw `44px`
   * looks identical today and silently detaches the floor from the token the
   * moment a host retunes `--mme-touch-target-size` — which is the whole point of
   * having the token (Gate 13: one source of truth, no raw values).
   */
  for (const declaration of block.matchAll(/(min-)?(inline-size|block-size|width|height)\s*:\s*([^;]+);/g)) {
    assert.match(
      declaration[3].trim(),
      /var\(--mme-[a-z-]+\)|calc\(|auto|100%|none/,
      `packages/md-theme/src/styles.css coarse-pointer block: \`${declaration[0].trim()}\` uses a raw value. ` +
        "Touch sizing must come from --mme-touch-target-size so a host retuning the token cannot be silently ignored."
    );
  }
  for (const name of classesIn(block)) {
    floorClasses.add(name);
  }
}

assert.ok(
  floorClasses.has("button"),
  "The packaged coarse floor must cover `.button`; it is the class every surface control carries."
);

/* ------------------------------------------------------------------ *
 * 2. Which host classes share an element with a floor class.
 *
 * This is the link static CSS cannot see: `.command-palette-button` only
 * competes with the packaged floor because the same element is also `.button`.
 * ------------------------------------------------------------------ */

/*
 * Two independent sources, because either alone has a hole.
 *
 *  - Every class the packaged floor names is competing by definition: a host
 *    rule for `.document-conflict-action` undercuts the floor whether or not the
 *    demo's markup mentions it. Those classes are created by md-surface at
 *    runtime and appear nowhere in the demo's literal markup.
 *  - Plus the classes that SHARE AN ELEMENT with one, which is the link static
 *    CSS cannot see: `.command-palette-button` only competes because the same
 *    element is also `.button`. Both `class="..."` attributes and runtime
 *    `className =` assignments count.
 */
const competing = new Set(floorClasses);
const markupSources = ["apps/md-demo/src/main.ts", "packages/md-surface/src/index.ts"];
for (const source of markupSources) {
  const text = read(source);
  const attributeLists = [...text.matchAll(/class=["']([^"'${}]+)["']/g)].map((match) => match[1]);
  const assignedLists = [...text.matchAll(/className\s*=\s*["']([^"'${}]+)["']/g)].map((match) => match[1]);
  for (const list of [...attributeLists, ...assignedLists]) {
    const names = list.split(/\s+/).filter(Boolean);
    if (names.some((name) => floorClasses.has(name))) {
      for (const name of names) {
        competing.add(name);
      }
    }
  }
}

assert.ok(
  competing.has("command-palette-button") && competing.has("editor-ai-button"),
  "The two controls MME-0117 repaired must be recognised as competing with the packaged floor; " +
    "if this fails the markup scan has stopped seeing them and the check below proves nothing."
);

/* ------------------------------------------------------------------ *
 * 3. No host rule may undercut the floor outside a fine-pointer scope.
 * ------------------------------------------------------------------ */

const HOST_STYLESHEETS = ["apps/md-demo/src/styles.css"];

for (const stylesheet of HOST_STYLESHEETS) {
  for (const rule of declarations(read(stylesheet))) {
    if (!SIZING_PROPERTY.test(rule.property)) {
      continue;
    }
    if (Number.isNaN(rule.pixels)) {
      // A computed length this check cannot resolve is not evidence of safety.
      assert.ok(
        !competing.has(classesIn(rule.selector)[0]),
        `${stylesheet}: \`${rule.selector} { ${rule.property}: ${rule.raw} }\` uses a computed length this check cannot resolve, ` +
          "on a class that competes with the packaged touch floor. Express it in px or rem, or scope it to `not (any-pointer: coarse)`."
      );
      continue;
    }
    if (rule.pixels >= TOUCH_FLOOR_PX) {
      continue;
    }
    /*
     * The only safe exemption: the rule cannot apply where a coarse pointer
     * exists. `(pointer: fine)` is NOT that — it matches on every touchscreen
     * laptop. Nor is `(any-pointer: fine)`, which the previous unanchored regex
     * accepted and which is true on the very devices this floor protects.
     */
    if (/\bnot\b[^)]*\(\s*any-pointer:\s*coarse\s*\)/.test(rule.conditions)) {
      continue;
    }
    for (const name of classesIn(rule.selector)) {
      if (!competing.has(name) || NOT_A_TAP_TARGET[name]) {
        continue;
      }
      assert.fail(
        `${stylesheet}: \`${rule.selector} { ${rule.property}: ${rule.pixels}px }\` undercuts the ${TOUCH_FLOOR_PX}px coarse-pointer floor ` +
          `for \`.${name}\`, which shares an element with a class the packaged stylesheet sizes. ` +
          "Scope the rule to `@media (pointer: fine)`, or raise it to var(--mme-touch-target-size)."
      );
    }
  }
}

/* ------------------------------------------------------------------ *
 * 4. Demo-owned interactive chrome carries the floor too.
 *
 * The packaged block only covers the classes md-surface renders. Controls the
 * demo renders itself are the demo's responsibility, and a 24px button is an
 * accessibility failure regardless of which package drew it.
 * ------------------------------------------------------------------ */

const demoStylesheet = read("apps/md-demo/src/styles.css");
const demoCoarse = demoStylesheet.slice(demoStylesheet.indexOf("@media (any-pointer: coarse)"));
for (const name of ["rich-block-menu", "html-preview-details-toggle", "property-mode"]) {
  assert.ok(
    demoCoarse.includes(`.${name}`),
    `apps/md-demo/src/styles.css must raise \`.${name}\` to the touch floor under a coarse pointer; it is an interactive control the packaged stylesheet does not target.`
  );
}

/*
 * An exclusion has to be checkable. Prose length proves nothing: adding
 * "the palette has a keyboard shortcut so this is fine" would have silenced the
 * very defect this issue exists to fix. So an excluded class must not appear on
 * an interactive element in any markup source — if it does, it is a control and
 * the floor applies to it.
 */
const interactiveMarkup = markupSources
  .map((source) => read(source))
  .join("\n")
  .match(/<(button|summary|a|input|select|textarea)\b[^>]*>/g) ?? [];

for (const [name, reason] of Object.entries(NOT_A_TAP_TARGET)) {
  assert.ok(
    reason.length > 20,
    `The exclusion for \`.${name}\` must say why it is not a tap target.`
  );
  const onAControl = interactiveMarkup.some((tag) => new RegExp(`class=["'][^"']*\\b${name}\\b`).test(tag));
  if (!onAControl) {
    continue;
  }
  /*
   * It IS on a control, so the exclusion only holds if the stylesheet makes it
   * untappable. `.file-input` qualifies: `opacity: 0; pointer-events: none` — the
   * visually-hidden pattern whose real tap target is the label beside it.
   */
  const rule = demoStylesheet.match(new RegExp(`\\.${name}\\s*\\{([^}]*)\\}`));
  assert.ok(
    rule && /pointer-events:\s*none/.test(rule[1]),
    `\`.${name}\` is excluded from the touch floor and appears on an interactive element, ` +
      "but nothing makes it untappable. An exclusion may only cover things a user cannot tap; " +
      "declare `pointer-events: none` or remove the exclusion."
  );
}

/* ------------------------------------------------------------------ *
 * 5. The floor is not overridable, and density cannot push under WCAG AA.
 *
 * Both of these survived their first mutation run, which is precisely what the
 * `AGENT.md` rule is for: the implementation was correct and nothing asserted it,
 * so a later edit could have removed either silently.
 * ------------------------------------------------------------------ */

{
  const start = theme.indexOf("@media (any-pointer: coarse)");
  let depth = 0;
  let end = start;
  for (let index = theme.indexOf("{", start); index < theme.length; index += 1) {
    if (theme[index] === "{") depth += 1;
    else if (theme[index] === "}") {
      depth -= 1;
      if (depth === 0) {
        end = index;
        break;
      }
    }
  }
  const block = theme.slice(start, end);
  const sized = [...block.matchAll(/(min-)?(inline-size|block-size):\s*var\(--mme-touch-target-size\)([^;]*);/g)];
  assert.ok(sized.length >= 8, `Expected the coarse block to size at least 8 declarations from the token; found ${sized.length}.`);
  for (const declaration of sized) {
    assert.match(
      declaration[3],
      /!important/,
      `packages/md-theme/src/styles.css: \`${declaration[0].trim()}\` must be !important. ` +
        "A host stylesheet loaded after the package has equal specificity and would otherwise win — which is exactly how MME-0100 shipped 30px and 34px targets. " +
        "The --mme-touch-target-size token remains the legitimate way to retune it."
    );
  }
}

/*
 * WCAG 2.2 SC 2.5.8 is device-independent: 24x24 CSS px applies at every pointer
 * type, so the fine-pointer rendering must clear it on its own. `--mme-density`
 * runs as low as 0.86, which put a 28px control at 24.08px — above the minimum by
 * 0.08px, i.e. one rounding error away from failing.
 */
for (const declaration of theme.matchAll(/(min-block-size|min-height):\s*([^;]*--mme-density[^;]*);/g)) {
  assert.match(
    declaration[2],
    /max\(\s*24px/,
    `packages/md-theme/src/styles.css: \`${declaration[0].trim()}\` scales a control by --mme-density without a floor. ` +
      "Wrap it in max(24px, …) so compact density cannot push a target below the WCAG AA minimum."
  );
}
