import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const siteOrigin = "https://momentarise.dev";
const repositoryUrl = "https://github.com/Nadrew-pgr/Momentarise-Markdown-Editor";
const appRoot = "apps/docs-site";

const rootPackage = await readJson("package.json");
assert(rootPackage.scripts?.["test:agent-discovery"], "package.json must expose test:agent-discovery.");
assert(
  rootPackage.scripts.test.includes("npm run test:agent-discovery"),
  "root npm test must include the agent discovery gate."
);

const readme = await readText("README.md");
for (const heading of [
  "# Momentarise Markdown Editor",
  "## Why MME",
  "## What Ships",
  "## Start Building",
  "## Package Map",
  "## For Coding Agents",
  "## Status And Boundaries",
  "## License"
]) {
  assert(readme.includes(heading), `README must include ${heading}.`);
}
for (const truth of [
  "Markdown remains the durable source",
  "experimental",
  "0.x",
  "MPL-2.0",
  "Apache-2.0",
  "llms.txt",
  "docs/agent/manifest.json",
  "not published"
]) {
  assert(readme.includes(truth), `README must state ${truth}.`);
}
assert(!readme.includes("Completed slices:"), "README must not expose the internal completed-issue ledger.");
assert(!readme.includes("vibe-coded"), "README must not use vibe coding as a quality or discovery claim.");
assert(
  readme.includes("shipped Payload CMS or other CMS integration"),
  "README must explicitly keep Payload/CMS integration under unshipped boundaries."
);
assert(
  !readme.includes("MME integrates with Payload CMS"),
  "README must not present an unshipped Payload integration."
);
assert(readme.split("\n").length <= 260, "README must remain a bounded public entrypoint.");

const agents = await readText("AGENTS.md");
assert(agents.includes("AGENT.md"), "AGENTS.md must point repository agents to the canonical build instructions.");
assert(agents.includes("README.md"), "AGENTS.md must identify the public repository overview.");
assert(agents.includes("docs/public/"), "AGENTS.md must identify the public documentation source.");
assert(agents.split("\n").length <= 80, "AGENTS.md must remain a thin compatibility entrypoint.");

await execFileAsync(process.execPath, ["scripts/generate-llms.mjs", "--check"], {
  cwd: process.cwd(),
  maxBuffer: 10 * 1024 * 1024
});
await execFileAsync(process.execPath, ["scripts/generate-agent-artifacts.mjs", "--check"], {
  cwd: process.cwd(),
  maxBuffer: 10 * 1024 * 1024
});

const llms = await readText("llms.txt");
for (const section of [
  "## What MME Is",
  "## Core Guarantees",
  "## Use MME When",
  "## Do Not Assume",
  "## Start Building",
  "## Machine-Readable Entry Points",
  "## Public Docs"
]) {
  assert(llms.includes(section), `llms.txt must include ${section}.`);
}
for (const endpoint of [
  `${siteOrigin}/llms-full.txt`,
  `${siteOrigin}/agent/README.md`,
  `${siteOrigin}/agent/manifest.json`,
  `${siteOrigin}/agent/actions.json`,
  `${siteOrigin}/docs`,
  repositoryUrl
]) {
  assert(llms.includes(endpoint), `llms.txt must expose ${endpoint}.`);
}
assert(!llms.includes(`${siteOrigin}/docs/llms-full.txt`), "llms-full must resolve at the site root.");

const manifest = await readJson("docs/agent/manifest.json");
assert.equal(manifest.publicUrl, `${siteOrigin}/agent/manifest.json`);
assert.equal(manifest.actionsUrl, `${siteOrigin}/agent/actions.json`);
assert.equal(manifest.readmeUrl, `${siteOrigin}/agent/README.md`);
assert.equal(manifest.productProfileUrl, `${siteOrigin}/agent/product.json`);
for (const skill of manifest.skills) {
  assert.equal(skill.publicUrl, `${siteOrigin}/agent/skills/${skill.id}/SKILL.md`);
  assert(skill.path.startsWith("docs/agent/skills/"), `${skill.id} must keep a repository path.`);
}

const agentIndex = await readText("docs/agent/README.md");
assert(agentIndex.includes(`${siteOrigin}/agent/manifest.json`), "agent index must expose the public manifest.");
assert(agentIndex.includes(`${siteOrigin}/agent/product.json`), "agent index must expose the public product profile.");
assert(agentIndex.includes("## Product Answer"), "agent index must provide a direct product answer.");
assert(agentIndex.includes("public npm packages are not published"), "agent index must state npm publication truth.");
assert(agentIndex.includes("not installed automatically"), "agent index must state the installation boundary.");
assert(agentIndex.includes("generated"), "agent index must state that artifacts are generated.");

