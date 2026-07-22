import { readFileSync } from "node:fs";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
if (packageJson.scripts["test:demo-table-column-commands"] !== "node tests/demo-table-column-commands.test.mjs") {
  throw new Error("Missing test:demo-table-column-commands script.");
}
if (!packageJson.scripts.test.includes("test:demo-table-column-commands")) {
  throw new Error("Root npm test must include demo table-column command checks.");
}

const main = readFileSync("apps/md-demo/src/main.ts", "utf8");
for (const snippet of [
  "TABLE_COLUMN_COMMAND_IDS",
  "unavailableTableColumnCommandIds",
  "tableColumnBefore",
  "tableColumnAfter",
  "tableColumnDelete"
]) {
  if (!main.includes(snippet)) {
    throw new Error(`Demo missing MME-0073 table-column command wiring: ${snippet}`);
  }
}

const surface = readFileSync("packages/md-surface/src/index.ts", "utf8");
for (const snippet of [
  'id: "mme:tableColumnBefore"',
  'id: "mme:tableColumnAfter"',
  'id: "mme:tableColumnDelete"',
  'tableColumnBefore: "Insert column before"',
  'tableColumnAfter: "Insert column after"',
  'tableColumnDelete: "Delete column"'
]) {
  if (!surface.includes(snippet)) {
    throw new Error(`Surface package missing MME-0073 column action: ${snippet}`);
  }
}
