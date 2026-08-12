import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { requireChromeExecutable } from "./chrome-helpers.mjs";

const chromePath = requireChromeExecutable();
const tokensCssPath = "packages/md-theme/src/tokens.css";
const demoUrl = process.env.MME_DEMO_URL ?? "http://127.0.0.1:5174/";
const visualDir = "docs/internal/visual-checks/MME-0025";
const port = 13500 + Math.floor(Math.random() * 500);
const userDataDir = `/tmp/mme-visual-0025-${Date.now()}`;

const showcaseMarkdown = `# Theme contract check

Toolbar icons, dark/light tokens, and host overrides should all render without CSS forks.

- The demo imports tokens from @momentarise/md-theme.
- The rich toolbar renders the default IconSet.
- A host partial theme can override accent, radius, density, and font scale.

\`\`\`ts
const themed = true;
\`\`\`
`;

class CdpClient {
  static async connect(url) {
    const socket = new WebSocket(url);
    const client = new CdpClient(socket);
    await new Promise((resolve, reject) => {
      socket.addEventListener("open", resolve, { once: true });
      socket.addEventListener("error", reject, { once: true });
    });
    return client;
  }

  constructor(socket) {
    this.events = new Map();
    this.nextId = 1;
    this.pending = new Map();
    this.socket = socket;
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { reject, resolve } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) {
          reject(new Error(message.error.message));
        } else {
          resolve(message.result ?? {});
        }
        return;
      }

      const handlers = this.events.get(message.method);
      if (!handlers) {
        return;
      }
      for (const handler of handlers.splice(0)) {
        handler(message.params ?? {});
      }
    });
  }

  close() {
    this.socket.close();
  }

  once(method) {
    return new Promise((resolve) => {
      const handlers = this.events.get(method) ?? [];
      handlers.push(resolve);
      this.events.set(method, handlers);
    });
  }

  send(method, params = {}) {
    const id = this.nextId;
    this.nextId += 1;
    this.socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { reject, resolve });
    });
  }
}

async function evaluate(cdp, expression) {
  const result = await cdp.send("Runtime.evaluate", {
    awaitPromise: true,
    expression,
    returnByValue: true
  });
  if (result.exceptionDetails) {
    const description = result.exceptionDetails.exception?.description ?? result.exceptionDetails.text ?? "unknown exception";
    throw new Error(`Runtime evaluation failed: ${expression}\n${description}`);
  }
  return result.result.value;
}

async function screenshot(cdp, filename) {
  const result = await cdp.send("Page.captureScreenshot", {
    captureBeyondViewport: false,
    format: "png",
    fromSurface: true
  });
  await writeFile(join(visualDir, filename), Buffer.from(result.data, "base64"));
}

