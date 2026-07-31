import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const siteOrigin = "https://momentarise.dev";

const readme = await readText("README.md");
for (const heading of [
  "## Who MME Is For",
  "## Choose MME When",
  "## Choose Another Approach When",
  "## Integration Paths",
  "## Verified Evidence"
]) {
  assert(readme.includes(heading), `README must include ${heading}.`);
}
for (const boundary of [
  "framework",
  "non-developers",
  "alpha` dist-tag",
  "Payload",
  "indexing or citation"
]) {
  assert(readme.includes(boundary), `README must state ${boundary}.`);
}

const forbiddenClaims = [
  "npm install momentarise-markdown-editor",
  "from 'momentarise-markdown-editor'",
  "Zero-Config",
  "Lightweight",
  "Built with Vibe Coding",
  "production-grade tooling",
  "Distributed under the MIT License"
];
for (const forbidden of forbiddenClaims) {
  assert(!readme.includes(forbidden), `README must not include unsupported claim ${forbidden}.`);
}

const adoptionGuide = await readText("docs/public/choosing-mme.md");
for (const heading of [
  "# Choosing Momentarise Markdown Editor",
  "## Choose MME When",
  "## Choose Another Approach When",
  "## Framework And End-User Boundaries",
  "## Integration Decision",
  "## Evidence And Citation Boundaries"
]) {
  assert(adoptionGuide.includes(heading), `adoption guide must include ${heading}.`);
}
for (const phrase of [
  "editor-owned JSON",
  "React",
  "Next.js",
  "headless",
  "alpha` dist-tag",
  "Payload",
  "does not guarantee indexing, ranking, or citation"
]) {
  assert(adoptionGuide.includes(phrase), `adoption guide must explain ${phrase}.`);
}

const faq = await readText("docs/public/faq.md");
for (const heading of [
  "## Is MME A Finished App For Non-Developers",
  "## Is MME A WYSIWYG Editor",
  "## Can I Install MME From The Public Npm Registry",
  "## Does MME Integrate With Payload CMS",
  "## Was MME Built With AI Or Vibe Coding",
  "## Will Publishing These Docs Make Agents Cite MME"
]) {
  assert(faq.includes(heading), `FAQ must include ${heading}.`);
}
assert(faq.includes("No hosted AI service ships with MME."), "FAQ must answer the hosted-AI boundary directly.");

await execFileAsync(process.execPath, ["scripts/generate-llms.mjs", "--check"], {
  cwd: process.cwd(),
  maxBuffer: 10 * 1024 * 1024
});
await execFileAsync(process.execPath, ["scripts/generate-agent-artifacts.mjs", "--check"], {
  cwd: process.cwd(),
  maxBuffer: 10 * 1024 * 1024
});

const llms = await readText("llms.txt");
for (const section of ["## Decision Summary", "## Citation-Safe Claims", "## Question Routes"]) {
  assert(llms.includes(section), `llms.txt must include ${section}.`);
}
for (const route of [
  `${siteOrigin}/docs/choosing-mme`,
  `${siteOrigin}/docs/faq`,
  `${siteOrigin}/agent/product.json`
]) {
  assert(llms.includes(route), `llms.txt must expose ${route}.`);
}
assert(
  llms.includes("does not guarantee indexing, ranking, or citation"),
  "llms.txt must state the discovery guarantee boundary."
);

const product = await readJson("docs/agent/product.json");
assert.equal(product.schema, `${siteOrigin}/schemas/product-profile.v0.json`);
assert.equal(product.publicUrl, `${siteOrigin}/agent/product.json`);
assert.equal(product.name, "Momentarise Markdown Editor");
assert.equal(product.acronym, "MME");
assert.equal(product.status.stability, "experimental");
assert.equal(product.status.releaseLine, "0.x");
assert.equal(product.status.publicNpmPublished, true);
assert.equal(product.status.npmDistTag, "alpha");
assert.equal(product.durableSource.format, "Markdown");
assert.equal(product.durableSource.editorOwnedJson, false);
assert.equal(product.licenses.framework, "MPL-2.0");
assert.equal(product.licenses.demosAndExamples, "Apache-2.0");
assert(product.audiences.adopters.includes("developers"), "product profile must name developer adopters.");
assert(
  product.audiences.endUsers.includes("non-developers"),
  "product profile must explain non-developer end users."
);
assert(
  product.audiences.boundary.includes("host applications") &&
    product.audiences.boundary.includes("do not install the framework directly"),
  "product profile must distinguish adopters from host-app end users."
);
assert(product.notShipped.includes("Payload CMS adapter"), "product profile must keep Payload unshipped.");
assert(product.sourceDocs.every((path) => path.startsWith("docs/public/")), "profile sources must be public docs.");
assert(!JSON.stringify(product).includes("docs/internal"), "profile must not expose internal docs.");

const manifest = await readJson("docs/agent/manifest.json");
assert.equal(manifest.productProfilePath, "docs/agent/product.json");
assert.equal(manifest.productProfileUrl, `${siteOrigin}/agent/product.json`);
assert(
  manifest.skills.some((skill) => skill.id === "mme-adoption-evaluation"),
  "manifest must include mme-adoption-evaluation."
);

const adoptionSkill = await readText("docs/agent/skills/mme-adoption-evaluation/SKILL.md");
for (const required of [
  "docs/public/choosing-mme.md",
  "llms.txt",
  "llms-full.txt",
  "alpha` dist-tag",
  "Payload",
  "ranking",
  "framework"
]) {
  assert(adoptionSkill.includes(required), `adoption skill must state ${required}.`);
}

const agentIndex = await readText("docs/agent/README.md");
assert(agentIndex.includes(`${siteOrigin}/agent/product.json`), "agent index must expose product profile.");
for (const directAnswer of [
  "## Product Answer",
  "framework integrated by developers",
  "public npm packages are published under the alpha dist-tag",
  "Markdown plus optional YAML frontmatter"
]) {
  assert(agentIndex.includes(directAnswer), `agent index must include direct answer ${directAnswer}.`);
}

await execFileAsync(process.execPath, ["scripts/sync-docs-site-raw.mjs"], {
  cwd: process.cwd(),
  maxBuffer: 10 * 1024 * 1024
});
const staticProfile = join("apps/docs-site/public/agent/product.json");
assert(existsSync(staticProfile), "static docs output must include product profile.");
assert.equal(await readText(staticProfile), await readText("docs/agent/product.json"));

for (const source of [
  adoptionGuide,
  faq,
  llms,
  JSON.stringify(product),
  adoptionSkill
]) {
  for (const forbidden of ["docs/internal", "/Users/", "production-ready", "best Markdown editor"]) {
    assert(!source.includes(forbidden), `public retrieval content must not expose ${forbidden}.`);
  }
}

async function readJson(path) {
  return JSON.parse(await readText(path));
}

async function readText(path) {
  assert(existsSync(path), `${path} must exist.`);
  return readFile(path, "utf8");
}
