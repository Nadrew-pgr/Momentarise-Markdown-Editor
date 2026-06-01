import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { requireChromeExecutable } from "./chrome-helpers.mjs";
import { sandboxAllowsScripts } from "../packages/md-preview-html/dist/index.js";

const chromePath = requireChromeExecutable();
const demoUrl = process.env.MME_DEMO_URL ?? "http://127.0.0.1:5174/";
const visualDir = "docs/internal/visual-checks/MME-0015";
const port = 11000 + Math.floor(Math.random() * 500);
const userDataDir = `/tmp/mme-visual-0015-${Date.now()}`;

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

async function getSnapshot(cdp) {
  return evaluate(
    cdp,
    `(() => {
      const frame = document.querySelector('[data-testid="html-preview-frame"]');
      const previewState = window.__MME_DEMO_VISUAL_CHECK__.getHtmlPreviewState();
      return {
        activeDocument: window.__MME_DEMO_VISUAL_CHECK__.getActiveDocument(),
        bannerText: document.querySelector('[data-testid="html-preview-banner"]')?.textContent ?? "",
        editorMode: window.__MME_DEMO_VISUAL_CHECK__.getEditorMode(),
        frameHidden: frame?.hidden ?? null,
        frameSandbox: frame?.getAttribute("sandbox") ?? null,
        frameSrcdoc: frame?.getAttribute("srcdoc") ?? "",
        markdown: window.__MME_DEMO_VISUAL_CHECK__.getMarkdown(),
        previewButtonPressed: document.querySelector('[data-testid="preview-mode-button"]')?.getAttribute("aria-pressed") ?? null,
        previewState,
        richButtonDisabled: document.querySelector('[data-testid="rich-mode-button"]')?.disabled ?? null,
        scriptRan: window.__MME_HTML_PREVIEW_SCRIPT_RAN__ === true,
        statusText: document.querySelector('[data-testid="html-preview-status"]')?.textContent ?? ""
      };
    })()`
  );
}

async function screenshot(cdp, filename) {
  const result = await cdp.send("Page.captureScreenshot", {
    captureBeyondViewport: false,
    format: "png",
    fromSurface: true
  });
  await writeFile(join(visualDir, filename), Buffer.from(result.data, "base64"));
}

