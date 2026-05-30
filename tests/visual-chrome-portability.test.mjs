import { readFile } from "node:fs/promises";

const visualScripts = [
  "scripts/visual-check-mme0002.mjs",
  "scripts/visual-check-mme0004.mjs",
  "scripts/visual-check-mme0005.mjs",
  "scripts/visual-check-mme0007.mjs",
  "scripts/visual-check-mme0008.mjs",
  "scripts/visual-check-mme0009.mjs",
  "scripts/visual-check-mme0011.mjs"
];

const chromeHelpers = await import("../scripts/chrome-helpers.mjs");

const fakeChrome = "/tmp/fake-google-chrome";
const resolvedEnvChrome = chromeHelpers.resolveChromeExecutable({
  env: {
    CHROME_BIN: fakeChrome
  },
  exists: (candidate) => candidate === fakeChrome,
  platform: "linux"
});

if (resolvedEnvChrome !== fakeChrome) {
  throw new Error("CHROME_BIN must be honored before platform defaults.");
}

const linuxCandidates = chromeHelpers.candidateChromePaths({}, "linux");
if (!linuxCandidates.some((candidate) => candidate.includes("google-chrome"))) {
  throw new Error("Linux Chrome candidates must be included.");
}

const darwinCandidates = chromeHelpers.candidateChromePaths({}, "darwin");
if (!darwinCandidates.some((candidate) => candidate.includes("Google Chrome.app"))) {
  throw new Error("macOS Chrome candidates must be included.");
}

const winCandidates = chromeHelpers.candidateChromePaths({}, "win32");
if (!winCandidates.some((candidate) => candidate.includes("Chrome\\Application\\chrome.exe"))) {
  throw new Error("Windows Chrome candidates must be included.");
}

const missingMessage = chromeHelpers.formatMissingChromeMessage({
  candidates: ["/missing/chrome"],
  env: {},
  platform: "linux"
});
if (!missingMessage.includes("CHROME_BIN") || !missingMessage.includes("/missing/chrome")) {
  throw new Error("Missing Chrome message must explain CHROME_BIN and attempted candidates.");
}

for (const scriptPath of visualScripts) {
  const source = await readFile(scriptPath, "utf8");
  if (source.includes("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")) {
    throw new Error(`${scriptPath} must not hardcode the macOS Chrome path.`);
  }
  if (!source.includes("./chrome-helpers.mjs")) {
    throw new Error(`${scriptPath} must use the shared Chrome helper.`);
  }
}
