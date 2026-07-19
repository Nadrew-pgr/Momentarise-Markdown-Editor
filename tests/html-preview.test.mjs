import {
  createSandboxedHtmlPreview,
  htmlPreviewPackage,
  isHtmlFileName,
  sandboxAllowsScripts
} from "../packages/md-preview-html/dist/index.js";

const hostileHtml = `<!doctype html>
<html>
  <head><title>Unsafe fixture</title></head>
  <body>
    <h1>Sandboxed artifact</h1>
    <script>
      document.body.dataset.scriptRan = "true";
      document.body.insertAdjacentHTML("beforeend", "<p>SCRIPT RAN</p>");
      try {
        window.top.__MME_HTML_PREVIEW_SCRIPT_RAN__ = true;
      } catch {}
    </script>
  </body>
</html>`;

if (htmlPreviewPackage.packageName !== "@momentarise/md-preview-html") {
  throw new Error("HTML preview package must expose the expected public contract.");
}

const descriptor = createSandboxedHtmlPreview({
  fileName: "unsafe-preview.html",
  html: hostileHtml
});

if (descriptor.kind !== "html-artifact-preview") {
  throw new Error(`Unexpected descriptor kind: ${descriptor.kind}`);
}
if (descriptor.fileName !== "unsafe-preview.html") {
  throw new Error(`Unexpected preview file name: ${descriptor.fileName}`);
}
if (descriptor.srcdoc !== hostileHtml) {
  throw new Error("HTML preview must preserve the source as iframe srcdoc; source rewriting is out of scope.");
}
if (descriptor.scriptsEnabled !== false) {
  throw new Error("Scripts must be disabled by default.");
}
if (descriptor.sandbox !== "") {
  throw new Error(`Default sandbox must grant no tokens unless a host opts in. Actual sandbox: ${descriptor.sandbox}`);
}
if (sandboxAllowsScripts(descriptor.sandbox)) {
  throw new Error("Default sandbox must not allow scripts.");
}
if (!descriptor.warnings.some((warning) => warning.code === "html-preview-scripts-disabled")) {
  throw new Error("Descriptor must explain that scripts are disabled by default.");
}
if (!descriptor.warnings.some((warning) => warning.code === "html-preview-sandboxed")) {
  throw new Error("Descriptor must keep sandbox truth discoverable for host UI details.");
}
if (!descriptor.warnings.some((warning) => warning.code === "html-preview-inline-script-present")) {
  throw new Error("Descriptor must disclose inline scripts without enabling them.");
}

const explicitCompatibilityDescriptor = createSandboxedHtmlPreview({
  fileName: "compat-preview.html",
  html: "<p>Compatibility preview</p>",
  sandboxTokens: ["allow-same-origin"]
});
if (explicitCompatibilityDescriptor.sandbox !== "allow-same-origin") {
  throw new Error("Hosts must still be able to opt into allow-same-origin explicitly.");
}

const scriptOptInDescriptor = createSandboxedHtmlPreview({
  fileName: "script-request.html",
  html: "<script>window.top.__MME_LEAK = true;</script>",
  sandboxTokens: ["allow-scripts", "allow-same-origin"]
});
if (scriptOptInDescriptor.sandbox.includes("allow-scripts")) {
  throw new Error("HTML preview must strip allow-scripts even when a host passes it in V0.");
}
if (scriptOptInDescriptor.scriptsEnabled !== false) {
  throw new Error("HTML preview descriptor must never claim scripts are enabled in V0.");
}
if (sandboxAllowsScripts(scriptOptInDescriptor.sandbox)) {
  throw new Error("Script opt-in request must not produce a script-enabled sandbox.");
}

for (const fileName of ["artifact.html", "artifact.HTML", "fragment.htm"]) {
  if (!isHtmlFileName(fileName)) {
    throw new Error(`Expected ${fileName} to be recognized as an HTML file.`);
  }
}
for (const fileName of ["note.md", "html-in-markdown.md", "README"]) {
  if (isHtmlFileName(fileName)) {
    throw new Error(`Expected ${fileName} to remain non-HTML.`);
  }
}
