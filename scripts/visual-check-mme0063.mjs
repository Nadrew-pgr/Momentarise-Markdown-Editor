import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { requireChromeExecutable } from "./chrome-helpers.mjs";

const demoUrl = process.env.MME_DEMO_URL ?? "http://127.0.0.1:5174/";
const visualDir = "docs/internal/visual-checks/MME-0063";
const port = 18900 + Math.floor(Math.random() * 500);
const userDataDir = `/tmp/mme-visual-0063-${Date.now()}`;

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
    this.handlers = new Map();
    this.nextId = 1;
    this.pending = new Map();
    this.socket = socket;
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const pending = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result ?? {});
        return;
      }
      const handlers = this.handlers.get(message.method);
      if (handlers?.length) handlers.shift()(message.params ?? {});
    });
  }

  close() {
    this.socket.close();
  }

  once(method) {
    return new Promise((resolve) => {
      const handlers = this.handlers.get(method) ?? [];
      handlers.push(resolve);
      this.handlers.set(method, handlers);
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    this.socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { reject, resolve }));
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForJson(url, chrome, stderr) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 30000) {
    if (chrome.exitCode !== null || chrome.signalCode !== null) {
      throw new Error(`Chrome exited before CDP became available.\n${stderr()}`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch {}
    await wait(100);
  }
  throw new Error(`Timed out waiting for ${url}.`);
}

async function evaluate(cdp, expression) {
  const result = await cdp.send("Runtime.evaluate", {
    awaitPromise: true,
    expression,
    returnByValue: true
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  }
  return result.result.value;
}

async function waitFor(cdp, expression, label) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 8000) {
    if (await evaluate(cdp, expression)) return;
    await wait(100);
  }
  throw new Error(`Timed out waiting for ${label}.`);
}

async function screenshot(cdp, name) {
  const result = await cdp.send("Page.captureScreenshot", {
    captureBeyondViewport: false,
    format: "png",
    fromSurface: true
  });
  await writeFile(join(visualDir, name), Buffer.from(result.data, "base64"));
}

async function pressUndo(cdp, redo = false) {
  const modifiers = 4 | (redo ? 8 : 0);
  const params = {
    code: "KeyZ",
    key: "z",
    modifiers,
    nativeVirtualKeyCode: 90,
    windowsVirtualKeyCode: 90
  };
  await cdp.send("Input.dispatchKeyEvent", { ...params, type: "rawKeyDown" });
  await cdp.send("Input.dispatchKeyEvent", { ...params, type: "keyUp" });
}

