import { readFile } from "node:fs/promises";

const packageNames = [
  "@momentarise/md-adapter-theia",
  "@momentarise/md-adapter-web",
  "@momentarise/md-ai",
  "@momentarise/md-cli",
  "@momentarise/md-core",
  "@momentarise/md-editor",
  "@momentarise/md-format",
  "@momentarise/md-policy",
  "@momentarise/md-preview-html",
  "@momentarise/md-react",
  "@momentarise/md-render-html",
  "@momentarise/md-rich-prosemirror",
  "@momentarise/md-save",
  "@momentarise/md-source-codemirror",
  "@momentarise/md-surface",
  "@momentarise/md-theme"
];

const approved = JSON.parse(await readFile("tests/fixtures/public-api-approved.json", "utf8"));

for (const packageName of packageNames) {
  const packageDir = packageName.replace("@momentarise/", "");
  const module = await import(`../packages/${packageDir}/dist/index.js`);
  const actual = Object.keys(module).sort();
  const expected = approved[packageName];
  if (!Array.isArray(expected)) {
    throw new Error(`Missing approved public API fixture for ${packageName}.`);
  }
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      [
        `Public API drift for ${packageName}.`,
        `Expected: ${JSON.stringify(expected)}`,
        `Actual:   ${JSON.stringify(actual)}`,
        "Update tests/fixtures/public-api-approved.json only after documenting the export as intentional."
      ].join("\n")
    );
  }
}
