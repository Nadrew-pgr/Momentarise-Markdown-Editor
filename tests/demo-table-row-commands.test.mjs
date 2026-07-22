import { readFileSync } from "node:fs";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
if (packageJson.scripts["test:demo-table-row-commands"] !== "node tests/demo-table-row-commands.test.mjs") {
  throw new Error("Missing test:demo-table-row-commands script.");
}
if (!packageJson.scripts.test.includes("test:demo-table-row-commands")) {
  throw new Error("Root npm test must include demo table-row command checks.");
}

const main = readFileSync("apps/md-demo/src/main.ts", "utf8");
for (const snippet of [
  "canRunRichMarkdownCommand",
  "TABLE_ROW_COMMAND_IDS",
  "unavailableTableRowCommandIds",
  "filterAvailableRichSlashItems",
  "tableRowBefore",
  "tableRowAfter",
  "tableRowDelete"
]) {
  if (!main.includes(snippet)) {
    throw new Error(`Demo missing MME-0072 table-row command wiring: ${snippet}`);
  }
}

const surface = readFileSync("packages/md-surface/src/index.ts", "utf8");
for (const snippet of [
  'button.setAttribute("aria-label", label)',
  "state.disabledReasons?.[command.id]",
  "item.disabled = disabled",
  'button.setAttribute("role", "option")',
  'id: "mme:tableRowBefore"',
  'id: "mme:tableRowAfter"',
  'id: "mme:tableRowDelete"',
  'tableRowBefore: "Insert row before"',
  'tableRowAfter: "Insert row after"',
  'tableRowDelete: "Delete row"'
]) {
  if (!surface.includes(snippet)) {
    throw new Error(`Surface package missing accessible/unavailable command behavior: ${snippet}`);
  }
}
