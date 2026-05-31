import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { requireChromeExecutable } from "./chrome-helpers.mjs";

const chromePath = requireChromeExecutable();
const demoUrl = process.env.MME_DEMO_URL ?? "http://127.0.0.1:5174/";
const visualDir = "docs/internal/visual-checks/MME-0013";
const port = 12300 + Math.floor(Math.random() * 500);
const userDataDir = `/tmp/mme-visual-0013-${Date.now()}`;
const commandFixture = `---
title: Command UI Fixture
---

Command title

Task target

const answer = 42;
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
    throw new Error(`Runtime evaluation failed: ${expression}`);
  }
  return result.result.value;
}

async function getSnapshot(cdp) {
  return evaluate(
    cdp,
    `(() => ({
      editorMode: window.__MME_DEMO_VISUAL_CHECK__.getEditorMode(),
      markdown: window.__MME_DEMO_VISUAL_CHECK__.getMarkdown(),
      slash: window.__MME_DEMO_VISUAL_CHECK__.getSlashMenuState(),
      toolbar: window.__MME_DEMO_VISUAL_CHECK__.getToolbarState(),
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

async function clickByTestId(cdp, testId) {
  const box = await evaluate(
    cdp,
    `(() => {
      const element = document.querySelector('[data-testid="${testId}"]');
      if (!element) {
        return null;
      }
      const rect = element.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    })()`
  );
  if (!box) {
    throw new Error(`Cannot find element for click: ${testId}`);
  }
  await cdp.send("Input.dispatchMouseEvent", {
    button: "left",
    clickCount: 1,
    type: "mousePressed",
    x: box.x,
    y: box.y
  });
  await cdp.send("Input.dispatchMouseEvent", {
    button: "left",
    clickCount: 1,
    type: "mouseReleased",
    x: box.x,
    y: box.y
  });
}

async function dispatchKey(cdp, key) {
  const keyCodeByKey = {
    ArrowDown: 40,
    ArrowUp: 38,
    Enter: 13,
    Escape: 27
  };
  await cdp.send("Input.dispatchKeyEvent", {
    key,
    type: "keyDown",
    windowsVirtualKeyCode: keyCodeByKey[key] ?? 0
  });
  await cdp.send("Input.dispatchKeyEvent", {
    key,
    type: "keyUp",
    windowsVirtualKeyCode: keyCodeByKey[key] ?? 0
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
          : { code: chrome.exitCode, signal: chrome.signalCode },
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
    await wait(200);

    await evaluate(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.loadImportedCopyForTest("command-ui.md", ${JSON.stringify(commandFixture)})`
    );
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("rich")`);
    await waitForSnapshot(
      cdp,
      (snapshot) => snapshot.editorMode === "rich" && snapshot.toolbar.visible === true,
      "rich toolbar loaded"
    );
    await screenshot(cdp, "rich-toolbar-loaded.png");

    await clickByTestId(cdp, "toolbar-more-button");
    await waitForSnapshot(cdp, (snapshot) => snapshot.toolbar.moreOpen === true, "toolbar more menu open");
    await screenshot(cdp, "toolbar-more-menu-open.png");
    await clickByTestId(cdp, "toolbar-more-button");
    await waitForSnapshot(cdp, (snapshot) => snapshot.toolbar.moreOpen === false, "toolbar more menu closed");

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.setRichSelectionAfterText("Command title")`);
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.openSlashMenuForTest("heading")`);
    await dispatchKey(cdp, "ArrowDown");
    await waitForSnapshot(
      cdp,
      (snapshot) => snapshot.slash.open === true && snapshot.slash.selectedId === "heading2",
      "slash keyboard navigation"
    );
    await screenshot(cdp, "slash-menu-keyboard-navigation.png");
    await dispatchKey(cdp, "Escape");
    await waitForSnapshot(cdp, (snapshot) => snapshot.slash.open === false, "slash keyboard close");

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.setRichSelectionAfterText("Command title")`);
    await cdp.send("Input.insertText", { text: "/h1" });
    await waitForSnapshot(
      cdp,
      (snapshot) => snapshot.slash.open === true && snapshot.slash.items.includes("heading1"),
      "slash heading query"
    );
    await screenshot(cdp, "slash-menu-heading-query.png");

    await dispatchKey(cdp, "Enter");
    await waitForSnapshot(
      cdp,
      (snapshot) => String(snapshot.markdown).includes("# Command title"),
      "heading command applied"
    );
    await screenshot(cdp, "heading-command-applied.png");

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.setRichSelectionAfterText("Task target")`);
    await clickByTestId(cdp, "toolbar-command-todo");
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.setRichSelectionAfterText("const answer = 42;")`);
    await clickByTestId(cdp, "toolbar-command-codeBlock");
    const final = await waitForSnapshot(
      cdp,
      (snapshot) =>
        String(snapshot.markdown).includes("- [ ] Task target") &&
        String(snapshot.markdown).includes("```\nconst answer = 42;\n```") &&
        String(snapshot.parserStatus).includes("pass") &&
        String(snapshot.serializerStatus).includes("pass"),
      "toolbar todo and code applied"
    );
    if (!String(final.markdown).includes("---\ntitle: Command UI Fixture\n---")) {
      throw new Error("Frontmatter did not survive command UI scenario.");
    }
    await screenshot(cdp, "toolbar-todo-code-applied.png");

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.setRichSelectionAfterText("const answer = 42;")`);
    await cdp.send("Input.insertText", { text: "/bold" });
    await waitForSnapshot(
      cdp,
      (snapshot) => snapshot.slash.open === true && snapshot.slash.items.includes("bold"),
      "unsupported slash command in code block"
    );
    await dispatchKey(cdp, "Enter");
    await waitForSnapshot(
      cdp,
      (snapshot) => snapshot.slash.open === false && String(snapshot.markdown).includes("const answer = 42;/bold"),
      "unsupported slash command remains a no-op"
    );

    cdp.close();
    console.log(`MME-0013 visual artifacts saved to ${visualDir}`);
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
