import { existsSync, readFileSync } from "node:fs";

const packageJsonPath = "packages/md-adapter-theia/package.json";
const sourcePath = "packages/md-adapter-theia/src/index.ts";
const frontendModulePath = "packages/md-adapter-theia/src/browser/theia-markdown-frontend-module.ts";
const frontendModuleDistPath = "packages/md-adapter-theia/dist/browser/theia-markdown-frontend-module.js";
const readmePath = "packages/md-adapter-theia/README.md";
const demoPackagePath = "apps/theia-demo/package.json";
const demoEsbuildPath = "apps/theia-demo/esbuild.mjs";
const demoFrontendModulePath = "apps/theia-demo/src/browser/momentarise-demo-frontend-module.js";
const visualReadmePath = "docs/internal/visual-checks/MME-0034/README.md";
const visualScriptPath = "scripts/visual-check-mme0034.mjs";

assert(existsSync(packageJsonPath), "MME-0034 must create @momentarise/md-adapter-theia package metadata.");
assert(existsSync(sourcePath), "MME-0034 must create @momentarise/md-adapter-theia source entrypoint.");
assert(existsSync(frontendModulePath), "MME-0034 must create a Theia frontend module.");
assert(existsSync(readmePath), "MME-0034 must document the Theia adapter alpha.");
assert(existsSync(demoPackagePath), "MME-0034 must create a Theia demo app manifest.");
assert(existsSync(demoEsbuildPath), "MME-0034 must keep a Theia demo build customization.");
assert(existsSync(demoFrontendModulePath), "MME-0034 must keep a Theia demo frontend module.");
assert(existsSync(visualReadmePath), "MME-0034 must document visual-check artifacts.");
assert(existsSync(visualScriptPath), "MME-0034 must provide a visual check script.");

const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
assert(packageJson.name === "@momentarise/md-adapter-theia", "Theia adapter package must use the public package name.");
assert(
  packageJson.theiaExtensions?.some((extension) => extension.frontend === "dist/browser/theia-markdown-frontend-module"),
  "Theia adapter package must expose a frontend module for Theia discovery."
);
assert(
  packageJson.exports?.["./dist/browser/theia-markdown-frontend-module"],
  "Theia adapter package must export its frontend module subpath."
);
for (const dependency of [
  "@momentarise/md-editor",
  "@momentarise/md-save",
  "@momentarise/md-source-codemirror",
  "@momentarise/md-surface",
  "@momentarise/md-theme"
]) {
  assert(packageJson.dependencies?.[dependency], `Theia adapter must depend on ${dependency}.`);
}
for (const dependency of ["@theia/core", "@theia/filesystem"]) {
  assert(packageJson.peerDependencies?.[dependency], `Theia adapter must peer-depend on ${dependency}.`);
  assert(packageJson.devDependencies?.[dependency], `Theia adapter must keep ${dependency} as a dev dependency for local builds.`);
}

const source = readFileSync(sourcePath, "utf8");
for (const snippet of [
  "theiaMarkdownAdapterPackage",
  "createTheiaFileSaveTarget",
  "createTheiaMarkdownEditorMount",
  "TheiaMarkdownEditorWidget",
  "TheiaMarkdownOpenHandler",
  "THEIA_MARKDOWN_OPEN_PRIORITY",
  "registerTheiaMarkdownKeybindings",
  "createMarkdownEditorSession",
  "createMomentariseSourceView",
  "createDocumentStatus",
  "createModeControl",
  "createFindReplaceSurface",
  "keymapDelegateToHost",
  "\"keymap.delegateToHost\": true"
]) {
  assert(source.includes(snippet), `Theia adapter source must include ${snippet}.`);
}
for (const forbidden of [
  "apps/md-demo",
  "queryRequired",
  "__MME_DEMO_VISUAL_CHECK__",
  "renderEditorMode",
  "mountReferenceSurfaceComponents"
]) {
  assert(!source.includes(forbidden), `Theia adapter must not copy demo orchestration: ${forbidden}`);
}
const frontendModule = readFileSync(frontendModulePath, "utf8");
for (const snippet of [
  "THEIA_MARKDOWN_WIDGET_FACTORY_ID",
  "TheiaMarkdownEditorWidgetFactory",
  "TheiaMarkdownRegisteredOpenHandler",
  "TheiaMarkdownCommandContribution",
  "TheiaMarkdownKeybindingContribution",
  "ContextKeyService",
  "WidgetFactory",
  "OpenHandler",
  "PreferenceService",
  "KeybindingContribution",
  "FileService",
  "openFind",
  "registerTheiaMarkdownKeybindings"
]) {
  assert(frontendModule.includes(snippet), `Theia frontend module must include ${snippet}.`);
}
for (const forbidden of ["apps/md-demo", "__MME_DEMO_VISUAL_CHECK__", "mountReferenceSurfaceComponents"]) {
  assert(!frontendModule.includes(forbidden), `Theia frontend module must not copy demo orchestration: ${forbidden}`);
}

const rootTsconfig = JSON.parse(readFileSync("tsconfig.json", "utf8"));
assert(
  rootTsconfig.references.some((reference) => reference.path === "packages/md-adapter-theia"),
  "Root tsconfig must include packages/md-adapter-theia."
);

const rootPackage = JSON.parse(readFileSync("package.json", "utf8"));
assert(rootPackage.scripts?.["test:theia-adapter"], "Root package must expose test:theia-adapter.");
assert(rootPackage.scripts?.build?.includes("packages/md-adapter-theia"), "Root build must include md-adapter-theia.");
assert(rootPackage.scripts?.test?.includes("test:theia-adapter"), "Root test gate must include test:theia-adapter.");
assert(rootPackage.scripts?.["visual:mme-0034"] === "node scripts/visual-check-mme0034.mjs", "Root package must expose visual:mme-0034.");

