import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import puppeteer from "puppeteer";
import { clearGeneratedArtifacts } from "./visual-artifacts.mjs";
import { requireChromeExecutable } from "./chrome-helpers.mjs";

/**
 * MME-0090 — the frontmatter Properties panel, measured in a real browser.
 *
 * The unit suite proves the splice engine and the panel's DOM contract in
 * jsdom. Three things it cannot prove live here, and the first one already
 * caught a defect that shipped past every green assertion: the panel is
 * initialised during the demo's module evaluation, and a `let` declared beside
 * its own render function was still in its temporal dead zone at that point —
 * the whole demo threw on load while jsdom stayed green.
 *
 * So this gate asserts, at 1280 and at 390:
 *
 *   1. The panel paints, above the document title, with no overlap and nothing
 *      clipped out of its own box.
 *   2. Every interaction is driven through real pointer and keyboard events, and
 *      every one of them is checked in BYTES — `getMarkdown()` before and after.
 *      A control that renders and writes the wrong Markdown fails here.
 *   3. The interaction set the issue's benchmark names — six types behind a
 *      clickable icon, three display states, ⌘; to add, ⌘⌫ to delete the focused
 *      property, `---` at the start of the file to create the block — is
 *      reachable with the mouse and the keyboard, not just through the API.
 */

const demoUrl = process.env.MME_DEMO_URL ?? "http://127.0.0.1:5174/";
const visualDir = "docs/internal/visual-checks/MME-0090";

const VIEWPORTS = [
  { height: 900, name: "1280", width: 1280 },
  { height: 844, name: "390", width: 390 }
];
const SCHEMES = ["dark", "light"];
const TOUCH_FLOOR_PX = 44;

/** The six benchmark types plus the three classes of value that must stay read-only. */
const FIXTURE = await readFile("fixtures/041-frontmatter-properties/input.md", "utf8");

const EXPECTED_ROWS = [
  { editable: true, key: "title", type: "text" },
  { editable: true, key: "priority", type: "number" },
  { editable: true, key: "published", type: "checkbox" },
  { editable: true, key: "created", type: "date" },
  { editable: true, key: "reviewed", type: "datetime" },
  { editable: true, key: "tags", type: "list" },
  { editable: true, key: "quoted", type: "text" },
  { editable: false, key: "nested", type: "text" },
  { editable: false, key: "summary", type: "text" },
  { editable: false, key: "anchored", type: "text" }
];

const settle = async (page, ms = 160) => {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await new Promise((resolve) => setTimeout(resolve, ms));
};

const markdown = (page) => page.evaluate(() => window.__MME_DEMO_VISUAL_CHECK__.getMarkdown());

async function setScheme(page, scheme) {
  await page.evaluate((value) => {
    document.documentElement.setAttribute("data-mme-scheme", value);
  }, scheme);
}

async function loadFixture(page, content = FIXTURE) {
  await page.evaluate(
    (value) => window.__MME_DEMO_VISUAL_CHECK__.loadWritableMarkdownFileForTest("properties-fixture.md", value),
    content
  );
  await settle(page, 240);
  await page.evaluate(() => window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("rich"));
  await settle(page, 320);
  const state = await page.evaluate(() => ({
    mode: document.querySelector("#app")?.dataset.editorMode ?? null,
    markdown: window.__MME_DEMO_VISUAL_CHECK__.getMarkdown().slice(0, 40),
    hostHidden: document.querySelector('[data-testid="properties-surface-host"]')?.hidden ?? null,
    panel: Boolean(document.querySelector('[data-testid="properties-surface"]'))
  }));
  assert.equal(state.mode, "rich", `fixture load left the demo in ${state.mode} mode (markdown: ${JSON.stringify(state.markdown)}, host hidden: ${state.hostHidden}, panel: ${state.panel})`);
}