async function setFileInputFiles(cdp, selector, files) {
  await cdp.send("DOM.enable");
  const { root } = await cdp.send("DOM.getDocument", {
    depth: -1,
    pierce: true
  });
  const { nodeId } = await cdp.send("DOM.querySelector", {
    nodeId: root.nodeId,
    selector
  });
  if (!nodeId) {
    throw new Error(`Cannot find file input: ${selector}`);
  }
  await cdp.send("DOM.setFileInputFiles", {
    files,
    nodeId
  });
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

async function waitForSnapshot(cdp, predicate, label) {
  const start = Date.now();
  let snapshot = await getSnapshot(cdp);
  while (Date.now() - start < 6000) {
    if (predicate(snapshot)) {
      return snapshot;
    }
    await wait(100);
    snapshot = await getSnapshot(cdp);
  }
  throw new Error(`Timed out waiting for ${label}.\nLast snapshot:\n${JSON.stringify(snapshot, null, 2)}`);
}

async function waitForExpression(cdp, expression, label) {
  const start = Date.now();
  while (Date.now() - start < 6000) {
    if (await evaluate(cdp, expression)) {
      return;
    }
    await wait(100);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function getHtmlPreviewLayout(cdp) {
  return evaluate(
    cdp,
    `(() => {
      const host = document.querySelector('[data-testid="html-preview-host"]');
      const stage = document.querySelector('[data-testid="html-preview-stage"]');
      const frame = document.querySelector('[data-testid="html-preview-frame"]');
      const scroller = document.scrollingElement ?? document.documentElement;
      const hostRect = host.getBoundingClientRect();
      const stageRect = stage.getBoundingClientRect();
      const frameRect = frame.getBoundingClientRect();
      const frameDocument = frame.contentDocument;
      const frameRoot = frameDocument?.documentElement;
      const frameBody = frameDocument?.body;
      return {
        bodyInlineZoom: frameBody?.style.zoom ?? "",
        frameContentMatchMediaMobile: frame.contentWindow?.matchMedia("(max-width: 520px)").matches ?? false,
        frameClientWidth: frame.clientWidth,
        frameContentScrollWidth: Math.max(frameRoot?.scrollWidth ?? 0, frameBody?.scrollWidth ?? 0),
        frameDisplay: getComputedStyle(frame).display,
        frameRect: {
          bottom: frameRect.bottom,
          left: frameRect.left,
          right: frameRect.right,
          top: frameRect.top,
          width: frameRect.width
        },
        frameViewportMode: frame.dataset.mmePreviewViewport ?? null,
        frameViewportWidth: Number(frame.dataset.mmePreviewViewportWidth ?? "0"),
        hostRect: {
          bottom: hostRect.bottom,
          left: hostRect.left,
          right: hostRect.right,
          top: hostRect.top,
          width: hostRect.width
        },
        stageOverflowX: getComputedStyle(stage).overflowX,
        stageRect: {
          bottom: stageRect.bottom,
          left: stageRect.left,
          right: stageRect.right,
          top: stageRect.top,
          width: stageRect.width
        },
        stageScrollWidth: stage.scrollWidth,
        pageScrollWidth: scroller.scrollWidth,
        viewportWidth: window.innerWidth
      };
    })()`
  );
}

function assertHtmlPreviewContainsOverflow(layout) {
  const tolerance = 2;
  if (layout.pageScrollWidth > layout.viewportWidth + tolerance) {
    throw new Error(`HTML preview must not force page-level horizontal scroll.\n${JSON.stringify(layout, null, 2)}`);
  }
  if (layout.hostRect.left < -tolerance || layout.hostRect.right > layout.viewportWidth + tolerance) {
    throw new Error(`HTML preview host must fit inside the viewport.\n${JSON.stringify(layout, null, 2)}`);
  }
  if (layout.stageRect.left < -tolerance || layout.stageRect.right > layout.viewportWidth + tolerance) {
    throw new Error(`HTML preview stage must fit inside the viewport.\n${JSON.stringify(layout, null, 2)}`);
  }
  if (layout.frameContentScrollWidth <= layout.frameClientWidth) {
    throw new Error(`Wide HTML fixture did not prove iframe-contained overflow.\n${JSON.stringify(layout, null, 2)}`);
  }
  if (layout.bodyInlineZoom) {
    throw new Error(`HTML preview must not zoom artifact content.\n${JSON.stringify(layout, null, 2)}`);
  }
  if (layout.stageOverflowX !== "auto") {
    throw new Error(`HTML preview stage must own horizontal overflow.\n${JSON.stringify(layout, null, 2)}`);
  }
  if (layout.frameDisplay !== "block") {
    throw new Error(`HTML preview iframe should be block-level to avoid inline layout gaps.\n${JSON.stringify(layout, null, 2)}`);
  }
}

function assertHtmlPreviewResponsiveFrame(layout, expectedMode, expectedWidth) {
  const widthDelta = Math.abs(layout.frameClientWidth - expectedWidth);
  if (layout.frameViewportMode !== expectedMode || widthDelta > 2) {
    throw new Error(`HTML preview frame must use the selected ${expectedMode} viewport width.\n${JSON.stringify(layout, null, 2)}`);
  }
  if (!layout.frameContentMatchMediaMobile) {
    throw new Error(`HTML preview content must see the iframe's mobile viewport, not a zoomed desktop viewport.\n${JSON.stringify(layout, null, 2)}`);
  }
  if (layout.bodyInlineZoom) {
    throw new Error(`Responsive HTML preview must not use inline zoom.\n${JSON.stringify(layout, null, 2)}`);
  }
}

function assertIncludes(value, expected, label) {
  if (!String(value).includes(expected)) {
    throw new Error(`Expected ${label} to include ${JSON.stringify(expected)}.\nActual: ${String(value)}`);
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
      "--window-size=1280,820",
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

    const hostileHtml = `<!doctype html>
<html>
  <head><title>Unsafe visual fixture</title></head>
  <body>
    <h1>Sandboxed HTML artifact</h1>
    <p>The preview should render this text.</p>
    <script>
      document.body.dataset.scriptRan = "true";
      document.body.insertAdjacentHTML("beforeend", "<p>SCRIPT RAN</p>");
      try {
        window.top.__MME_HTML_PREVIEW_SCRIPT_RAN__ = true;
      } catch {}
    </script>
  </body>
</html>`;
    const hostileHtmlPath = join(userDataDir, "unsafe-visual.html");
    await writeFile(hostileHtmlPath, hostileHtml);

    await evaluate(
      cdp,
      `(() => {
        window.__MME_HTML_PREVIEW_SCRIPT_RAN__ = false;
      })()`
    );
    await setFileInputFiles(cdp, '[data-testid="html-file-input"]', [hostileHtmlPath]);
    const sourceOpened = await waitForSnapshot(
      cdp,
      (snapshot) =>
        snapshot.activeDocument.kind === "html-artifact" &&
        snapshot.editorMode === "source" &&
        snapshot.markdown.includes("<script>") &&
        snapshot.richButtonDisabled === true &&
        snapshot.previewState.scriptsEnabled === false,
      "HTML artifact source opened"
    );
    assertIncludes(sourceOpened.statusText, "HTML artifact", "HTML preview status");
    await screenshot(cdp, "html-source-opened.png");

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("preview")`);
    const previewOpened = await waitForSnapshot(
      cdp,
      (snapshot) =>
        snapshot.editorMode === "preview" &&
        snapshot.previewButtonPressed === "true" &&
        snapshot.frameSandbox !== null &&
        snapshot.frameSrcdoc.includes("Sandboxed HTML artifact") &&
        snapshot.scriptRan === false,
      "sandboxed HTML preview opened"
    );
    if (sandboxAllowsScripts(previewOpened.frameSandbox)) {
      throw new Error(`HTML preview sandbox must not allow scripts: ${previewOpened.frameSandbox}`);
    }
    if (previewOpened.previewState.scriptsEnabled !== false) {
      throw new Error("HTML preview state must report scripts disabled.");
    }
    await wait(1000);
    const afterScriptWait = await getSnapshot(cdp);
    if (afterScriptWait.scriptRan) {
      throw new Error("Sandboxed HTML preview script ran unexpectedly.");
    }
    await screenshot(cdp, "html-sandbox-preview.png");

    const wideNonresponsiveHtml = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Wide nonresponsive artifact</title>
    <style>
      body {
        margin: 0;
        background: #0c0d10;
        color: #f4f4f6;
        font-family: system-ui, sans-serif;
      }
      main {
        width: 1420px;
        min-height: 720px;
        padding: 48px;
        border: 1px solid #2b3040;
      }
      h1 {
        margin: 0 0 32px;
        color: #6d8cff;
        font-size: 64px;
      }
      .row {
        display: grid;
        grid-template-columns: repeat(4, 280px);
        gap: 24px;
      }
      section {
        border: 1px solid #2b3040;
        padding: 24px;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Wide nonresponsive artifact</h1>
      <div class="row">
        <section>Column one</section>
        <section>Column two</section>
        <section>Column three</section>
        <section>Column four</section>
      </div>
    </main>
  </body>
</html>`;
    const wideHtmlPath = join(userDataDir, "wide-nonresponsive.html");
    await writeFile(wideHtmlPath, wideNonresponsiveHtml);
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      deviceScaleFactor: 1,
      height: 900,
      mobile: false,
      width: 860
    });
    await setFileInputFiles(cdp, '[data-testid="html-file-input"]', [wideHtmlPath]);
    await waitForSnapshot(
      cdp,
      (snapshot) =>
        snapshot.activeDocument.kind === "html-artifact" &&
        snapshot.editorMode === "source" &&
        snapshot.markdown.includes("Wide nonresponsive artifact") &&
        snapshot.richButtonDisabled === true,
      "wide HTML artifact source opened"
    );
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("preview")`);
    await waitForSnapshot(
      cdp,
      (snapshot) =>
        snapshot.editorMode === "preview" &&
        snapshot.previewButtonPressed === "true" &&
        snapshot.frameSrcdoc.includes("Wide nonresponsive artifact"),
      "wide HTML artifact preview opened"
    );
    await waitForExpression(
      cdp,
      `document.querySelector('[data-testid="html-preview-frame"]')?.contentDocument?.body?.textContent.includes("Wide nonresponsive artifact")`,
      "wide HTML preview frame content"
    );
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.setHtmlPreviewViewportMode("fit")`);
    assertHtmlPreviewContainsOverflow(await getHtmlPreviewLayout(cdp));

    const responsiveViewportHtml = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Responsive viewport artifact</title>
    <style>
      body {
        margin: 0;
        background: #0c0d10;
        color: #f4f4f6;
        font-family: system-ui, sans-serif;
      }
      main {
        max-width: 960px;
        min-height: 720px;
        margin: 0 auto;
        padding: 40px;
      }
      h1 {
        margin: 0 0 28px;
        color: #6d8cff;
        font-size: clamp(34px, 8vw, 64px);
      }
      .row {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 18px;
      }
      section {
        border: 1px solid #2b3040;
        padding: 18px;
      }
      @media (max-width: 520px) {
        main {
          padding: 24px;
        }
        .row {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Responsive viewport artifact</h1>
      <div class="row">
        <section>Column one</section>
        <section>Column two</section>
        <section>Column three</section>
      </div>
    </main>
  </body>
</html>`;
    const responsiveHtmlPath = join(userDataDir, "responsive-viewport.html");
    await writeFile(responsiveHtmlPath, responsiveViewportHtml);
    await setFileInputFiles(cdp, '[data-testid="html-file-input"]', [responsiveHtmlPath]);
    await waitForSnapshot(
      cdp,
      (snapshot) =>
        snapshot.activeDocument.kind === "html-artifact" &&
        snapshot.editorMode === "source" &&
        snapshot.markdown.includes("Responsive viewport artifact") &&
        snapshot.richButtonDisabled === true,
      "responsive HTML artifact source opened"
    );
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("preview")`);
    await waitForSnapshot(
      cdp,
      (snapshot) =>
        snapshot.editorMode === "preview" &&
        snapshot.previewButtonPressed === "true" &&
        snapshot.frameSrcdoc.includes("Responsive viewport artifact"),
      "responsive HTML artifact preview opened"
    );
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.setHtmlPreviewViewportMode("mobile")`);
    await waitForExpression(
      cdp,
      `document.querySelector('[data-testid="html-preview-frame"]')?.dataset.mmePreviewViewport === "mobile"`,
      "mobile HTML preview viewport"
    );
    await waitForExpression(
      cdp,
      `document.querySelector('[data-testid="html-preview-frame"]')?.contentWindow?.matchMedia("(max-width: 520px)").matches === true`,
      "responsive HTML content sees mobile iframe width"
    );
    assertHtmlPreviewResponsiveFrame(await getHtmlPreviewLayout(cdp), "mobile", 390);
    await screenshot(cdp, "html-preview-responsive-frame.png");

    cdp.close();
    console.log(`MME-0015 visual artifacts saved to ${visualDir}`);
  } catch (error) {
    if (stderr.trim()) {
      console.error(stderr.trim());
    }
    throw error;
  } finally {
    if (chrome.exitCode === null && chrome.signalCode === null) {
      chrome.kill("SIGTERM");
    }
    await Promise.race([chromeExit, wait(2000)]);
    if (chrome.exitCode === null && chrome.signalCode === null) {
      chrome.kill("SIGKILL");
    }
    await Promise.race([chromeExit, wait(2000)]);
    await rm(userDataDir, {
      force: true,
      maxRetries: 3,
      recursive: true,
      retryDelay: 100
    });
  }
}

await main();
