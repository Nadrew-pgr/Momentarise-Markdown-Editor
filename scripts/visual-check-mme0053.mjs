import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { requireChromeExecutable } from "./chrome-helpers.mjs";

const chromePath = requireChromeExecutable();
const demoUrl = process.env.MME_DEMO_URL ?? "http://127.0.0.1:5174/";
const visualDir = "docs/internal/visual-checks/MME-0053";
const port = 17300 + Math.floor(Math.random() * 500);
const userDataDir = `/tmp/mme-visual-0053-${Date.now()}`;

const hostileSvg = `<svg xmlns="http://www.w3.org/2000/svg" ONLOAD="alert(1)" viewBox="0 0 64 64">
  <script>window.top.__MME_SVG_SCRIPT_RAN__ = true;</script>
  <style>@import url("https://evil.example/theme.css"); circle { fill: red; }</style>
  <foreignObject><iframe src="https://evil.example"></iframe></foreignObject>
  <image href="https://evil.example/logo.png" />
  <a href="JaVa
ScRiPt:alert(1)"><text x="8" y="20">Bad link</text></a>
  <circle cx="32" cy="32" r="24" style="fill:url(https://evil.example/pattern.svg)" />
</svg>`;

const safeSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">\r\n  <title>Runtime SVG</title>\r\n  <circle cx="32" cy="32" r="24" fill="#2563eb" />\r\n</svg>\r\n`;

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

async function waitFor(cdp, expression, label, timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await evaluate(cdp, expression)) {
      return;
    }
    await wait(100);
  }
  throw new Error(`Timed out waiting for ${label}.`);
}

async function snapshot(cdp) {
  return evaluate(
    cdp,
    `(() => {
      const preview = window.__MME_DEMO_VISUAL_CHECK__.getHtmlPreviewState();
      const save = window.__MME_DEMO_VISUAL_CHECK__.getSaveState();
      return {
        activeDocument: window.__MME_DEMO_VISUAL_CHECK__.getActiveDocument(),
        diskContent: window.__MME_DEMO_VISUAL_CHECK__.getTestDiskContent(),
        editorMode: window.__MME_DEMO_VISUAL_CHECK__.getEditorMode(),
        frameSandbox: document.querySelector("[data-testid='html-preview-frame']")?.getAttribute("sandbox") ?? "",
        frameSrcdoc: document.querySelector("[data-testid='html-preview-frame']")?.getAttribute("srcdoc") ?? "",
        modeButtons: Array.from(document.querySelectorAll('[data-testid$="-mode-button"]')).map((node) => node.textContent.trim()),
        preview,
        save,
        saveTruth: document.querySelector("[data-testid='html-preview-save-truth']")?.textContent ?? "",
        statusText: document.querySelector("[data-testid='html-preview-status']")?.textContent ?? "",
        surfaceState: document.querySelector("[data-testid='editor-surface-state']")?.textContent ?? ""
      };
    })()`
  );
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertNoUnsafeSvgPreview(srcdoc) {
  for (const pattern of [
    /<script\b/i,
    /<foreignObject\b/i,
    /<image\b/i,
    /\son[a-z0-9:-]+\s*=/i,
    /\sstyle\s*=/i,
    /javascript:/i,
    /data:/i,
    /https?:\/\/(?!www\.w3\.org\/2000\/svg)/i,
    /@import/i
  ]) {
    assert(!pattern.test(srcdoc), `Sanitized SVG preview leaked unsafe pattern ${pattern}.\n${srcdoc}`);
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
      "--window-size=1360,860",
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
    await waitFor(cdp, `Boolean(window.__MME_DEMO_VISUAL_CHECK__?.loadWritableSvgFileForTest)`, "MME-0053 visual hooks");

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.loadImportedCopyForTest("runtime-hostile.svg", ${JSON.stringify(hostileSvg)})`);
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getActiveDocument().kind === "svg-artifact"`, "imported SVG artifact opened");
    let state = await snapshot(cdp);
    assert(state.activeDocument.mode === "imported-copy", "Imported SVG must remain imported-copy.");
    assert(state.save.target === "download-required", "Imported SVG must require export/download.");
    assert(state.modeButtons.includes("Source"), "SVG must expose Source.");
    assert(state.modeButtons.includes("Preview"), "SVG must expose Preview.");
    assert(!state.modeButtons.includes("Rich"), "SVG must not expose Rich.");
    assert(!state.modeButtons.includes("Live Preview"), "SVG must not expose Live Preview.");
    await screenshot(cdp, "svg-source-opened.png");

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("preview")`);
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getEditorMode() === "preview"`, "SVG preview mode active");
    state = await snapshot(cdp);
    assert(state.preview.available === true, "SVG preview state must be available.");
    assert(state.preview.scriptsEnabled === false, "SVG preview must report scripts disabled.");
    assert(!state.frameSandbox.includes("allow-scripts"), "SVG iframe sandbox must not allow scripts.");
    assert(state.statusText.includes("SVG artifact preview"), "SVG preview status must identify SVG.");
    assert(state.surfaceState.includes("SVG"), "Editor surface status must identify SVG preview.");
    assert(state.saveTruth.includes("preview sanitized only"), "SVG save truth must distinguish source from preview.");
    assertNoUnsafeSvgPreview(state.frameSrcdoc);
    assert((await evaluate(cdp, `Boolean(window.__MME_SVG_SCRIPT_RAN__)`)) === false, "Hostile SVG script must not run.");
    await screenshot(cdp, "svg-sanitized-preview.png");

    await evaluate(cdp, `document.querySelector("[data-testid='html-preview-details']").open = true`);
    await screenshot(cdp, "svg-preview-details-open.png");

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.loadWritableSvgFileForTest("runtime-disk.svg", ${JSON.stringify(safeSvg)})`);
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getSaveState().target === "disk"`, "writable SVG disk target");
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.setCursorToEnd()`);
    await cdp.send("Input.insertText", { text: "\n<!-- local SVG source edit -->\n" });
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getSaveState().status === "dirty"`, "dirty SVG source edit");
    await evaluate(cdp, `(async () => { await window.__MME_DEMO_VISUAL_CHECK__.flushSave("manual"); return true; })()`);
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getTestDiskContent()?.includes("local SVG source edit")`, "SVG source saved to disk");
    state = await snapshot(cdp);
    assert(state.activeDocument.kind === "svg-artifact", "Writable SVG must stay SVG artifact.");
    assert(state.diskContent.includes("local SVG source edit"), "Writable SVG save must write source text.");
    await screenshot(cdp, "svg-writable-source-saved.png");

    cdp.close();
    console.log(`MME-0053 runtime artifacts saved to ${visualDir}`);
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