const demoPackage = JSON.parse(readFileSync(demoPackagePath, "utf8"));
for (const dependency of [
  "@momentarise/md-adapter-theia",
  "@theia/core",
  "@theia/editor",
  "@theia/filesystem",
  "@theia/markers",
  "@theia/messages",
  "@theia/monaco",
  "@theia/navigator",
  "@theia/preferences",
  "@theia/workspace"
]) {
  assert(demoPackage.dependencies?.[dependency], `Theia demo app must depend on ${dependency}.`);
}
assert(demoPackage.scripts?.build, "Theia demo app must expose a build script.");
assert(demoPackage.scripts?.start, "Theia demo app must expose a start script.");
const demoEsbuild = readFileSync(demoEsbuildPath, "utf8");
for (const snippet of [
  "momentarise-theia-core-singleton",
  "@theia/core/package.json",
  "browserOptions.plugins",
  "wireMomentariseDemoFrontendModule",
  "momentarise-demo-frontend-module"
]) {
  assert(demoEsbuild.includes(snippet), `Theia demo build must preserve ${snippet}.`);
}
const demoFrontendModule = readFileSync(demoFrontendModulePath, "utf8");
for (const snippet of ["MomentariseDemoLayoutRestorer", "ShellLayoutRestorer", "restoreLayout()", "openMarkdownResource", "openFind"]) {
  assert(demoFrontendModule.includes(snippet), `Theia demo frontend module must preserve ${snippet}.`);
}

const readme = readFileSync(readmePath, "utf8");
for (const snippet of [
  "FileService",
  "SaveTarget",
  "KeybindingRegistry",
  "PreferenceService",
  "delegateToHost",
  "source mode"
]) {
  assert(readme.includes(snippet), `Theia adapter README must document ${snippet}.`);
}

const visualReadme = readFileSync(visualReadmePath, "utf8");
assert(visualReadme.includes("theia-shell-loaded.png"), "MME-0034 visual README must name the shell screenshot.");
assert(visualReadme.includes("theia-markdown-open-find.png"), "MME-0034 visual README must name the open/find screenshot.");
const visualScript = readFileSync(visualScriptPath, "utf8");
for (const snippet of [
  "MME_THEIA_DEMO_URL",
  "theia-shell-loaded.png",
  "theia-markdown-open-find.png",
  "openMarkdownResource",
  "openFind",
  "Theia Markdown source editor"
]) {
  assert(visualScript.includes(snippet), `MME-0034 visual script must include ${snippet}.`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const theiaAdapter = await import("../packages/md-adapter-theia/dist/index.js");
assert(
  theiaAdapter.theiaMarkdownAdapterPackage?.packageName === "@momentarise/md-adapter-theia",
  "Theia adapter package contract must be exported."
);
assert(typeof theiaAdapter.createTheiaFileSaveTarget === "function", "Theia adapter must export createTheiaFileSaveTarget.");
assert(typeof theiaAdapter.createTheiaMarkdownEditorMount === "function", "Theia adapter must export createTheiaMarkdownEditorMount.");
const frontendModuleDist = readFileSync(frontendModuleDistPath, "utf8");
for (const snippet of [
  "THEIA_MARKDOWN_WIDGET_FACTORY_ID",
  "TheiaMarkdownRegisteredOpenHandler",
  "TheiaMarkdownKeybindingContribution",
  "THEIA_MARKDOWN_OPEN_PRIORITY",
  "ContextKeyService",
  "PreferenceService",
  "openFind",
  "momentarise.markdown.editor"
]) {
  assert(frontendModuleDist.includes(snippet), `Theia frontend module dist must include ${snippet}.`);
}
const preferenceInput = theiaAdapter.createTheiaPreferenceInput({
  preferenceService: {
    get(name, fallback) {
      if (name === "momentariseMarkdown.layout.density") {
        return "compact";
      }
      if (name === "momentariseMarkdown.source.lineWrapping") {
        return false;
      }
      return fallback;
    }
  }
});
assert(preferenceInput["layout.density"] === "compact", "Theia PreferenceService must feed layout density.");
assert(preferenceInput["source.lineWrapping"] === false, "Theia PreferenceService must feed source line wrapping.");

let diskContent = "Initial\n";
const resource = {
  path: {
    base: "note.md",
    ext: ".md"
  },
  toString() {
    return "file:///workspace/note.md";
  }
};
const fileService = {
  async readFile(uri) {
    assert(uri === resource, "Theia save target must read the requested resource.");
    return {
      value: {
        toString() {
          return diskContent;
        }
      }
    };
  },
  async writeFile(uri, content) {
    assert(uri === resource, "Theia save target must write the requested resource.");
    diskContent = content.toString();
  }
};
const target = theiaAdapter.createTheiaFileSaveTarget({
  fileService,
  resource
});
const initialHash = await target.readExternalHash();
const saved = await target.write({
  content: "Updated\n",
  contentHash: theiaAdapter.hashMarkdownContent?.("Updated\n") ?? "updated-hash",
  now: new Date("2026-07-01T00:00:00Z"),
  previousSavedHash: initialHash,
  reason: "manual"
});
assert(saved.status === "saved", `Theia save target must save when hashes match: ${JSON.stringify(saved)}`);
assert(diskContent === "Updated\n", "Theia save target must write Markdown content to FileService.");

diskContent = "External edit\n";
const conflict = await target.write({
  content: "Local edit\n",
  contentHash: "local-hash",
  now: new Date("2026-07-01T00:00:01Z"),
  previousSavedHash: initialHash,
  reason: "manual"
});
assert(conflict.status === "conflict", `Theia save target must report conflict before overwrite: ${JSON.stringify(conflict)}`);
