import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { requireChromeExecutable } from "./chrome-helpers.mjs";

const chromePath = requireChromeExecutable();
const demoUrl = process.env.MME_DEMO_URL ?? "http://127.0.0.1:5174/";
const visualDir = "docs/internal/visual-checks/MME-0011";
const port = 11500 + Math.floor(Math.random() * 500);
const userDataDir = `/tmp/mme-visual-0011-${Date.now()}`;
const frontmatterFixture = `---
title: Fixture With Frontmatter
status: draft
tags:
  - markdown
  - preservation
updated: 2026-05-29
---

# Frontmatter Document

The YAML block above is part of the durable Markdown file and must survive edits.
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
    this.socket.send(
      JSON.stringify({
        id,
        method,
        params
      })
    );
    return new Promise((resolve, reject) => {
      this.pending.set(id, {
        reject,
        resolve
      });
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
    throw new Error(`Runtime evaluation failed: ${expression}`);
  }
  return result.result.value;
}

async function getSnapshot(cdp) {
  return evaluate(
    cdp,
    `(() => ({
      markdown: window.__MME_DEMO_VISUAL_CHECK__.getMarkdown(),
      properties: window.__MME_DEMO_VISUAL_CHECK__.getPropertiesState(),
      parserStatus: document.querySelector('[data-testid="parser-status"]').textContent,
      serializerStatus: document.querySelector('[data-testid="serializer-status"]').textContent
    }))()`
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
    {
      stdio: ["ignore", "ignore", "pipe"]
    }
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
    const { targetId } = await browserCdp.send("Target.createTarget", {
      url: "about:blank"
    });
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
    await cdp.send("Page.navigate", {
      url: demoUrl
    });
    await loadEvent;
    await wait(200);

    await evaluate(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.loadImportedCopyForTest("frontmatter-properties.md", ${JSON.stringify(
        frontmatterFixture
      )})`
    );
    const visible = await waitForSnapshot(
      cdp,
      (snapshot) =>
        snapshot.properties.mode === "visible" &&
        String(snapshot.properties.listText).includes("Fixture With Frontmatter") &&
        String(snapshot.markdown).startsWith("---"),
      "visible parsed properties"
    );
    const markdownBeforeToggle = visible.markdown;
    assertIncludes(visible.properties.listText, "markdown, preservation", "visible properties tags");
    await screenshot(cdp, "properties-visible-frontmatter.png");

    await evaluate(cdp, `document.querySelector('[data-testid="properties-mode-hidden"]').click()`);
    const hidden = await waitForSnapshot(
      cdp,
      (snapshot) =>
        snapshot.properties.mode === "hidden" &&
        String(snapshot.properties.hiddenText).includes("Raw YAML remains visible") &&
        snapshot.markdown === markdownBeforeToggle,
      "hidden properties state"
    );
    assertIncludes(hidden.markdown, "title: Fixture With Frontmatter", "hidden mode source markdown");
    await screenshot(cdp, "properties-hidden.png");

    await evaluate(cdp, `document.querySelector('[data-testid="properties-mode-source"]').click()`);
    const source = await waitForSnapshot(
      cdp,
      (snapshot) =>
        snapshot.properties.mode === "source" &&
        snapshot.properties.sourceHidden === false &&
        String(snapshot.properties.rawSource).includes("status: draft") &&
        snapshot.markdown === markdownBeforeToggle,
      "raw YAML properties source"
    );
    assertIncludes(source.properties.rawSource, "updated: 2026-05-29", "raw YAML source");
    await screenshot(cdp, "properties-source-yaml.png");

    await evaluate(cdp, "window.__MME_DEMO_VISUAL_CHECK__.setCursorToEnd()");
    await cdp.send("Input.insertText", {
      text: "\nBody edit after properties inspection."
    });
    const edited = await waitForSnapshot(
      cdp,
      (snapshot) =>
        String(snapshot.markdown).startsWith("---") &&
        String(snapshot.markdown).includes("Body edit after properties inspection.") &&
        String(snapshot.parserStatus).includes("pass") &&
        String(snapshot.serializerStatus).includes("pass"),
      "frontmatter preserved after body edit"
    );
    assertIncludes(edited.markdown, "title: Fixture With Frontmatter", "edited source frontmatter");
    await screenshot(cdp, "properties-roundtrip-after-edit.png");

    cdp.close();
    console.log(`MME-0011 visual artifacts saved to ${visualDir}`);
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