const publicAgentRoot = join(appRoot, "public/agent");
await rm(publicAgentRoot, { force: true, recursive: true });
await symlink(tmpdir(), publicAgentRoot, "dir");
const { syncDocsSiteRaw } = await import("../scripts/sync-docs-site-raw.mjs");
try {
  await assert.rejects(syncDocsSiteRaw(), /symlink/i, "static discovery sync must reject a symlink target.");
} finally {
  await rm(publicAgentRoot, { force: true });
}
await syncDocsSiteRaw();
const staleAgentArtifact = join(publicAgentRoot, "stale-private-output.txt");
await mkdir(publicAgentRoot, { recursive: true });
await writeFile(staleAgentArtifact, "must not remain public\n");
await syncDocsSiteRaw();
assert(!existsSync(staleAgentArtifact), "static discovery sync must remove stale non-allowlisted agent files.");

for (const [source, builtPublic] of [
  ["llms.txt", join(appRoot, "public/llms.txt")],
  ["llms-full.txt", join(appRoot, "public/llms-full.txt")],
  ["docs/agent/README.md", join(appRoot, "public/agent/README.md")],
  ["docs/agent/product.json", join(appRoot, "public/agent/product.json")],
  ["docs/agent/manifest.json", join(appRoot, "public/agent/manifest.json")],
  ["docs/agent/actions.json", join(appRoot, "public/agent/actions.json")]
]) {
  assert(existsSync(builtPublic), `${builtPublic} must be emitted for static export.`);
  assert.equal(await readText(builtPublic), await readText(source), `${builtPublic} must match ${source}.`);
}
for (const skill of manifest.skills) {
  const publicPath = join(appRoot, "public/agent/skills", skill.id, "SKILL.md");
  assert.equal(await readText(publicPath), await readText(skill.path), `${skill.id} public skill must match its source.`);
}

const publicArtifacts = [
  await readText(join(appRoot, "public/llms.txt")),
  await readText(join(appRoot, "public/llms-full.txt")),
  await readText(join(appRoot, "public/agent/README.md")),
  await readText(join(appRoot, "public/agent/product.json")),
  await readText(join(appRoot, "public/agent/manifest.json")),
  await readText(join(appRoot, "public/agent/actions.json")),
  ...await Promise.all(
    manifest.skills.map((skill) => readText(join(appRoot, "public/agent/skills", skill.id, "SKILL.md")))
  )
].join("\n");
for (const forbidden of ["docs/internal", "/Users/", "vibe-coded"]) {
  assert(!publicArtifacts.includes(forbidden), `public agent artifacts must not expose ${forbidden}.`);
}
const installableAgentArtifacts = [
  await readText(join(appRoot, "public/agent/README.md")),
  await readText(join(appRoot, "public/agent/product.json")),
  await readText(join(appRoot, "public/agent/manifest.json")),
  await readText(join(appRoot, "public/agent/actions.json")),
  ...await Promise.all(
    manifest.skills.map((skill) => readText(join(appRoot, "public/agent/skills", skill.id, "SKILL.md")))
  )
].join("\n");
assert(!installableAgentArtifacts.includes(".env"), "agent descriptors and skills must not mention local env files.");

for (const routeFile of ["app/robots.ts", "app/sitemap.ts"]) {
  assert(existsSync(join(appRoot, routeFile)), `${routeFile} must exist.`);
}
const layoutSource = await readText(join(appRoot, "app/layout.tsx"));
for (const required of ["metadataBase", "robots", "openGraph"]) {
  assert(layoutSource.includes(required), `root metadata must include ${required}.`);
}
const robotsSource = await readText(join(appRoot, "app/robots.ts"));
assert(robotsSource.includes("sitemap"), "robots metadata route must advertise the sitemap.");
assert(robotsSource.includes("allow"), "robots metadata route must explicitly allow public crawling.");
const sitemapSource = await readText(join(appRoot, "app/sitemap.ts"));
assert(sitemapSource.includes("allDocsPages"), "sitemap must derive routes from canonical public docs.");
assert(sitemapSource.includes("hrefForPage"), "sitemap must use the docs route mapper.");

const landingSource = [
  await readText(join(appRoot, "app/page.tsx")),
  await readText(join(appRoot, "src/site-metadata.ts"))
].join("\n");
for (const required of [
  "SoftwareSourceCode",
  "application/ld+json",
  repositoryUrl,
  "MPL-2.0",
  "JSON.stringify"
]) {
  assert(landingSource.includes(required), `landing structured data must include ${required}.`);
}

async function readJson(path) {
  return JSON.parse(await readText(path));
}

async function readText(path) {
  assert(existsSync(path), `${path} must exist.`);
  return readFile(path, "utf8");
}
