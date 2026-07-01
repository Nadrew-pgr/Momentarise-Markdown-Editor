import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { createMarkdownEditorSession } from "../packages/md-editor/dist/index.js";
import { createMemorySaveTarget } from "../packages/md-save/dist/index.js";

const surface = await import("../packages/md-surface/dist/index.js");

for (const exportName of ["createFindReplaceSurface"]) {
  if (typeof surface[exportName] !== "function") {
    throw new Error(`@momentarise/md-surface must export ${exportName}.`);
  }
}

const dom = new JSDOM("<!doctype html><html><body></body></html>");
const document = dom.window.document;
const host = document.createElement("div");
const session = createMarkdownEditorSession({
  content: "# Find\n\nFind text here.\n",
  scheduler: {
    schedule() {
      return () => {};
    }
  },
  target: createMemorySaveTarget({
    initialContent: "# Find\n\nFind text here.\n"
  })
});
const actions = [];
const component = surface.createFindReplaceSurface({
  host,
  icons: {
    render(name) {
      return `<span data-icon="${name}" aria-hidden="true"></span>`;
    }
  },
  onFind(query) {
    actions.push(`find:${query}`);
  },
  onFindNext() {
    actions.push("next");
  },
  onFindPrevious() {
    actions.push("previous");
  },
  onReplace(replacement) {
    actions.push(`replace:${replacement}`);
  },
  onReplaceAll(replacement) {
    actions.push(`replaceAll:${replacement}`);
  },
  preferences: {
    aiEntryPoints: []
  },
  session,
  state: {
    activeIndex: 0,
    matches: [{ from: 2, to: 6 }],
    open: true,
    query: "Find",
    replacement: "Search"
  },
  strings: surface.defaultMmeStrings
});

component.update();
const root = query(host, '[data-testid="find-replace-surface"]');
assertEqual(root.getAttribute("role"), "search", "find surface must render as a labelled search region.");
assertEqual(query(host, '[data-testid="find-query-input"]').getAttribute("aria-label"), surface.defaultMmeStrings.find.queryLabel, "find input must use i18n labels.");
assertEqual(query(host, '[data-testid="find-match-count"]').textContent, "1 / 1", "find surface must show match count.");
query(host, '[data-testid="find-query-input"]').dispatchEvent(new dom.window.InputEvent("input", { bubbles: true, data: "x" }));
query(host, '[data-testid="find-next-button"]').click();
query(host, '[data-testid="find-replace-all-button"]').click();
assert(actions.includes("next"), "find next button must dispatch.");
assert(actions.includes("replaceAll:Search"), "replace-all button must dispatch current replacement.");

const surfaceSource = readFileSync("packages/md-surface/src/index.ts", "utf8");
for (const forbidden of ["window.", "document.querySelector", "localStorage", "react"]) {
  if (surfaceSource.includes(forbidden)) {
    throw new Error(`md-surface find UI must stay host-independent: ${forbidden}`);
  }
}

component.destroy();
session.destroy();

function query(root, selector) {
  const element = root.querySelector(selector);
  if (!element) {
    throw new Error(`Missing selector ${selector}`);
  }
  return element;
}

function assert(value, label) {
  if (!value) {
    throw new Error(label);
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`);
  }
}
