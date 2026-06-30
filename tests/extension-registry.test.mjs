import {
  createExtensionRegistry,
  createMarkdownEditorSession
} from "../packages/md-editor/dist/index.js";
import { readFileSync } from "node:fs";
import { roundTripMarkdown } from "../packages/md-format/dist/index.js";
import { createMemorySaveTarget } from "../packages/md-save/dist/index.js";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
assert(
  packageJson.scripts["visual:mme-0027"] === "node scripts/visual-check-mme0027.mjs",
  "MME-0027 visual script must be registered."
);

for (const exportName of ["createExtensionRegistry"]) {
  if (!(exportName in await import("../packages/md-editor/dist/index.js"))) {
    throw new Error(`Missing md-editor extension registry export: ${exportName}`);
  }
}

const session = createMarkdownEditorSession({
  content: "# Extensions\n",
  scheduler: createManualScheduler(),
  target: createMemorySaveTarget({
    initialContent: "# Extensions\n"
  })
});

if (!session.extensions) {
  throw new Error("MarkdownEditorSession must expose a headless extension registry.");
}

const registry = createExtensionRegistry();

registry.registerToolbarItem({
  group: "marks",
  icon: "bold",
  id: "mme:bold",
  labelKey: "commands.bold",
  run() {
    return {
      handled: true
    };
  }
});

registry.registerSlashItem({
  aliases: ["card", "callout-card"],
  group: "insert",
  id: "host:callout-card",
  labelKey: "extensions.calloutCard",
  run(context) {
    context.session.setContent(`${context.session.getContent()}\n:::host:callout-card\nTitle\n:::\n`, "host");
    return {
      handled: true
    };
  }
});

registry.registerKeybinding({
  commandId: "mme:bold",
  id: "host:bold-shortcut",
  keys: ["Mod-b"]
});

registry.registerAiAction({
  buildPrompt(params) {
    return `Translate to ${params.language} with ${params.tone} tone.`;
  },
  demoAction: "rewrite",
  entryPoints: ["slash", "command-palette"],
  id: "host:translate-selection",
  labelKey: "extensions.translateSelection",
  params: [
    {
      labelKey: "extensions.language",
      name: "language",
      type: "text"
    },
    {
      labelKey: "extensions.tone",
      name: "tone",
      type: "enum",
      values: ["plain", "formal"]
    }
  ]
});

registry.registerCustomBlock({
  id: "host:callout-card-block",
  persistence: "fenced-directive",
  serialize(data) {
    return `:::host:callout-card-block\n${data.title}\n:::\n`;
  }
});

const slashMatches = registry.searchSlashItems("card");
assert(slashMatches.map((item) => item.id).includes("host:callout-card"), "host slash item must be searchable.");

const toolbarItems = registry.getToolbarItems();
assert(toolbarItems.some((item) => item.id === "mme:bold"), "built-in toolbar item must use the public registry.");

const keybindings = registry.getKeybindings({
  keymapDelegateToHost: false
});
assert(keybindings.some((binding) => binding.commandId === "mme:bold"), "keybinding must be visible when host does not delegate.");
assert(
  registry.getKeybindings({
    keymapDelegateToHost: true
  }).length === 0,
  "keybindings must not be active when MME-0026 delegateToHost is enabled."
);

const aiPrompt = registry.buildAiActionPrompt("host:translate-selection", {
  language: "French",
  tone: "formal"
});
assert(aiPrompt.handled === true, "AI action prompt must resolve when params are valid.");
assert(aiPrompt.prompt === "Translate to French with formal tone.", "AI prompt must be built from parameter schema.");

const invalidAiPrompt = registry.buildAiActionPrompt("host:translate-selection", {
  language: "French",
  tone: "casual"
});
assert(invalidAiPrompt.handled === false, "invalid AI params must fail safely.");
assert(invalidAiPrompt.diagnostic?.code === "invalid-params", "invalid AI params must report structured diagnostic.");

const customBlock = registry.serializeCustomBlock("host:callout-card-block", {
  title: "Ship registry"
});
assert(customBlock.handled === true, "custom block serialization must be handled.");
assert(customBlock.content === ":::host:callout-card-block\nShip registry\n:::\n", "custom block serialization must be exact.");
const customBlockRoundTrip = roundTripMarkdown(customBlock.content);
assert(customBlockRoundTrip.status === "pass", "custom block fenced directive must round-trip through opaque fidelity.");

