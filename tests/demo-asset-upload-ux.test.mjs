import { existsSync, readFileSync } from "node:fs";

for (const file of [
  "apps/md-demo/src/main.ts",
  "packages/md-surface/src/index.ts",
  "tests/asset-upload-provider.test.mjs",
  "scripts/visual-check-mme0054.mjs"
]) {
  if (!existsSync(file)) {
    throw new Error(`Missing MME-0054 required file: ${file}`);
  }
}

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
if (packageJson.scripts["test:demo-asset-upload-ux"] !== "npm run build:demo && node tests/demo-asset-upload-ux.test.mjs") {
  throw new Error("Missing test:demo-asset-upload-ux script.");
}
if (!packageJson.scripts.test.includes("test:demo-asset-upload-ux")) {
  throw new Error("Root npm test must include MME-0054 demo asset upload UX checks.");
}
if (packageJson.scripts["visual:mme-0054"] !== "node scripts/visual-check-mme0054.mjs") {
  throw new Error("Missing visual:mme-0054 script.");
}

const main = readFileSync("apps/md-demo/src/main.ts", "utf8");
const surface = readFileSync("packages/md-surface/src/index.ts", "utf8");
const editorUiDocs = readFileSync("docs/public/concepts/editor-ui.md", "utf8");
const surfaceDocs = readFileSync("docs/public/packages/md-surface.md", "utf8");

for (const snippet of [
  "asset-upload-button",
  "asset-upload-input",
  "asset-upload-status",
  "host:insert-image-asset",
  "createDemoAssetUploadProvider",
  "insertDemoAsset",
  "sourceRangeForRichRange",
  "requestAssetUploadFromFile",
  "handleEditorAssetPaste",
  "handleEditorAssetDrop",
  "getAssetUploadState",
  "insertDemoAssetForTest",
  "configureDemoAssetProviderForTest",
  "simulateAssetPasteForTest",
  "simulateAssetDropForTest"
]) {
  if (!main.includes(snippet)) {
    throw new Error(`Demo missing MME-0054 asset upload snippet: ${snippet}`);
  }
}

for (const snippet of ["Insert image", "./assets/...", "does not copy the selected binary", "real host must replace that provider"]) {
  if (!editorUiDocs.includes(snippet)) {
    throw new Error(`Editor UI docs missing truthful demo-provider boundary: ${snippet}`);
  }
}
if (!surfaceDocs.includes("SurfaceAssetUploadState") || !surfaceDocs.includes("idle, pending, inserted, unavailable, denied, and failed")) {
  throw new Error("Surface docs must describe the reusable asset-upload state contract.");
}

for (const snippet of [
  "SurfaceAssetUploadState",
  "assetUpload",
  "chooseImage",
  "inserted",
  "unavailable",
  "denied",
  "failed",
  "pending"
]) {
  if (!surface.includes(snippet)) {
    throw new Error(`Surface package missing MME-0054 asset upload snippet: ${snippet}`);
  }
}
for (const snippet of ["documentChanged", "idle", "locationUnavailable", "markdownOnly", "readFailed", "uploading"]) {
  if (!surface.includes(snippet)) {
    throw new Error(`Surface i18n contract missing asset upload string: ${snippet}`);
  }
}

const insertDemoAsset = extractFunction(main, "async function insertDemoAsset");
if (!insertDemoAsset.includes("const uploadSession = session") || !insertDemoAsset.includes("uploadSession.insertAsset")) {
  throw new Error("Visible upload path must route through session.insertAsset.");
}
if (!insertDemoAsset.includes("locationUnavailable")) {
  throw new Error("Visible upload path must fail safely when a rich selection cannot map to source.");
}
if (insertDemoAsset.includes("runRichCommand(\"image\"") || insertDemoAsset.includes("data:image/")) {
  throw new Error("Visible upload path must not bypass the provider contract with demo-only image insertion.");
}
for (const status of ["inserted", "unavailable", "denied", "failed", "pending"]) {
  if (!insertDemoAsset.includes(`result.status === "${status}"`) && !insertDemoAsset.includes(`case "${status}"`)) {
    throw new Error(`Visible upload path must handle ${status} result state.`);
  }
}

const providerFactory = extractFunction(main, "function createDemoAssetUploadProvider");
if (!providerFactory.includes("./assets/")) {
  throw new Error("Demo provider must emit a clearly local/demo-scoped relative asset destination.");
}
if (providerFactory.includes("URL.createObjectURL") || providerFactory.includes("localStorage") || providerFactory.includes("fetch(")) {
  throw new Error("Demo provider must not imply production storage, object URL persistence, or network upload.");
}

const pasteHandler = extractFunction(main, "function handleEditorAssetPaste");
if (
  !pasteHandler.includes("requestAssetUploadFromFile") ||
  (!pasteHandler.includes('source: "paste"') && !pasteHandler.includes('requestAssetUploadFromFile(file, "paste")'))
) {
  throw new Error("Paste-like image flow must route to the asset upload provider with source=paste.");
}

const dropHandler = extractFunction(main, "function handleEditorAssetDrop");
if (
  !dropHandler.includes("requestAssetUploadFromFile") ||
  (!dropHandler.includes('source: "drop"') && !dropHandler.includes('requestAssetUploadFromFile(file, "drop")'))
) {
  throw new Error("Drop-like image flow must route to the asset upload provider with source=drop.");
}

const imagePicker = extractFunction(main, "function firstImageFile");
for (const snippet of ["transfer.items", "item.getAsFile", "transfer.files", "isImageFile"]) {
  if (!imagePicker.includes(snippet)) {
    throw new Error(`Paste/drop image discovery missing practical transfer path: ${snippet}`);
  }
}

const visualScript = readFileSync("scripts/visual-check-mme0054.mjs", "utf8");
for (const snippet of [
  "asset-upload-visible.png",
  "asset-upload-inserted.png",
  "asset-upload-denied.png",
  "new ClipboardEvent",
  "new DragEvent",
  "insertDemoAssetForTest",
  "configureDemoAssetProviderForTest",
  "simulateCleanExternalApplyForTest"
]) {
  if (!visualScript.includes(snippet)) {
    throw new Error(`MME-0054 visual script missing snippet: ${snippet}`);
  }
}

function extractFunction(source, signature) {
  const start = source.indexOf(signature);
  if (start < 0) {
    throw new Error(`Missing function: ${signature}`);
  }
  const declaration = source.slice(start);
  const bodyMatch = declaration.match(/\)\s*(?::[^\{]+)?\s*\{/);
  if (!bodyMatch || bodyMatch.index === undefined) {
    throw new Error(`Missing function body for: ${signature}`);
  }
  const open = start + bodyMatch.index + bodyMatch[0].lastIndexOf("{");
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
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
  throw new Error(`Unterminated function: ${signature}`);
}
