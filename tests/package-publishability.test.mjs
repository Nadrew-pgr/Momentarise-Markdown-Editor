import { readFile } from "node:fs/promises";

const rootPackage = await readJson("package.json");
const packages = [
  "@momentarise/md-adapter-web",
  "@momentarise/md-ai",
  "@momentarise/md-cli",
  "@momentarise/md-core",
  "@momentarise/md-editor",
  "@momentarise/md-format",
  "@momentarise/md-policy",
  "@momentarise/md-preview-html",
  "@momentarise/md-rich-prosemirror",
  "@momentarise/md-save",
  "@momentarise/md-source-codemirror"
];

const packagePaths = Object.fromEntries(
  packages.map((packageName) => [packageName, `packages/${packageName.replace("@momentarise/", "")}/package.json`])
);
const manifests = {};
for (const [packageName, path] of Object.entries(packagePaths)) {
  manifests[packageName] = await readJson(path);
}

for (const packageName of packages) {
  const manifest = manifests[packageName];
  assert(manifest.repository, `${packageName} must declare repository metadata before publishability.`);
  assert(manifest.engines?.node === ">=20", `${packageName} must declare engines.node >=20.`);
  assert(Array.isArray(manifest.keywords) && manifest.keywords.length > 0, `${packageName} must declare keywords.`);
  assert(manifest.files?.includes("dist"), `${packageName} must publish dist only for now.`);
}

assertScript("test:consumer-smoke");

const codeMirrorPeers = [
  "@codemirror/autocomplete",
  "@codemirror/commands",
  "@codemirror/lang-markdown",
  "@codemirror/language",
  "@codemirror/search",
  "@codemirror/state",
  "@codemirror/view",
  "codemirror"
];
const sourceManifest = manifests["@momentarise/md-source-codemirror"];
for (const dependency of codeMirrorPeers) {
  assert(
    sourceManifest.peerDependencies?.[dependency],
    `@momentarise/md-source-codemirror must expose ${dependency} as a peer dependency.`
  );
  assert(
    sourceManifest.devDependencies?.[dependency],
    `@momentarise/md-source-codemirror must keep ${dependency} as a dev dependency for local builds.`
  );
  assert(
    !sourceManifest.dependencies?.[dependency],
    `@momentarise/md-source-codemirror must not bundle ${dependency} as a dependency.`
  );
}

const prosemirrorPeers = [
  "prosemirror-commands",
  "prosemirror-history",
  "prosemirror-keymap",
  "prosemirror-model",
  "prosemirror-state",
  "prosemirror-transform"
];
const richManifest = manifests["@momentarise/md-rich-prosemirror"];
for (const dependency of prosemirrorPeers) {
  assert(
    richManifest.peerDependencies?.[dependency],
    `@momentarise/md-rich-prosemirror must expose ${dependency} as a peer dependency.`
  );
  assert(
    richManifest.devDependencies?.[dependency],
    `@momentarise/md-rich-prosemirror must keep ${dependency} as a dev dependency for local builds.`
  );
  assert(
    !richManifest.dependencies?.[dependency],
    `@momentarise/md-rich-prosemirror must not bundle ${dependency} as a dependency.`
  );
}
assert(
  !richManifest.peerDependencies?.["prosemirror-view"],
  "@momentarise/md-rich-prosemirror does not import prosemirror-view; the demo/host owns the view dependency."
);

const demoManifest = await readJson("apps/md-demo/package.json");
for (const dependency of [
  "@codemirror/state",
  "@codemirror/view",
  "prosemirror-state",
  "prosemirror-view"
]) {
  assert(
    demoManifest.dependencies?.[dependency],
    `@momentarise/md-demo constructs editor views and must keep direct ${dependency} dependency.`
  );
}

const core = await import("../packages/md-core/dist/index.js");
const save = await import("../packages/md-save/dist/index.js");
const format = await import("../packages/md-format/dist/index.js");
assert(typeof core.hashMarkdownContent === "function", "md-core must export the shared hashMarkdownContent.");
assert(
  save.hashMarkdownContent === core.hashMarkdownContent,
  "md-save must re-export the shared md-core hashMarkdownContent function."
);
assert(
  core.hashMarkdownContent("same content") === save.hashMarkdownContent("same content"),
  "shared hash implementation must produce the same hash through core and save exports."
);

assert(
  typeof format.serializeMomentariseDocument === "function",
  "md-format must expose serializeMomentariseDocument for model-level Markdown generation."
);
const parseResult = format.createMarkdownAstParser().parse("# Title\n\nParagraph with **bold** text.\n", {
  dialect: "momentarise-enhanced"
});
const serialized = format.serializeMomentariseDocument(parseResult);
assert(serialized.content.includes("# Title"), "model serializer must emit headings.");
assert(serialized.content.includes("Paragraph with **bold** text."), "model serializer must emit inline formatting.");
assert(serialized.hash === core.hashMarkdownContent(serialized.content), "model serializer must use the shared hash.");

function assertScript(name) {
  assert(rootPackage.scripts?.[name], `root package.json must expose ${name}.`);
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