/*
 * A real pointer click at the element's own centre, so a painted-over control
 * fails. The scroll and the measurement are separate steps on purpose: reading
 * the rect in the same evaluate as `scrollIntoView` returned pre-scroll
 * coordinates at 390, where the panel is tall enough to scroll, and the click
 * landed on whatever happened to be at those coordinates instead.
 */
async function clickAt(page, selector, options = {}) {
  const found = await page.evaluate((value) => {
    const node = document.querySelector(value);
    if (!node) {
      return false;
    }
    node.scrollIntoView({ block: "center" });
    return true;
  }, selector);
  assert.ok(found, `no element matches ${selector}, so it cannot be clicked`);
  await settle(page, 120);
  const box = await page.evaluate((value) => {
    const rect = document.querySelector(value).getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }, selector);
  await page.mouse.click(box.x, box.y, options);
  await settle(page, 220);
}

async function clickTestId(page, testId) {
  await clickAt(page, `[data-testid="${testId}"]`);
}

/** Chooses a value type from the open type menu by the type it names. */
async function chooseType(page, propertyType) {
  await clickAt(page, `[data-testid="property-type-option"][data-property-type="${propertyType}"]`);
}

async function clickInRow(page, rowIndex, testId, options = {}) {
  await clickAt(
    page,
    `[data-testid="property-row"][data-property-index="${rowIndex}"] [data-testid="${testId}"]`,
    options
  );
}

/** Empties the focused text input with real keystrokes. */
async function clearFocusedInput(page) {
  const length = await page.evaluate(() => document.activeElement?.value?.length ?? 0);
  await page.keyboard.press("End");
  for (let index = 0; index < length; index += 1) {
    await page.keyboard.press("Backspace");
  }
  await settle(page, 80);
}

/** Geometry and inventory of the panel as painted. */
async function measurePanel(page) {
  return page.evaluate(() => {
    const panel = document.querySelector('[data-testid="properties-surface"]');
    if (!panel || panel.hidden) {
      return { visible: false };
    }
    const rect = panel.getBoundingClientRect();
    const firstBlock = document.querySelector(".ProseMirror > :not([data-rich-block-affordance])");
    const rows = [...panel.querySelectorAll('[data-testid="property-row"]')].map((row) => ({
      editable: row.dataset.propertyEditable,
      hasRawValue: Boolean(row.querySelector('[data-testid="property-raw-value"]')),
      hasValueInput: Boolean(row.querySelector('[data-testid="property-value"]')),
      index: Number(row.dataset.propertyIndex),
      inputType: row.querySelector('[data-testid="property-value"]')?.type ?? null,
      key: row.querySelector('[data-testid="property-key"]')?.value ?? null,
      reason: row.dataset.propertyReason ?? null,
      type: row.dataset.propertyType
    }));
    /*
     * Reachability, not presence: MME-0119 shipped an overlay that measured
     * correctly and was painted over, so every control is hit-tested at its own
     * centre and measured against the panel's box.
     */
    const controls = [...panel.querySelectorAll("button, input")].filter((node) => !node.hidden && !node.disabled);
    const occluded = [];
    const clipped = [];
    const undersized = [];
    for (const node of controls) {
      const box = node.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) {
        continue;
      }
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      if (hit && !node.contains(hit) && !hit.contains(node)) {
        occluded.push({ paintedBy: hit.className, testId: node.dataset.testid ?? node.className });
      }
      if (box.right > window.innerWidth + 0.5 || box.left < -0.5) {
        clipped.push({ left: box.left, right: box.right, testId: node.dataset.testid ?? node.className });
      }
      undersized.push({ height: box.height, testId: node.dataset.testid ?? node.className, width: box.width });
    }
    return {
      controlSizes: undersized,
      clipped,
      headingTop: firstBlock ? firstBlock.getBoundingClientRect().top : null,
      occluded,
      overflow: { client: panel.clientWidth, scroll: panel.scrollWidth },
      panel: rect.toJSON(),
      rows,
      sourceText: panel.querySelector('[data-testid="properties-source"]')?.textContent ?? null,
      viewportWidth: window.innerWidth,
      visible: true
    };
  });
}

