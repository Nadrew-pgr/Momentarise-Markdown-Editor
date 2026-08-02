import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { requireChromeExecutable } from "./chrome-helpers.mjs";

const chromePath = requireChromeExecutable();
const demoUrl = process.env.MME_DEMO_URL ?? "http://127.0.0.1:5175/";
const visualDir = "docs/internal/visual-checks/MME-0033";
const port = 16120 + Math.floor(Math.random() * 500);
const userDataDir = `/tmp/mme-visual-0033-${Date.now()}`;

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
    await waitFor(cdp, `Boolean(window.__MME_DEMO_VISUAL_CHECK__?.openFindReplaceForTest)`, "MME-0033 visual hooks");

    const markdown = [
      "# Searchable guide",
      "",
      "Find needle in source mode.",
      "",
      "## Outline",
      "",
      "Needle appears in this section.",
      "",
      "### Details",
      "",
      "Another needle.",
      "",
      "## Outline",
      "",
      "Duplicate heading keeps a stable slug.",
      ""
    ].join("\n");
    await evaluate(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.loadImportedCopyForTest("find-outline.md", ${JSON.stringify(markdown)})`
    );
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.openFindReplaceForTest("needle")`);
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getFindReplaceState().count === 3`, "source find count");
    await waitFor(cdp, `document.querySelectorAll(".mme-source-find-match").length === 3`, "source highlights");
    await screenshot(cdp, "source-find-highlights.png");

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.replaceActiveFindMatchForTest("marker")`);
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getMarkdown().includes("Find marker in source mode.")`, "source replace");
    await screenshot(cdp, "source-replace-preserved.png");

    const outline = await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getOutline()`);
    if (outline[0]?.children?.[0]?.slug !== "h2-outline" || outline[0]?.children?.[1]?.slug !== "h2-outline-2") {
      throw new Error(`Outline duplicate slugs were not stable: ${JSON.stringify(outline, null, 2)}`);
    }

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("rich")`);
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.openFindReplaceForTest("outline")`);
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getEditorMode() === "rich"`, "rich mode active");
    await waitFor(cdp, `document.querySelectorAll(".mme-rich-find-match").length >= 2`, "rich highlights");
    await screenshot(cdp, "rich-find-highlights.png");

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.replaceActiveFindMatchForTest("section")`);
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getMarkdown().includes("## section")`, "rich replace");
    await screenshot(cdp, "rich-replace-preserved.png");
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