async function main() {
  await mkdir(visualDir, { recursive: true });
  const source = await readFile("fixtures/027-task-list-footnote-editing/input.md", "utf8");
  const editedSource = source.replace("Edit deepest task", "Edited deepest task");
  const toggledSource = editedSource.replace("- [ ] Edited deepest task", "- [x] Edited deepest task");
  const chrome = spawn(requireChromeExecutable(), [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-networking",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    "--window-size=1360,900",
    "about:blank"
  ], { stdio: ["ignore", "ignore", "pipe"] });
  const chromeExit = new Promise((resolve) => chrome.once("exit", resolve));
  let stderr = "";
  chrome.stderr.on("data", (chunk) => { stderr += chunk.toString(); });

  try {
    const version = await waitForJson(`http://127.0.0.1:${port}/json/version`, chrome, () => stderr);
    const browser = await CdpClient.connect(version.webSocketDebuggerUrl);
    const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" });
    browser.close();
    const targets = await waitForJson(`http://127.0.0.1:${port}/json/list`, chrome, () => stderr);
    const target = targets.find((candidate) => candidate.id === targetId);
    assert(target?.webSocketDebuggerUrl, "Page target unavailable.");
    const cdp = await CdpClient.connect(target.webSocketDebuggerUrl);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    const loaded = cdp.once("Page.loadEventFired");
    await cdp.send("Page.navigate", { url: demoUrl });
    await loaded;
    await waitFor(cdp, "Boolean(window.__MME_DEMO_VISUAL_CHECK__?.typeRichTextForTest)", "demo hooks");

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.loadWritableMarkdownFileForTest("task-list-footnotes.md", ${JSON.stringify(source)})`);
    await evaluate(cdp, 'window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("rich")');
    await waitFor(cdp, `(() => {
      const editor = document.querySelector('[data-testid="rich-editor-host"] .ProseMirror');
      return Boolean(editor?.textContent?.includes("Edit deepest task"));
    })()`, "task-list Rich content");
    const mounted = await evaluate(cdp, `(() => {
      const editor = document.querySelector('[data-testid="rich-editor-host"] .ProseMirror');
      const flat = editor?.querySelector('[data-mme-footnote-definition="true"][data-mme-footnote-identifier="task-flat"]');
      const nested = editor?.querySelector('[data-mme-footnote-definition="true"][data-mme-footnote-identifier="task-nested"]');
      const ordered = editor?.querySelector('[data-mme-footnote-definition="true"][data-mme-footnote-identifier="task-ordered"]');
      const buttons = Array.from(editor?.querySelectorAll('[data-todo-toggle]') ?? []);
      return {
        buttons: buttons.length,
        checked: buttons.filter((button) => button.getAttribute('aria-pressed') === 'true').length,
        completeLabels: buttons.filter((button) => button.getAttribute('aria-label') === 'Mark todo complete').length,
        fallbacks: editor?.querySelectorAll('[data-mme-preserved-footnote="true"]').length ?? 0,
        flatTodos: flat?.querySelectorAll('[data-type="todo-item"]').length ?? 0,
        incompleteLabels: buttons.filter((button) => button.getAttribute('aria-label') === 'Mark todo incomplete').length,
        nestedLists: nested?.querySelectorAll('ul, ol').length ?? 0,
        nestedTodos: nested?.querySelectorAll('[data-type="todo-item"]').length ?? 0,
        orderedStart: ordered?.querySelector('ol')?.getAttribute('start') ?? null,
        orderedTodos: ordered?.querySelectorAll('[data-type="todo-item"]').length ?? 0
      };
    })()`);
    assert(
      mounted.flatTodos === 2 &&
      mounted.nestedTodos === 3 &&
      mounted.orderedTodos === 2 &&
      mounted.nestedLists >= 3 &&
      mounted.orderedStart === "3" &&
      mounted.buttons === 7 &&
      mounted.checked >= 4 &&
      mounted.completeLabels >= 1 &&
      mounted.incompleteLabels >= 1 &&
      mounted.fallbacks >= 5,
      `Task-list mount incomplete: ${JSON.stringify(mounted)}`
    );
    assert(await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getMarkdown() === ${JSON.stringify(source)}`), "Untouched Rich mount changed source bytes.");
    await screenshot(cdp, "footnote-task-list-rich-desktop.png");

    await evaluate(cdp, 'window.__MME_DEMO_VISUAL_CHECK__.selectRichTextForTest("Edit deepest task")');
    await evaluate(cdp, 'window.__MME_DEMO_VISUAL_CHECK__.typeRichTextForTest("Edited deepest task")');
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getMarkdown() === ${JSON.stringify(editedSource)}`, "task text edit");
    const edited = await evaluate(cdp, "window.__MME_DEMO_VISUAL_CHECK__.getMarkdown()");
    assert(edited === editedSource, "Task text edit changed unrelated Markdown bytes.");

    await pressUndo(cdp);
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getMarkdown() === ${JSON.stringify(source)}`, "undo");
    await pressUndo(cdp, true);
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getMarkdown() === ${JSON.stringify(editedSource)}`, "redo");

    const pointerTarget = await evaluate(cdp, `(() => {
      const items = Array.from(document.querySelectorAll('[data-type="todo-item"]'));
      const item = items.find((candidate) => candidate.textContent?.includes('Edited deepest task'));
      const button = item?.querySelector('[data-todo-toggle]');
      if (!button) return null;
      const rect = button.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    })()`);
    assert(pointerTarget, "Deep task pointer control unavailable.");
    await cdp.send("Input.dispatchMouseEvent", { button: "left", clickCount: 1, type: "mousePressed", ...pointerTarget });
    await cdp.send("Input.dispatchMouseEvent", { button: "left", clickCount: 1, type: "mouseReleased", ...pointerTarget });
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getMarkdown() === ${JSON.stringify(toggledSource)}`, "pointer task toggle");
    assert(await evaluate(cdp, `(() => {
      const items = Array.from(document.querySelectorAll('[data-type="todo-item"]'));
      const item = items.find((candidate) => candidate.textContent?.includes('Edited deepest task'));
      const button = item?.querySelector('[data-todo-toggle]');
      return button?.getAttribute('aria-pressed') === 'true' && button?.getAttribute('aria-label') === 'Mark todo incomplete';
    })()`), "Pointer toggle did not update accessible state.");
    await screenshot(cdp, "footnote-task-list-toggled-desktop.png");

    await evaluate(cdp, `document.querySelector('[data-testid="rich-editor-host"] .ProseMirror')?.focus()`);
    await pressUndo(cdp);
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getMarkdown() === ${JSON.stringify(editedSource)}`, "pointer-toggle undo");
    await pressUndo(cdp, true);
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getMarkdown() === ${JSON.stringify(toggledSource)}`, "pointer-toggle redo");

    assert(await evaluate(cdp, `(() => {
      const items = Array.from(document.querySelectorAll('[data-type="todo-item"]'));
      const item = items.find((candidate) => candidate.textContent?.includes('Edited deepest task'));
      const button = item?.querySelector('[data-todo-toggle]');
      button?.focus();
      return document.activeElement === button;
    })()`), "Deep task control could not receive keyboard focus.");
    await cdp.send("Input.dispatchKeyEvent", { code: "Enter", key: "Enter", type: "rawKeyDown", windowsVirtualKeyCode: 13 });
    await cdp.send("Input.dispatchKeyEvent", { code: "Enter", key: "Enter", type: "keyUp", windowsVirtualKeyCode: 13 });
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getMarkdown() === ${JSON.stringify(editedSource)}`, "keyboard task toggle");
    await evaluate(cdp, `document.querySelector('[data-testid="rich-editor-host"] .ProseMirror')?.focus()`);
    await pressUndo(cdp);
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getMarkdown() === ${JSON.stringify(toggledSource)}`, "keyboard-toggle undo");
    await pressUndo(cdp, true);
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getMarkdown() === ${JSON.stringify(editedSource)}`, "keyboard-toggle redo");

    assert(await evaluate(cdp, `(() => {
      const items = Array.from(document.querySelectorAll('[data-type="todo-item"]'));
      const item = items.find((candidate) => candidate.textContent?.includes('Edited deepest task'));
      const button = item?.querySelector('[data-todo-toggle]');
      button?.focus();
      return document.activeElement === button;
    })()`), "Deep task control could not regain keyboard focus.");
    await cdp.send("Input.dispatchKeyEvent", { code: "Enter", key: "Enter", type: "rawKeyDown", windowsVirtualKeyCode: 13 });
    await cdp.send("Input.dispatchKeyEvent", { code: "Enter", key: "Enter", type: "keyUp", windowsVirtualKeyCode: 13 });
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getMarkdown() === ${JSON.stringify(toggledSource)}`, "final keyboard task toggle");
    await evaluate(cdp, 'window.__MME_DEMO_VISUAL_CHECK__.memorySave("button")');
    await waitFor(cdp, 'window.__MME_DEMO_VISUAL_CHECK__.getSaveState().status === "saved"', "saved state");
    assert(await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getTestDiskContent() === ${JSON.stringify(toggledSource)}`), "Saved content differs from Source Markdown.");
    await screenshot(cdp, "footnote-task-list-saved-desktop.png");

    await evaluate(cdp, `document.querySelector('[data-mme-preserved-footnote="true"]')?.scrollIntoView({ block: "center" })`);
    await wait(150);
    await screenshot(cdp, "footnote-task-list-unsupported-desktop.png");

    await cdp.send("Emulation.setDeviceMetricsOverride", { deviceScaleFactor: 1, height: 844, mobile: true, width: 390 });
    await wait(250);
    const constrained = await evaluate(cdp, `(() => {
      const host = document.querySelector('[data-testid="rich-editor-host"]');
      const detail = host?.querySelector('[data-mme-footnote-definition="true"]');
      const fallback = host?.querySelector('[data-mme-preserved-footnote="true"]');
      const h = host?.getBoundingClientRect();
      const d = detail?.getBoundingClientRect();
      const f = fallback?.getBoundingClientRect();
      return Boolean(h && d && f && d.width > 0 && d.height > 0 && f.width > 0 && f.height > 0 && d.right <= h.right + 1 && f.right <= h.right + 1);
    })()`);
    assert(constrained, "Footnote content overflowed the constrained editor.");
    await screenshot(cdp, "footnote-task-list-constrained.png");

    await cdp.send("Emulation.clearDeviceMetricsOverride");
    await evaluate(cdp, 'window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("source")');
    await waitFor(cdp, 'window.__MME_DEMO_VISUAL_CHECK__.getEditorMode() === "source"', "Source mode");
    assert(await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getMarkdown() === ${JSON.stringify(toggledSource)}`), "Source mode lost the edited Markdown.");
    await screenshot(cdp, "footnote-task-list-source-desktop.png");
    cdp.close();
    console.log(`MME-0063 runtime artifacts saved to ${visualDir}`);
  } finally {
    if (chrome.exitCode === null && chrome.signalCode === null) chrome.kill("SIGTERM");
    await Promise.race([chromeExit, wait(2000)]);
    if (chrome.exitCode === null && chrome.signalCode === null) chrome.kill("SIGKILL");
    await Promise.race([chromeExit, wait(2000)]);
    await rm(userDataDir, { force: true, maxRetries: 3, recursive: true, retryDelay: 100 });
  }
}

await main();