async function wait(ms) {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForJson(url, options = {}) {
  const timeoutMs = options.timeoutMs ?? 30000;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const exitStatus = options.getExitStatus?.();
    if (exitStatus) {
      const details = options.getStderr?.().trim();
      throw new Error(
        `Chrome exited before CDP became available (code ${exitStatus.code}, signal ${exitStatus.signal}).${
          details ? `\n${details}` : ""
        }`
      );
    }
    try {
      const response = await fetch(url);
      if (response.ok) {
        return response.json();
      }
    } catch {}
    await wait(100);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function waitFor(cdp, expression, label) {
  const start = Date.now();
  while (Date.now() - start < 7000) {
    if (await evaluate(cdp, expression)) {
      return;
    }
    await wait(100);
  }
  throw new Error(`Timed out waiting for ${label}.`);
}

async function clickByTestId(cdp, testId) {
  await evaluate(
    cdp,
    `(() => {
      const element = document.querySelector('[data-testid="${testId}"]');
      if (!element) throw new Error('Missing element: ${testId}');
      element.click();
      return true;
    })()`
  );
}

async function main() {
  await mkdir(visualDir, { recursive: true });
  const chrome = spawn(
    chromePath,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-background-networking",
      "--disable-component-update",
      "--disable-features=Translate,OptimizationHints",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userDataDir}`,
      "--window-size=1360,920",
      "about:blank"
    ],
    { stdio: ["ignore", "ignore", "pipe"] }
  );
  const chromeExit = new Promise((resolve) => {
    chrome.once("exit", resolve);
  });
  let stderr = "";
  chrome.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  try {
    const version = await waitForJson(`http://127.0.0.1:${port}/json/version`, {
      getExitStatus: () =>
        chrome.exitCode === null && chrome.signalCode === null
          ? null
          : {
              code: chrome.exitCode,
              signal: chrome.signalCode
            },
      getStderr: () => stderr
    });
    const browserCdp = await CdpClient.connect(version.webSocketDebuggerUrl);
    const { targetId } = await browserCdp.send("Target.createTarget", { url: "about:blank" });
    browserCdp.close();
    const targets = await waitForJson(`http://127.0.0.1:${port}/json/list`);
    const target = targets.find((candidate) => candidate.id === targetId);
    if (!target?.webSocketDebuggerUrl) {
      throw new Error("Could not find page target WebSocket URL.");
    }

    const cdp = await CdpClient.connect(target.webSocketDebuggerUrl);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    const loadEvent = cdp.once("Page.loadEventFired");
    await cdp.send("Page.navigate", { url: demoUrl });
    await loadEvent;
    await waitFor(cdp, `Boolean(window.__MME_DEMO_VISUAL_CHECK__)`, "demo loaded");

    /*
     * MME-0089 turned the persistent formatting toolbar off by default
     * (benchmark contract 4). This gate counts toolbar children, and
     * `createToolbar` renders them whether or not the root is hidden — so
     * without this opt-in the assertions below would have gone on passing
     * against an invisible toolbar, and the screenshots would have quietly lost
     * it. The opt-in itself is proven by `visual:mme-0089`.
     */
    await evaluate(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.setReferenceSurfacePreferencesForTest({ toolbarMode: "sticky" })`
    );

    await evaluate(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.loadImportedCopyForTest("theme-contract.md", ${JSON.stringify(showcaseMarkdown)})`
    );
    await clickByTestId(cdp, "rich-mode-button");
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getEditorMode() === "rich"`, "rich mode active");

    const packaged = await packagedSchemeBackgrounds();

    /*
     * MME-0116: pin the scheme explicitly. This used to read whatever the demo
     * happened to default to and call it "dark", so the dark half of the
     * assertion depended on a demo preference rather than on the scheme pin the
     * token contract is about.
     */
    await evaluate(cdp, `document.documentElement.dataset.mmeScheme = "dark"`);
    await wait(250);
    const darkState = await readThemeState(cdp);
    if (darkState.iconCount < 12) {
      throw new Error(`Expected default toolbar icons to render, got ${darkState.iconCount}.`);
    }
    if (darkState.bg !== packaged.dark) {
      throw new Error(
        `Dark --mme-color-bg should resolve to the packaged --mme-neutral-1 (${packaged.dark}), got ${darkState.bg}.`
      );
    }
    await screenshot(cdp, "theme-default-dark-toolbar.png");

    await evaluate(cdp, `document.documentElement.dataset.mmeScheme = "light"`);
    await wait(250);
    const lightState = await readThemeState(cdp);
    if (lightState.bg !== packaged.light) {
      throw new Error(
        `Light --mme-color-bg should resolve to the packaged --mme-neutral-1 (${packaged.light}), got ${lightState.bg}.`
      );
    }
    if (lightState.bg === darkState.bg) {
      throw new Error("Light scheme should change token values from the dark scheme.");
    }
    await screenshot(cdp, "theme-light-toolbar.png");

    await evaluate(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.applyHostThemeForTest({
        colors: { accent: "#ff00aa", text: "#101010" },
        shape: { radiusMd: "14px" },
        spacing: { density: "1.18" },
        typography: { fontScale: "1.08" }
      }, "light")`
    );
    await wait(250);
    const hostState = await readThemeState(cdp);
    if (hostState.accent !== "#ff00aa") {
      throw new Error(`Expected host accent override #ff00aa, got ${hostState.accent}.`);
    }
    if (hostState.radiusMd !== "14px") {
      throw new Error(`Expected host radius override 14px, got ${hostState.radiusMd}.`);
    }
    if (hostState.density !== "1.18") {
      throw new Error(`Expected host density override 1.18, got ${hostState.density}.`);
    }
    if (hostState.fontScale !== "1.08") {
      throw new Error(`Expected host font scale override 1.08, got ${hostState.fontScale}.`);
    }
    await screenshot(cdp, "theme-host-override.png");

    cdp.close();
    console.log(`MME-0025 visual artifacts saved to ${visualDir}`);
  } finally {
    chrome.kill("SIGTERM");
    await Promise.race([chromeExit, wait(2000)]);
    /*
     * MME-0114: escalate. A Chrome that ignores SIGTERM stays alive with its
     * stdio pipes open, which keeps Node's event loop alive — the gate prints its
     * success line and then never exits. The runner can only kill it on timeout,
     * so a hanging gate looks exactly like a failing one and blocks the suite.
     */
    if (chrome.exitCode === null && chrome.signalCode === null) {
      chrome.kill("SIGKILL");
    }
    await Promise.race([chromeExit, wait(2000)]);
  }
}

