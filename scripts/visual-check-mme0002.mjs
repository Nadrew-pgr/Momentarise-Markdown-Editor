import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { requireChromeExecutable } from "./chrome-helpers.mjs";

const chromePath = requireChromeExecutable();
const demoUrl = process.env.MME_DEMO_URL ?? "http://127.0.0.1:5173/";
const visualDir = "docs/internal/visual-checks/MME-0002";
const port = 9300 + Math.floor(Math.random() * 500);
const userDataDir = `/tmp/mme-visual-${Date.now()}`;
const demoOrigin = new URL(demoUrl).origin;

async function screenshot(cdp, filename) {
  const result = await cdp.send("Page.captureScreenshot", {
    captureBeyondViewport: false,
    format: "png",
    fromSurface: true
  });
  await writeFile(join(visualDir, filename), Buffer.from(result.data, "base64"));
}

async function getMarkdown(cdp) {
  return evaluate(cdp, "window.__MME_DEMO_VISUAL_CHECK__.getMarkdown()");
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

async function press(cdp, key) {
  await cdp.send("Input.dispatchKeyEvent", {
    code: key,
    key,
    type: "keyDown"
  });
  await cdp.send("Input.dispatchKeyEvent", {
    code: key,
    key,
    type: "keyUp"
  });
}

async function keyChord(cdp, key, options = {}) {
  const modifiers = process.platform === "darwin" ? 4 : 2;
  const code = `Key${key.toUpperCase()}`;
  const virtualKeyCode = key.toUpperCase().charCodeAt(0);
  await cdp.send("Input.dispatchKeyEvent", {
    code,
    key,
    modifiers: options.shift ? modifiers | 8 : modifiers,
    nativeVirtualKeyCode: virtualKeyCode,
    type: "keyDown",
    windowsVirtualKeyCode: virtualKeyCode
  });
  await cdp.send("Input.dispatchKeyEvent", {
    code,
    key,
    modifiers: options.shift ? modifiers | 8 : modifiers,
    nativeVirtualKeyCode: virtualKeyCode,
    type: "keyUp",
    windowsVirtualKeyCode: virtualKeyCode
  });
}

async function clickSelector(cdp, selector) {
  const point = await evaluate(
    cdp,
    `(() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element) throw new Error("Missing selector: ${selector}");
      const rect = element.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    })()`
  );
  await cdp.send("Input.dispatchMouseEvent", {
    button: "left",
    clickCount: 1,
    type: "mousePressed",
    x: point.x,
    y: point.y
  });
  await cdp.send("Input.dispatchMouseEvent", {
    button: "left",
    clickCount: 1,
    type: "mouseReleased",
    x: point.x,
    y: point.y
  });
}

function assertIncludes(value, expected, label) {
  if (!String(value).includes(expected)) {
    throw new Error(`Expected ${label} to include ${JSON.stringify(expected)}.`);
  }
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
    this.nextId = 1;
    this.pending = new Map();
    this.events = new Map();
    this.socket = socket;
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
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

  once(method) {
    return new Promise((resolve) => {
      const handlers = this.events.get(method) ?? [];
      handlers.push(resolve);
      this.events.set(method, handlers);
    });
  }

  close() {
    this.socket.close();
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
      "--window-size=1280,720",
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
    await cdp.send("Browser.grantPermissions", {
      origin: demoOrigin,
      permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"]
    });

    const loadEvent = cdp.once("Page.loadEventFired");
    await cdp.send("Page.navigate", {
      url: demoUrl
    });
    await loadEvent;
    await wait(200);
    await screenshot(cdp, "initial-demo-loaded.png");

    await evaluate(cdp, "window.__MME_DEMO_VISUAL_CHECK__.setCursorToEnd()");
    await cdp.send("Input.insertText", {
      text: "\n\n## Visual smoke\n\n- typed list item"
    });
    await press(cdp, "Enter");
    await cdp.send("Input.insertText", {
      text: "continued list item\n- [ ] typed todo item"
    });
    await press(cdp, "Enter");
    await cdp.send("Input.insertText", {
      text:
        "continued todo item\n\n`inline` and {paired} [brackets] (round) \"quotes\" `backticks`\n"
    });
    await wait(100);
    await screenshot(cdp, "editor-after-typing-markdown.png");

    const markdownAfterTyping = await getMarkdown(cdp);
    assertIncludes(markdownAfterTyping, "- [ ] typed todo item", "typed todo item");
    assertIncludes(markdownAfterTyping, "- continued list item", "list continuation");
    assertIncludes(markdownAfterTyping, "- [ ] continued todo item", "checkbox continuation");

    await evaluate(cdp, "window.__MME_DEMO_VISUAL_CHECK__.setSelection(0, 12)");
    const hasSelection = await evaluate(
      cdp,
      "!window.__MME_DEMO_VISUAL_CHECK__.editor.state.selection.main.empty"
    );
    if (!hasSelection) {
      throw new Error("Selection verification failed: CodeMirror selection is empty.");
    }
    await evaluate(cdp, "document.querySelector('[data-testid=\"copy-button\"]').click()");
    await wait(100);
    let copied = await evaluate(cdp, "navigator.clipboard.readText()");
    if (typeof copied !== "string" || copied.length === 0) {
      copied = await evaluate(cdp, "window.__MME_DEMO_VISUAL_CHECK__.getLastCopiedMarkdown()");
    }
    if (typeof copied !== "string" || copied.length === 0) {
      throw new Error("Copy verification failed: clipboard was empty.");
    }

    await evaluate(cdp, "window.__MME_DEMO_VISUAL_CHECK__.setCursorToEnd()");
    const pastedText = "\nPasted from visual check\n";
    await evaluate(
      cdp,
      `(() => {
        const data = new DataTransfer();
        data.setData("text/plain", ${JSON.stringify(pastedText)});
        const event = new ClipboardEvent("paste", {
          bubbles: true,
          cancelable: true,
          clipboardData: data
        });
        document.querySelector(".cm-content").dispatchEvent(event);
      })()`
    );
    await wait(100);
    assertIncludes(await getMarkdown(cdp), "Pasted from visual check", "pasted text");

    await keyChord(cdp, "z");
    await wait(100);
    if ((await getMarkdown(cdp)).includes("Pasted from visual check")) {
      throw new Error("Undo verification failed: pasted text still present.");
    }

    await keyChord(cdp, "z", { shift: true });
    await wait(100);
    assertIncludes(await getMarkdown(cdp), "Pasted from visual check", "redo restored pasted text");
    await screenshot(cdp, "dirty-state-after-edit.png");

    await keyChord(cdp, "s");
    await wait(100);
    const eventLog = await evaluate(
      cdp,
      "document.querySelector('[data-testid=\"event-log\"]').innerText"
    );
    assertIncludes(eventLog, "keyboard shortcut", "save shortcut event log");
    await screenshot(cdp, "save-shortcut-event-log.png");

    await cdp.close();
    console.log(`MME-0002 visual artifacts saved to ${visualDir}`);
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
    await rm(userDataDir, {
      force: true,
      maxRetries: 3,
      recursive: true,
      retryDelay: 100
    });
  }
}

await main();