/*
 * Exact equality against the expected document, not line membership.
 *
 * A membership check ("every surviving line still appears somewhere") is blind
 * to duplication, insertion and reordering — a splice that duplicated a key or
 * reordered the block passed it. In a gate whose whole claim is byte exactness
 * that is not good enough.
 */
function assertDocumentEquals(actual, expected, label) {
  assert.equal(actual, expected, `${label}: the document is not byte-for-byte what this edit should produce`);
}

async function main() {
  await mkdir(visualDir, { recursive: true });
  await clearGeneratedArtifacts(visualDir);
  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
    executablePath: requireChromeExecutable(),
    headless: "new"
  });

  const evidence = {};
  try {
    for (const viewport of VIEWPORTS) {
      const page = await browser.newPage();
      const coarse = viewport.width === 390;
      await page.setViewport({
        deviceScaleFactor: 1,
        hasTouch: coarse,
        height: viewport.height,
        isMobile: coarse,
        width: viewport.width
      });
      const consoleErrors = [];
      page.on("pageerror", (error) => consoleErrors.push(String(error.message)));
      await page.goto(demoUrl, { waitUntil: "networkidle0" });
      await page.waitForSelector('[data-testid="properties-surface-host"]');
      await loadFixture(page);
      const perViewport = {};

      /* ---- the panel paints, above the title, complete and reachable ------ */
      const painted = await measurePanel(page);
      assert.equal(painted.visible, true, `@${viewport.name}: the Properties panel did not paint in Rich mode.`);
      assert.ok(
        painted.headingTop !== null && painted.panel.bottom <= painted.headingTop + 0.5,
        `@${viewport.name}: the panel must sit ABOVE the document title; panel bottom ${painted.panel.bottom} vs heading top ${painted.headingTop}.`
      );
      assert.deepEqual(
        painted.rows.map((row) => ({ editable: row.editable === "true", key: row.key, type: row.type })),
        EXPECTED_ROWS,
        `@${viewport.name}: the rendered rows do not match the fixture's properties.`
      );
      assert.deepEqual(
        painted.rows.filter((row) => row.editable === "true" && row.type !== "list").map((row) => row.inputType),
        ["text", "number", "checkbox", "date", "datetime-local", "text"],
        `@${viewport.name}: each of the six benchmark types must render its own input.`
      );
      for (const row of painted.rows.filter((candidate) => candidate.editable === "false")) {
        assert.equal(row.hasValueInput, false, `@${viewport.name}: read-only property "${row.key}" offered an input.`);
        assert.equal(row.hasRawValue, true, `@${viewport.name}: read-only property "${row.key}" showed no raw value.`);
      }
      /*
       * Occlusion, with one recorded exception and its owning issue.
       *
       * Measured at 390: the demo's floating `TECHNICAL DIAGNOSTICS` chip is
       * `position: fixed` in the bottom-right corner and paints over whichever
       * panel row happens to sit under it — here a `property-remove` button, a
       * control a writer cannot then tap. That chip is demo chrome, not a
       * package surface, and MME-0091 ("Diagnostics chip moves into the status
       * popover; it never overlaps document content") owns removing it. It is
       * named explicitly rather than filtered by a wildcard, so anything ELSE
       * that ever paints over this panel still fails this gate.
       */
      const unexpectedOcclusion = painted.occluded.filter(
        (entry) => !String(entry.paintedBy).includes("debug-inspector-toggle")
      );
      assert.deepEqual(
        unexpectedOcclusion,
        [],
        `@${viewport.name}: painted-over controls: ${JSON.stringify(unexpectedOcclusion)}`
      );
      perViewport.knownOcclusionOwnedByMme0091 = painted.occluded;
      assert.deepEqual(painted.clipped, [], `@${viewport.name}: controls outside the viewport: ${JSON.stringify(painted.clipped)}`);
      assert.ok(
        painted.overflow.scroll <= painted.overflow.client + 0.5,
        `@${viewport.name}: the panel needs ${painted.overflow.scroll}px inside a ${painted.overflow.client}px box, so a row is clipped.`
      );
      if (coarse) {
        const small = painted.controlSizes.filter(
          (control) => control.height < TOUCH_FLOOR_PX - 0.5 || control.width < TOUCH_FLOOR_PX - 0.5
        );
        assert.deepEqual(
          small,
          [],
          `@${viewport.name}: ${small.length} panel control(s) are below the ${TOUCH_FLOOR_PX}px touch floor: ${JSON.stringify(small)}`
        );
      }
      perViewport.painted = { headingTop: painted.headingTop, panel: painted.panel, rows: painted.rows.length };

      /* ---- a value edit is a value-bytes edit ----------------------------- */
      const beforeEdit = await markdown(page);
      assert.equal(beforeEdit, FIXTURE, `@${viewport.name}: mounting the panel changed the document before any edit.`);
      /*
       * Cleared with Backspace rather than a select-all shortcut. Neither Ctrl+A
       * (which is "move to line start" on macOS) nor Meta+A cleared the field
       * under headless Chrome — measured: the typed text was appended to the old
       * value both times. Backspace is unambiguous on every platform and is
       * still a real keystroke through the real input.
       */
      await clickInRow(page, 0, "property-value");
      await clearFocusedInput(page);
      await page.keyboard.type("Edited In The Browser");
      await page.keyboard.press("Tab");
      await settle(page, 240);
      const afterEdit = await markdown(page);
      assert.ok(
        afterEdit.includes("title: Edited In The Browser\n"),
        `@${viewport.name}: the typed title never reached the document.`
      );
      assertDocumentEquals(
        afterEdit,
        FIXTURE.replace("title: Properties Fixture", "title: Edited In The Browser"),
        `@${viewport.name} title edit`
      );
      perViewport.valueEdit = { line: afterEdit.split("\n")[1] };

      /* ---- the type icon rewrites the value, and only the value ---------- */
      await loadFixture(page);
      await clickInRow(page, 1, "property-type-button");
      const menuTypes = await page.evaluate(() =>
        [...document.querySelectorAll('[data-testid="property-type-option"]')].map((node) => node.dataset.propertyType)
      );
      assert.deepEqual(
        menuTypes,
        ["text", "list", "number", "checkbox", "date", "datetime"],
        `@${viewport.name}: the type menu must offer the six benchmark types.`
      );
      await chooseType(page, "text");
      const afterType = await markdown(page);
      assert.ok(
        afterType.includes('priority: "3"\n'),
        `@${viewport.name}: number -> text must quote the value so it stays text; got ${JSON.stringify(afterType.split("\n")[2])}.`
      );
      assertDocumentEquals(afterType, FIXTURE.replace("priority: 3", 'priority: "3"'), `@${viewport.name} type change`);
      perViewport.typeChange = { line: afterType.split("\n")[2], menuTypes };

      /* ---- a complex value refuses, and routes to Source ------------------ */
      await loadFixture(page);
      const beforeComplex = await markdown(page);
      await clickInRow(page, 8, "property-edit-in-source");
      const routed = await page.evaluate(() => ({
        mode: document.querySelector("#app")?.dataset.editorMode ?? null,
        selection: window.__MME_DEMO_VISUAL_CHECK__.editor.state.sliceDoc(
          window.__MME_DEMO_VISUAL_CHECK__.editor.state.selection.main.from,
          window.__MME_DEMO_VISUAL_CHECK__.editor.state.selection.main.to
        )
      }));
      assert.equal(routed.mode, "source", `@${viewport.name}: "Edit in Source" must switch to Source mode.`);
      assert.ok(
        routed.selection.startsWith("summary: |"),
        `@${viewport.name}: Source mode must land on the property that could not be edited; selected ${JSON.stringify(routed.selection.slice(0, 40))}.`
      );
      assert.equal(
        await markdown(page),
        beforeComplex,
        `@${viewport.name}: routing to Source must not change a byte.`
      );
      perViewport.complexRouting = routed;

      /* ---- ⌘;/⌘⌫: add then delete returns the original bytes -------------- */
      await loadFixture(page);
      await clickInRow(page, 0, "property-value");
      await page.keyboard.down("Control");
      await page.keyboard.press("Semicolon");
      await page.keyboard.up("Control");
      await settle(page, 260);
      const afterAdd = await markdown(page);
      assertDocumentEquals(
        afterAdd,
        FIXTURE.replace("anchored: &shared reusable\n---\n", "anchored: &shared reusable\nproperty: \n---\n"),
        `@${viewport.name} Ctrl+; add`
      );
      assert.equal(
        await page.evaluate(() => document.activeElement?.dataset?.testid ?? null),
        "property-key",
        `@${viewport.name}: the new property's name must be focused so it can be typed over — and so the panel-scoped shortcut stays usable.`
      );
      const addedIndex = await page.evaluate(
        () => document.querySelectorAll('[data-testid="property-row"]').length - 1
      );
      await clickInRow(page, addedIndex, "property-key");
      await page.keyboard.down("Control");
      await page.keyboard.press("Backspace");
      await page.keyboard.up("Control");
      await settle(page, 260);
      assert.equal(
        await markdown(page),
        FIXTURE,
        `@${viewport.name}: adding a property and deleting it again must return the document byte for byte.`
      );
      perViewport.shortcuts = { addedIndex, addedLine: "property: " };

      /* ---- the interactions jsdom cannot vouch for -------------------------- */

      /*
       * Checkbox, date, chips, rename and the per-row delete are driven here
       * rather than only in jsdom. The date input especially: a jsdom `change`
       * and a real picker commit are not the same thing, and this gate already
       * caught four defects jsdom missed.
       */
      await loadFixture(page);
      await clickInRow(page, 2, "property-value");
      assertDocumentEquals(
        await markdown(page),
        FIXTURE.replace("published: true", "published: false"),
        `@${viewport.name} checkbox toggle`
      );

      /*
       * The date leg asserts the PANEL's contract, not Chrome's date widget:
       * headless Chrome does not always render `type="date"` as a segmented
       * picker, so pinning a typed string to an ISO result measures the browser
       * rather than this code. What must hold either way is that the committed
       * value reaches that property's bytes and nothing else in the document
       * moves. The value-to-YAML mapping itself is pinned in the unit suite.
       */
      await clickInRow(page, 3, "property-value");
      await clearFocusedInput(page);
      await page.keyboard.type("09012026");
      await page.keyboard.press("Tab");
      await settle(page, 240);
      const afterDate = await markdown(page);
      const committedDateLine = afterDate.split("\n").find((line) => line.startsWith("created:"));
      assert.notEqual(
        committedDateLine,
        "created: 2026-08-14",
        `@${viewport.name}: the date field committed nothing at all.`
      );
      assertDocumentEquals(
        afterDate,
        FIXTURE.replace("published: true", "published: false").replace("created: 2026-08-14", committedDateLine),
        `@${viewport.name} date commit changes that line and nothing else`
      );

      await loadFixture(page);
      await clickInRow(page, 5, "property-chip-input");
      await page.keyboard.type("properties");
      await page.keyboard.press("Enter");
      await settle(page, 260);
      assertDocumentEquals(
        await markdown(page),
        FIXTURE.replace("  - preservation\n", "  - preservation\n  - properties\n"),
        `@${viewport.name} chip append`
      );
      // No reload between the two: the append is still in the document, so
      // removing the first chip must leave exactly the other two.
      await clickAt(page, '[data-property-index="5"] [data-testid="property-chip-remove"]');
      assertDocumentEquals(
        await markdown(page),
        FIXTURE.replace("  - markdown\n  - preservation\n", "  - preservation\n  - properties\n"),
        `@${viewport.name} chip remove`
      );

      await loadFixture(page);
      await clickInRow(page, 0, "property-key");
      await clearFocusedInput(page);
      await page.keyboard.type("headline");
      await page.keyboard.press("Tab");
      await settle(page, 240);
      assertDocumentEquals(
        await markdown(page),
        FIXTURE.replace("title: Properties Fixture", "headline: Properties Fixture"),
        `@${viewport.name} rename`
      );

      /* A refused rename must be visible ON the row, not only in a page notice
       * a thousand pixels away at 390. */
      await clickInRow(page, 0, "property-key");
      await clearFocusedInput(page);
      await page.keyboard.type("priority");
      await page.keyboard.press("Tab");
      await settle(page, 260);
      const refusal = await page.evaluate(() => {
        const row = document.querySelector('[data-property-index="0"]');
        return {
          invalid: row?.querySelector('[data-testid="property-key"]')?.getAttribute("aria-invalid"),
          message: row?.querySelector('[data-testid="property-refusal"]')?.textContent ?? null
        };
      });
      assert.ok(
        refusal.message?.includes("priority"),
        `@${viewport.name}: a duplicate key must be refused visibly on its own row; got ${JSON.stringify(refusal)}.`
      );
      assert.equal(refusal.invalid, "true", `@${viewport.name}: the refused field must be marked invalid.`);
      assertDocumentEquals(
        await markdown(page),
        FIXTURE.replace("title: Properties Fixture", "headline: Properties Fixture"),
        `@${viewport.name} refused rename changes nothing`
      );

      await loadFixture(page);
      await clickInRow(page, 1, "property-remove");
      assertDocumentEquals(await markdown(page), FIXTURE.replace("priority: 3\n", ""), `@${viewport.name} row delete`);

      /* ---- Live Preview, which the criteria name alongside Rich ------------ */
      await loadFixture(page);
      await page.evaluate(() => window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("live-preview"));
      await settle(page, 320);
      const livePreview = await measurePanel(page);
      assert.equal(
        livePreview.visible,
        true,
        `@${viewport.name}: the criteria say Rich AND Live Preview; the panel did not paint in Live Preview.`
      );
      assert.equal(
        livePreview.rows.length,
        EXPECTED_ROWS.length,
        `@${viewport.name}: Live Preview must render the same rows as Rich.`
      );
      await page.evaluate(() => window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("rich"));
      await settle(page, 260);

      /* ---- three display states ------------------------------------------ */
      await clickTestId(page, "properties-display-source");
      const sourceState = await measurePanel(page);
      assert.equal(
        sourceState.sourceText,
        FIXTURE.slice(0, FIXTURE.indexOf("---\n", 4) + 4),
        `@${viewport.name}: the source display must show the block's own bytes.`
      );
      assert.equal(sourceState.rows.length, 0, `@${viewport.name}: the source display must replace the rows.`);
      await clickTestId(page, "properties-display-hidden");
      const hiddenState = await measurePanel(page);
      assert.equal(hiddenState.rows.length, 0, `@${viewport.name}: the hidden display must render no rows.`);
      assert.equal(hiddenState.sourceText, null, `@${viewport.name}: the hidden display must show no YAML.`);
      await clickTestId(page, "properties-display-visible");
      const visibleAgain = await measurePanel(page);
      assert.equal(
        visibleAgain.rows.length,
        EXPECTED_ROWS.length,
        `@${viewport.name}: the writer must be able to get the rows back.`
      );
      assert.equal(await markdown(page), FIXTURE, `@${viewport.name}: switching display states must not touch the file.`);
      perViewport.displayStates = { hiddenRows: hiddenState.rows.length, sourceRows: sourceState.rows.length };

      /* ---- `---` at the start of a document with no frontmatter ----------- */
      /*
       * The first block is a paragraph, because the rule carries the same
       * `requiresParagraph` restriction as the built-in `horizontalRule` rule it
       * shares a trigger with. Typing `---` into a heading has never produced a
       * horizontal rule either, and this issue does not change that.
       */
      await loadFixture(page, "Plain body first.\n\nNo YAML block here.\n");
      assert.equal(
        await page.evaluate(() => document.querySelector('[data-testid="properties-surface"]')?.hidden ?? null),
        true,
        `@${viewport.name}: a document with no frontmatter must show no panel.`
      );
      /*
       * The caret is placed by selecting the paragraph and collapsing left, not
       * by writing a DOM Range: ProseMirror discarded the hand-built range (the
       * three dashes went nowhere and the document never changed), which would
       * have made this assertion fail for a reason that has nothing to do with
       * the rule under test.
       */
      await page.evaluate(() => window.__MME_DEMO_VISUAL_CHECK__.selectRichTextForTest("Plain body first."));
      await settle(page, 200);
      await page.keyboard.press("ArrowLeft");
      await settle(page, 160);
      await page.keyboard.type("---");
      await settle(page, 320);
      const created = await markdown(page);
      assert.equal(
        created,
        "---\ntitle: \n---\n\nPlain body first.\n\nNo YAML block here.\n",
        `@${viewport.name}: typing --- at the start of the file must create the Properties block; got ${JSON.stringify(created)}.`
      );
      const createdPanel = await measurePanel(page);
      assert.equal(createdPanel.visible, true, `@${viewport.name}: the panel must appear once the block exists.`);
      assert.deepEqual(
        createdPanel.rows.map((row) => row.key),
        ["title"],
        `@${viewport.name}: the created block is the documented minimal block.`
      );
      /*
       * A body edit AFTER the block was created through the input rule. This is
       * the path the rebase exists for: without it the serializer would splice
       * the body from offsets that predate the new block.
       */
      await page.evaluate(() => window.__MME_DEMO_VISUAL_CHECK__.selectRichTextForTest("No YAML block here."));
      await settle(page, 200);
      await page.keyboard.type("Body edited after the block was created.");
      await settle(page, 320);
      assertDocumentEquals(
        await markdown(page),
        "---\ntitle: \n---\n\nPlain body first.\n\nBody edited after the block was created.\n",
        `@${viewport.name} body edit after block creation`
      );
      perViewport.blockCreation = { markdown: created };

      /* ---- screenshots, both schemes -------------------------------------- */
      await loadFixture(page);
      for (const scheme of SCHEMES) {
        await setScheme(page, scheme);
        await settle(page, 200);
        await page.screenshot({ path: `${visualDir}/properties-${scheme}-${viewport.name}.png`, type: "png" });
        await clickInRow(page, 0, "property-type-button");
        await page.screenshot({ path: `${visualDir}/type-menu-${scheme}-${viewport.name}.png`, type: "png" });
        await page.keyboard.press("Escape");
        await settle(page, 160);
        await clickTestId(page, "properties-display-source");
        await page.screenshot({ path: `${visualDir}/properties-source-${scheme}-${viewport.name}.png`, type: "png" });
        await clickTestId(page, "properties-display-visible");
      }

      assert.deepEqual(consoleErrors, [], `@${viewport.name}: the page threw: ${JSON.stringify(consoleErrors)}`);
      evidence[viewport.name] = perViewport;
      await page.close();
    }

    await writeFile(
      `${visualDir}/measurements.json`,
      `${JSON.stringify({ demoUrl, evidence, schemes: SCHEMES, status: "passed" }, null, 2)}\n`
    );
    console.log("visual-check-mme0090: the Properties panel paints above the title and every interaction is byte-exact.");
  } finally {
    await browser.close();
  }
}

await main();
