import { existsSync } from "node:fs";

const ENV_CHROME_KEYS = ["CHROME_BIN", "CHROME_PATH"];

export function candidateChromePaths(env = process.env, platform = process.platform) {
  const envCandidates = ENV_CHROME_KEYS.map((key) => env[key]).filter(Boolean);

  const platformCandidates = {
    darwin: [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium"
    ],
    linux: [
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
      "/snap/bin/chromium"
    ],
    win32: [
      `${env.PROGRAMFILES ?? "C:\\Program Files"}\\Google\\Chrome\\Application\\chrome.exe`,
      `${env["PROGRAMFILES(X86)"] ?? "C:\\Program Files (x86)"}\\Google\\Chrome\\Application\\chrome.exe`,
      `${env.LOCALAPPDATA ?? ""}\\Google\\Chrome\\Application\\chrome.exe`
    ].filter((candidate) => !candidate.startsWith("\\"))
  };

  return [...envCandidates, ...(platformCandidates[platform] ?? [])];
}

export function resolveChromeExecutable(options = {}) {
  const env = options.env ?? process.env;
  const platform = options.platform ?? process.platform;
  const exists = options.exists ?? existsSync;

  for (const candidate of candidateChromePaths(env, platform)) {
    if (exists(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

export function formatMissingChromeMessage(options = {}) {
  const env = options.env ?? process.env;
  const platform = options.platform ?? process.platform;
  const candidates = options.candidates ?? candidateChromePaths(env, platform);
  const attempted = candidates.length > 0 ? candidates.map((candidate) => `- ${candidate}`).join("\n") : "- none";

  return [
    "Chrome/Chromium executable not found for visual verification.",
    "Set CHROME_BIN to a local Chrome or Chromium executable path, then rerun the visual command.",
    `Platform: ${platform}`,
    "Attempted candidates:",
    attempted
  ].join("\n");
}

export function requireChromeExecutable(options = {}) {
  const env = options.env ?? process.env;
  const platform = options.platform ?? process.platform;
  const candidates = candidateChromePaths(env, platform);
  const resolved = resolveChromeExecutable({
    env,
    exists: options.exists,
    platform
  });

  if (!resolved) {
    throw new Error(
      formatMissingChromeMessage({
        candidates,
        env,
        platform
      })
    );
  }

  return resolved;
}
