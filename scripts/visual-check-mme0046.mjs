import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { requireChromeExecutable } from "./chrome-helpers.mjs";
import { sandboxAllowsScripts } from "../packages/md-preview-html/dist/index.js";

const chromePath = requireChromeExecutable();
const demoUrl = process.env.MME_DEMO_URL ?? "http://127.0.0.1:5174/";
const visualDir = "docs/internal/visual-checks/MME-0046";
const port = 17600 + Math.floor(Math.random() * 500);
const userDataDir = `/tmp/mme-visual-0046-${Date.now()}`;

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
        `Chrome exited before CDP became available (code ${exitStatus.code}, signal ${exitStatus.signal}). ` +
          `Run with system Chrome permission if sandboxed local Chrome aborts before startup.` +
          `${details ? `\n${details}` : ""}`
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

async function waitForExpression(cdp, expression, label) {
  const start = Date.now();
  while (Date.now() - start < 7000) {
    if (await evaluate(cdp, expression)) {
      return;
    }
    await wait(100);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function getSnapshot(cdp) {
  return evaluate(
    cdp,
    `(() => {
      const host = document.querySelector('[data-testid="html-preview-host"]');
      const frame = document.querySelector('[data-testid="html-preview-frame"]');
      const details = document.querySelector('[data-testid="html-preview-details"]');
      const detailsMenu = document.querySelector('[data-testid="html-preview-details-menu"]');
      const frameRect = frame?.getBoundingClientRect();
      const hostRect = host?.getBoundingClientRect();
      return {
        activeDocument: window.__MME_DEMO_VISUAL_CHECK__.getActiveDocument(),
        detailsMenuText: detailsMenu?.textContent ?? "",
        detailsOpen: details?.open ?? false,
        editorMode: window.__MME_DEMO_VISUAL_CHECK__.getEditorMode(),
        frameSandbox: frame?.getAttribute("sandbox") ?? null,
        frameSrcdocLength: frame?.getAttribute("srcdoc")?.length ?? 0,
        hasBanner: Boolean(document.querySelector('[data-testid="html-preview-banner"]')),
        hostOverflowY: host ? getComputedStyle(host).overflowY : null,
        hostRows: host ? getComputedStyle(host).gridTemplateRows : null,
        htmlPreview: window.__MME_DEMO_VISUAL_CHECK__.getHtmlPreviewState(),
        layout: {
          frameHeight: Math.round(frameRect?.height ?? 0),
          frameWidth: Math.round(frameRect?.width ?? 0),
          hostHeight: Math.round(hostRect?.height ?? 0),
          hostWidth: Math.round(hostRect?.width ?? 0)
        },
        scriptRan: window.__MME_HTML_PREVIEW_SCRIPT_RAN__ === true,
        visible: host ? !host.hidden : false
      };
    })()`
  );
}

async function waitForSnapshot(cdp, predicate, label) {
  const start = Date.now();
  let snapshot = await getSnapshot(cdp);
  while (Date.now() - start < 7000) {
    if (predicate(snapshot)) {
      return snapshot;
    }
    await wait(100);
    snapshot = await getSnapshot(cdp);
  }
  throw new Error(`Timed out waiting for ${label}.\nLast snapshot:\n${JSON.stringify(snapshot, null, 2)}`);
}

function assertHtmlPreviewLayout(snapshot, label) {
  if (snapshot.hasBanner) {
    throw new Error(`${label}: normal HTML preview must not expose a permanent technical banner.`);
  }
  if (!snapshot.visible || snapshot.editorMode !== "preview" || snapshot.activeDocument.kind !== "html-artifact") {
    throw new Error(`${label}: HTML artifact preview is not visible.\n${JSON.stringify(snapshot, null, 2)}`);
  }
  if (snapshot.frameSandbox !== "" || sandboxAllowsScripts(snapshot.frameSandbox ?? "")) {
    throw new Error(`${label}: sandbox must grant no tokens and never allow scripts.`);
  }
  if (snapshot.htmlPreview.scriptsEnabled !== false) {
    throw new Error(`${label}: visual hook must report scripts disabled.`);
  }
  if (snapshot.layout.frameHeight < Math.floor(snapshot.layout.hostHeight * 0.82)) {
    throw new Error(`${label}: iframe is not using the available reading height.\n${JSON.stringify(snapshot.layout)}`);
  }
  if (snapshot.layout.frameWidth < Math.floor(snapshot.layout.hostWidth * 0.94)) {
    throw new Error(`${label}: iframe is not using the available reading width.\n${JSON.stringify(snapshot.layout)}`);
  }
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
      "--window-size=1280,860",
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
      getStderr: () => stderr,
      timeoutMs: 30000
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
    await waitForExpression(
      cdp,
      `Boolean(window.__MME_DEMO_VISUAL_CHECK__?.loadHtmlArtifactForTest)`,
      "MME demo visual hook"
    );

    const readableHtml = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Release Notes</title>
    <style>
      body { margin: 0; font-family: ui-sans-serif, system-ui; background: #ffffff; color: #1d2430; }
      main { max-width: 780px; margin: 0 auto; padding: 56px 32px 80px; line-height: 1.62; }
      h1 { margin: 0 0 12px; font-size: 42px; letter-spacing: -0.03em; }
      .lead { color: #536071; font-size: 18px; }
      .panel { margin-top: 26px; border: 1px solid #d7dde7; border-radius: 14px; padding: 22px; background: #f8fafc; }
      code { background: #edf2f7; border-radius: 6px; padding: 2px 5px; }
    </style>
  </head>
  <body>
    <main>
      <h1>Standalone HTML artifact</h1>
      <p class="lead">This is a normal reading preview for imported HTML, not a technical device emulator.</p>
      <section class="panel">
        <h2>What matters</h2>
        <p>The preview fills the editor viewport while sandbox and save truth stay available from details.</p>
        <p><code>allow-scripts</code> remains disabled by default.</p>
      </section>
    </main>
  </body>
</html>`;
    await evaluate(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.loadHtmlArtifactForTest("release-notes.html", ${JSON.stringify(readableHtml)})`
    );
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("preview")`);
    const desktop = await waitForSnapshot(
      cdp,
      (snapshot) => snapshot.visible && snapshot.editorMode === "preview" && snapshot.frameSrcdocLength > 0,
      "normal HTML reading desktop"
    );
    assertHtmlPreviewLayout(desktop, "desktop");
    await screenshot(cdp, "normal-html-reading-desktop.png");

    await evaluate(cdp, `document.querySelector('[data-testid="html-preview-details-toggle"]')?.click()`);
    const detailsOpen = await waitForSnapshot(
      cdp,
      (snapshot) =>
        snapshot.detailsOpen === true &&
        snapshot.detailsMenuText.includes("Sandbox") &&
        snapshot.detailsMenuText.includes("no sandbox tokens") &&
        snapshot.detailsMenuText.includes("scripts disabled") &&
        snapshot.detailsMenuText.includes("download/export required"),
      "HTML preview details affordance"
    );
    assertHtmlPreviewLayout(detailsOpen, "details");
    await screenshot(cdp, "html-preview-details-open.png");

    await cdp.send("Emulation.setDeviceMetricsOverride", {
      deviceScaleFactor: 1,
      height: 760,
      mobile: false,
      width: 640
    });
    await wait(200);
    await evaluate(cdp, `document.querySelector('[data-testid="html-preview-details"]')?.removeAttribute("open")`);
    const constrained = await waitForSnapshot(
      cdp,
      (snapshot) => snapshot.visible && snapshot.layout.hostWidth <= 640 && snapshot.layout.frameHeight > 500,
      "normal HTML reading constrained"
    );
    assertHtmlPreviewLayout(constrained, "constrained");
    await screenshot(cdp, "normal-html-reading-constrained.png");

    await cdp.send("Emulation.clearDeviceMetricsOverride");
    const hostileHtml = `<!doctype html>
<html>
  <body>
    <h1>Script fixture</h1>
    <script>
      window.top.__MME_HTML_PREVIEW_SCRIPT_RAN__ = true;
      document.body.insertAdjacentHTML("beforeend", "<p>SCRIPT RAN</p>");
    </script>
  </body>
</html>`;
    await evaluate(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.loadHtmlArtifactForTest("hostile.html", ${JSON.stringify(hostileHtml)})`
    );
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("preview")`);
    const blocked = await waitForSnapshot(
      cdp,
      (snapshot) =>
        snapshot.visible &&
        snapshot.htmlPreview.warnings.includes("html-preview-inline-script-present") &&
        snapshot.scriptRan === false,
      "script blocked HTML preview"
    );
    assertHtmlPreviewLayout(blocked, "script blocked");
    await screenshot(cdp, "html-preview-script-blocked.png");

    cdp.close();
  } finally {
    chrome.kill("SIGTERM");
    /*
     * MME-0114: bound the wait and escalate. A Chrome that ignores SIGTERM keeps
     * its stdio pipes open and so keeps Node's event loop alive; the gate prints
     * its result and never exits, which blocks the whole suite.
     */
    await Promise.race([chromeExit, wait(2000)]);
    if (chrome.exitCode === null && chrome.signalCode === null) {
      chrome.kill("SIGKILL");
    }
    await Promise.race([chromeExit, wait(2000)]);
    await rm(userDataDir, { force: true, recursive: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
