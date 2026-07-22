import { readFileSync } from "node:fs";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
if (packageJson.scripts["test:demo-table-reorder-commands"] !== "node tests/demo-table-reorder-commands.test.mjs") {
  throw new Error("Missing test:demo-table-reorder-commands script.");
}
if (!packageJson.scripts.test.includes("test:demo-table-reorder-commands")) {
  throw new Error("Root npm test must include demo table-reorder command checks.");
}

const main = readFileSync("apps/md-demo/src/main.ts", "utf8");
for (const snippet of [
  "TABLE_REORDER_COMMAND_IDS",
  "unavailableTableReorderCommandIds",
  "tableRowUp",
  "tableRowDown",
  "tableColumnLeft",
  "tableColumnRight"
]) {
  if (!main.includes(snippet)) {
    throw new Error(`Demo missing MME-0074 table-reorder command wiring: ${snippet}`);
  }
}

const surface = readFileSync("packages/md-surface/src/index.ts", "utf8");
for (const snippet of [
  'id: "mme:tableRowUp"',
  'id: "mme:tableRowDown"',
  'id: "mme:tableColumnLeft"',
  'id: "mme:tableColumnRight"',
  'tableRowUp: "Move row up"',
  'tableRowDown: "Move row down"',
  'tableColumnLeft: "Move column left"',
  'tableColumnRight: "Move column right"'
]) {
  if (!surface.includes(snippet)) {
    throw new Error(`Surface package missing MME-0074 reorder action: ${snippet}`);
  }
}
