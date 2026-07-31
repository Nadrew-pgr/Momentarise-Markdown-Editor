import { access, readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const frameworkLicense = "MPL-2.0";
const demoLicense = "Apache-2.0";
const packageVersion = "0.1.0";
// Publishable packages carry the first alpha publish version (MME-0084); apps/examples
// stay private and unpublished at the workspace-consistent 0.1.0.
const publishedPackageVersion = "0.1.0-alpha.1";

const rootPackage = await readJson("package.json");
const rootLicense = await readText("LICENSE");

assert(rootPackage.license === frameworkLicense, "root package.json must declare the framework license.");
assert(rootPackage.version === packageVersion, "root package.json must carry the initial release-engineering version.");
assert(rootLicense.includes("Mozilla Public License Version 2.0"), "root LICENSE must be the MPL-2.0 text.");
assertScript("test:release-engineering");
assertScript("test:public-api");
assertScript("test:rich-security");
assertScript("test:consumer-matrix");
assert(rootPackage.devDependencies?.["@changesets/cli"], "root package.json must include Changesets tooling.");

for (const packageDir of await workspaceDirs("packages")) {
  const manifestPath = join(packageDir, "package.json");
  const manifest = await readJson(manifestPath);
  assert(manifest.version === publishedPackageVersion, `${manifest.name} must use the current published alpha version.`);
  assert(manifest.license === frameworkLicense, `${manifest.name} must declare ${frameworkLicense}.`);
  assertReleaseStatus(manifest, manifest.name);
  assertNoZeroPins(manifest, manifest.name);
  await assertReadme(packageDir, manifest.name, frameworkLicense);
}

for (const appDir of await workspaceDirs("apps")) {
  const manifest = await readJson(join(appDir, "package.json"));
  assert(manifest.version === packageVersion, `${manifest.name} must use the initial real demo version.`);
  assert(manifest.license === demoLicense, `${manifest.name} must declare ${demoLicense}.`);
  assertReleaseStatus(manifest, manifest.name);
  assertNoZeroPins(manifest, manifest.name);
  await assertReadme(appDir, manifest.name, demoLicense);
  const licenseText = await readText(join(appDir, "LICENSE"));
  assert(licenseText.includes("Apache License"), `${manifest.name} must carry an Apache-2.0 LICENSE because it differs from root.`);
}

for (const exampleDir of await workspaceDirs("examples")) {
  if (!existsSync(join(exampleDir, "package.json"))) {
    continue;
  }
  const manifest = await readJson(join(exampleDir, "package.json"));
  assert(manifest.version === packageVersion, `${manifest.name} must use the initial real example version.`);
  assert(manifest.license === demoLicense, `${manifest.name} must declare ${demoLicense}.`);
  assertReleaseStatus(manifest, manifest.name);
  assertNoZeroPins(manifest, manifest.name);
  await assertReadme(exampleDir, manifest.name, demoLicense);
  const licenseText = await readText(join(exampleDir, "LICENSE"));
  assert(licenseText.includes("Apache License"), `${manifest.name} must carry an Apache-2.0 LICENSE because it differs from root.`);
}

const changesetConfig = await readJson(".changeset/config.json");
assert(changesetConfig.changelog, "Changesets config must define changelog behavior.");
assert(changesetConfig.access === "public", "Changesets config must default publishable packages to public access.");

const compatibility = await readText("docs/public/compatibility-promise.md");
for (const required of ["Semver", "Experimental", "Stable", "MPL-2.0", "Apache-2.0"]) {
  assert(compatibility.includes(required), `compatibility promise must document ${required}.`);
}

const changelog = await readText("CHANGELOG.md");
for (const required of ["0.1.0", "MME-0036", "Public API export audit", "Security pass"]) {
  assert(changelog.includes(required), `CHANGELOG.md must seed ${required}.`);
}

const ci = await readText(".github/workflows/ci.yml");
for (const required of ["pull_request", "npm ci", "npm test", "npm run test:consumer-matrix", "actions/cache"]) {
  assert(ci.includes(required), `.github/workflows/ci.yml must include ${required}.`);
}

const gitignore = await readText(".gitignore");
for (const required of [".learnings/", ".env", ".env.*", "!.env.example"]) {
  assert(gitignore.includes(required), `.gitignore must keep ${required}.`);
}
const aiReviewIgnore = await readText("docs/internal/ai-reviews/.gitignore");
assert(aiReviewIgnore.includes("*"), "docs/internal/ai-reviews must ignore generated review files.");
assert(existsSync("fixtures/016-policy-sensitive/.env"), "tracked .env fixture must remain only as the hard-deny policy fixture.");

async function workspaceDirs(root) {
  const entries = await readdir(root, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => join(root, entry.name)).sort();
}

async function assertReadme(packageDir, packageName, license) {
  const readmePath = join(packageDir, "README.md");
  await access(readmePath);
  const readme = await readText(readmePath);
  for (const required of [packageName, `License: ${license}`, "Release status:", "Version policy:"]) {
    assert(readme.includes(required), `${readmePath} must document ${required}.`);
  }
}

function assertReleaseStatus(manifest, label) {
  const status = manifest.momentarise?.releaseStatus;
  assert(status === "experimental" || status === "stable", `${label} must declare a stable or experimental release status.`);
  assert(typeof manifest.momentarise?.versionPolicy === "string", `${label} must declare a version policy.`);
}

function assertNoZeroPins(manifest, label) {
  for (const field of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
    for (const [name, version] of Object.entries(manifest[field] ?? {})) {
      if (name.startsWith("@momentarise/")) {
        assert(version !== "0.0.0", `${label} must not pin internal dependency ${name} to 0.0.0.`);
      }
    }
  }
}

function assertScript(name) {
  assert(rootPackage.scripts?.[name], `root package.json must expose ${name}.`);
}

async function readJson(path) {
  return JSON.parse(await readText(path));
}

async function readText(path) {
  return readFile(path, "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