const dispatchResult = await registry.dispatchSlashItem("host:callout-card", {
  session
});
assert(dispatchResult.handled === true, "registered slash item must dispatch.");
assert(session.getContent().includes(":::host:callout-card"), "slash item must receive the session context.");

const unknownResult = await registry.dispatchSlashItem("host:missing", {
  session
});
assert(unknownResult.handled === false, "unknown slash item must fail safely.");
assert(unknownResult.diagnostic?.code === "unknown-id", "unknown slash item must report structured diagnostic.");

registry.disableExtension("host:callout-card", "Workspace disabled this extension.");
const disabledResult = await registry.dispatchSlashItem("host:callout-card", {
  session
});
assert(disabledResult.handled === false, "disabled slash item must fail safely.");
assert(disabledResult.diagnostic?.code === "disabled", "disabled slash item must report structured diagnostic.");

assertThrows(
  () =>
    registry.registerToolbarItem({
      group: "marks",
      icon: "bold",
      id: "mme:bold",
      labelKey: "commands.boldDuplicate",
      run() {
        return {
          handled: true
        };
      }
    }),
  "duplicate ids must fail fast"
);

assertThrows(
  () =>
    registry.registerToolbarItem({
      group: "marks",
      icon: "bold",
      id: "bold",
      labelKey: "commands.badId",
      run() {
        return {
          handled: true
        };
      }
    }),
  "ids must be namespaced"
);

const demoMain = readFileSync("apps/md-demo/src/main.ts", "utf8");
for (const snippet of [
  "registerReferenceExtensions(nextSession)",
  "editorSession.extensions.registerSlashItem",
  "editorSession.extensions.registerToolbarItem",
  "editorSession.extensions.registerAiAction",
  "editorSession.extensions.registerCustomBlock",
  "richCommandExtensionId(command.id)",
  "id: \"host:callout-card\"",
  "id: \"host:translate-selection\"",
  "hostCalloutCardBlockDefinition",
  "referenceAiActionsForRegisteredEntryPoint",
  "renderExtensionToolbarItems",
  "consumeActiveSlashQuery",
  "dispatchSlashItem",
  "dispatchToolbarItem"
]) {
  assert(demoMain.includes(snippet), `Demo host integration missing registry snippet: ${snippet}`);
}
const dispatchSlashItemFunction = extractFunction(demoMain, "async function dispatchSlashItem");
assert(
  dispatchSlashItemFunction.includes("consumeActiveSlashQuery()"),
  "Host slash dispatch must consume the typed /query range before running extension code."
);
const slashKeyboardFunction = extractFunction(demoMain, "function handleSlashMenuKeyboard");
assert(
  slashKeyboardFunction.includes("consumeActiveSlashQuery()"),
  "Slash AI dispatch must consume the typed /query range before opening an AI action."
);
const renderExtensionToolbarItemsFunction = extractFunction(demoMain, "function renderExtensionToolbarItems");
assert(
  renderExtensionToolbarItemsFunction.includes('button.setAttribute("aria-label", label)') &&
    renderExtensionToolbarItemsFunction.includes("button.title = label"),
  "Host toolbar items must keep tooltip/accessibility labels when rendered as compact icon buttons."
);
assert(
  !renderExtensionToolbarItemsFunction.includes("<span>${extensionLabel(item.labelKey)}</span>"),
  "Host toolbar items must not render visible text labels in the primary toolbar."
);

const visualScript = readFileSync("scripts/visual-check-mme0027.mjs", "utf8");
for (const artifact of [
  "extension-toolbar-host.png",
  "extension-custom-block-inserted.png",
  "extension-slash-host.png",
  "extension-slash-host-inserted.png",
  "rich-code-block-exit.png",
  "extension-ai-command-palette.png",
  "extension-ai-host-prompt.png"
]) {
  assert(visualScript.includes(artifact), `MME-0027 visual script missing artifact: ${artifact}`);
}

const visualReadme = readFileSync("docs/internal/visual-checks/MME-0027/README.md", "utf8");
assert(visualReadme.includes("visual:mme-0027"), "MME-0027 visual README must document the visual command.");

session.destroy();

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertThrows(fn, message) {
  try {
    fn();
  } catch {
    return;
  }
  throw new Error(message);
}

function extractFunction(source, signature) {
  const start = source.indexOf(signature);
  if (start < 0) {
    throw new Error(`Missing function signature: ${signature}`);
  }
  const bodyStart = source.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }
  throw new Error(`Could not extract function: ${signature}`);
}

function createManualScheduler() {
  return {
    schedule() {
      return () => {};
    }
  };
}