/**
 * MME-0116 — read the expected background from the packaged tokens, not from a
 * literal frozen in this file.
 *
 * This gate used to demand `#0a0a0a` dark and `#ffffff` light. MME-0102 rebuilt
 * the neutrals as a ramp, so light became `#fbfcff` and the gate went red for
 * being out of date rather than for anything being broken — while the dark
 * literal survived only by luck and would rot at the next ramp change.
 *
 * Pinning the new literals would just reset that clock. What this gate is for is
 * that the *packaged* token reaches the rendered surface: so the expectation is
 * read from `packages/md-theme/src/tokens.css` at run time. A deliberate ramp
 * change now updates one file and this follows; a demo that overrides the token,
 * a stylesheet that fails to load, or a scheme pin that stops working still
 * fails. The exact ramp values stay pinned deterministically, in
 * `tests/theme-tokens.test.mjs`, where they belong.
 */
async function packagedSchemeBackgrounds() {
  const css = await readFile(tokensCssPath, "utf8");
  const backgrounds = {};
  for (const scheme of ["light", "dark"]) {
    const block = css.match(new RegExp(`:root\\[data-mme-scheme="${scheme}"\\]\\s*\\{([\\s\\S]*?)\\n\\}`));
    if (!block) {
      throw new Error(`${tokensCssPath} no longer declares a :root[data-mme-scheme="${scheme}"] block.`);
    }
    /* `--mme-color-bg` is declared as `var(--mme-neutral-1)`, so the ramp entry is the real value. */
    const neutral = block[1].match(/--mme-neutral-1:\s*([^;]+);/);
    if (!neutral) {
      throw new Error(`${tokensCssPath}'s ${scheme} block no longer declares --mme-neutral-1.`);
    }
    backgrounds[scheme] = neutral[1].trim();
  }
  if (backgrounds.light === backgrounds.dark) {
    throw new Error(
      `${tokensCssPath} declares the same --mme-neutral-1 for both schemes (${backgrounds.light}); ` +
        "this gate could then pass with the scheme switch broken."
    );
  }
  return backgrounds;
}

async function readThemeState(cdp) {
  return evaluate(
    cdp,
    `(() => {
      const rootStyle = getComputedStyle(document.documentElement);
      return {
        accent: rootStyle.getPropertyValue("--mme-color-accent").trim(),
        bg: rootStyle.getPropertyValue("--mme-color-bg").trim(),
        density: rootStyle.getPropertyValue("--mme-density").trim(),
        fontScale: rootStyle.getPropertyValue("--mme-font-scale").trim(),
        iconCount: document.querySelectorAll('[data-testid="rich-command-toolbar"] .toolbar-icon svg').length,
        radiusMd: rootStyle.getPropertyValue("--mme-radius-md").trim()
      };
    })()`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
