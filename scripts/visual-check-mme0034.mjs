import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { requireChromeExecutable } from "./chrome-helpers.mjs";

const chromePath = requireChromeExecutable();
const demoUrl = process.env.MME_THEIA_DEMO_URL ?? "http://127.0.0.1:5176/";
const samplePath = process.env.MME_THEIA_SAMPLE_PATH ?? "/private/tmp/mme-theia-visual-note.md";
const sampleUri = process.env.MME_THEIA_SAMPLE_URI ?? "mme-demo:///visual-sample.md";
const visualDir = "docs/internal/visual-checks/MME-0034";
const port = 16180 + Math.floor(Math.random() * 500);
const userDataDir = `/tmp/mme-visual-0034-${Date.now()}`;

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
    this.listeners = new Map();
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
      if (handlers) {
        for (const handler of handlers.splice(0)) {
          handler(message.params ?? {});
        }
      }
      const listeners = this.listeners.get(message.method);
      if (!listeners) {
        return;
      }
      for (const handler of listeners) {
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

  on(method, handler) {
    const handlers = this.listeners.get(method) ?? [];
    handlers.push(handler);
    this.listeners.set(method, handlers);
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

async function waitFor(cdp, expression, label) {
  const start = Date.now();
  while (Date.now() - start < 30000) {
    if (await evaluate(cdp, expression)) {
      return;
    }
    await wait(150);
  }
  throw new Error(`Timed out waiting for ${label}.`);
}

async function main() {
  await mkdir(visualDir, { recursive: true });
  await writeFile(samplePath, "# MME-0034 visual sample\n\nFind target line for Theia source mode.\n");
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
    await cdp.send("Log.enable");
    const runtimeMessages = [];
    cdp.on("Runtime.consoleAPICalled", (event) => {
      runtimeMessages.push(
        `${event.type}: ${event.args.map((arg) => arg.value ?? arg.description ?? "").join(" ")}`
      );
    });
    cdp.on("Runtime.exceptionThrown", (event) => {
      runtimeMessages.push(`exception: ${event.exceptionDetails?.exception?.description ?? event.exceptionDetails?.text ?? "unknown"}`);
    });
    cdp.on("Log.entryAdded", (event) => {
      runtimeMessages.push(`${event.entry.level}: ${event.entry.text}`);
    });
    const loadEvent = cdp.once("Page.loadEventFired");
    await cdp.send("Page.navigate", { url: demoUrl });
    await loadEvent;
    await waitFor(cdp, `document.readyState === "complete" && Boolean(document.body)`, "Theia document load");
    await waitFor(
      cdp,
      `Boolean(document.querySelector(".theia-ApplicationShell, .p-Widget.theia-ApplicationShell, #theia-main-content-panel, .lm-Widget.theia-ApplicationShell")) && !Boolean(Array.from(document.querySelectorAll(".theia-preload")).find((element) => !element.classList.contains("theia-hidden") && getComputedStyle(element).display !== "none" && getComputedStyle(element).visibility !== "hidden"))`,
      "visible Theia shell"
    );
    await waitFor(cdp, `Boolean(window.__MME_THEIA_DEMO__?.isReady)`, "Momentarise Theia demo helper");
    await waitFor(cdp, `window.__MME_THEIA_DEMO__.isReady()`, "Theia ready state");
    await screenshot(cdp, "theia-shell-loaded.png");
    const shellLoaded = await evaluate(
      cdp,
      `Boolean(document.querySelector(".theia-ApplicationShell, .p-Widget.theia-ApplicationShell, #theia-main-content-panel, .lm-Widget.theia-ApplicationShell"))`
    );
    const preloaderVisible = await evaluate(
      cdp,
      `Boolean(Array.from(document.querySelectorAll(".theia-preload")).find((element) => !element.classList.contains("theia-hidden") && getComputedStyle(element).display !== "none" && getComputedStyle(element).visibility !== "hidden"))`
    );
    const bodyText = await evaluate(cdp, `document.body.innerText.slice(0, 500)`);
    const bodyClass = await evaluate(cdp, `document.body.className`);
    const htmlPreview = await evaluate(cdp, `document.body.innerHTML.slice(0, 1000)`);
    if (!shellLoaded || preloaderVisible) {
      const diagnostics = runtimeMessages.slice(-20).join("\n");
      throw new Error(
        `Timed out waiting for visible Theia shell. shellLoaded=${shellLoaded} preloaderVisible=${preloaderVisible} bodyClass=${bodyClass || "(empty)"} bodyText=${bodyText || "(empty)"} html=${htmlPreview || "(empty)"}${diagnostics ? `\nRuntime diagnostics:\n${diagnostics}` : ""}`
      );
    }
    const diagnosis = await evaluate(
      cdp,
      `Promise.race([
        window.__MME_THEIA_DEMO__.diagnoseMarkdownResource(${JSON.stringify(sampleUri)}).then((result) => JSON.stringify(result)),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timed out diagnosing Markdown resource.")), 30000))
      ])`
    );
    if (!diagnosis?.includes("momentarise.markdown.editor")) {
      throw new Error(`Theia Markdown diagnostic did not create the MME widget: ${diagnosis}`);
    }
    const opened = await evaluate(
      cdp,
      `Promise.race([
        window.__MME_THEIA_DEMO__.openMarkdownResource(${JSON.stringify(sampleUri)}).then((result) => JSON.stringify(result)),
        new Promise((_, reject) => setTimeout(() => {
          const widgets = Array.from(document.querySelectorAll(".p-Widget, .lm-Widget"))
            .map((element) => [element.id, element.className, element.textContent?.slice(0, 80)].join(" | "))
            .slice(0, 20)
            .join("\\n");
          reject(new Error("Timed out opening Markdown resource through Theia OpenerService.\\n" + widgets));
        }, 30000))
      ])`
    );
    if (!opened?.includes("momentarise.markdown.editor")) {
      throw new Error(`Theia Markdown OpenHandler did not return the MME widget: ${opened}`);
    }
    await waitFor(cdp, `Boolean(document.querySelector('[data-mme-theia-source] .cm-editor'))`, "Theia Markdown source editor");
    const sourceText = await evaluate(
      cdp,
      `document.querySelector('[data-mme-theia-source] .cm-content')?.textContent ?? ""`
    );
    if (!sourceText.includes("MME-0034 visual sample")) {
      throw new Error(`Theia Markdown source editor did not render sample content: ${sourceText}`);
    }
    const findOpened = await evaluate(
      cdp,
      `Promise.race([
        window.__MME_THEIA_DEMO__.openFind(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timed out opening Theia find command.")), 15000))
      ])`
    );
    if (!findOpened) {
      throw new Error("Theia find command did not open the MME find surface.");
    }
    await waitFor(
      cdp,
      `Boolean(document.querySelector('[data-mme-theia-find] [data-testid="find-replace-surface"]:not([hidden])'))`,
      "Theia Markdown find surface"
    );
    await screenshot(cdp, "theia-markdown-open-find.png");
    cdp.close();
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

await main();
