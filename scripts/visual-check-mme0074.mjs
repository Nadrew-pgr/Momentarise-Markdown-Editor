import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { requireChromeExecutable } from "./chrome-helpers.mjs";

const chromePath = requireChromeExecutable();
const demoUrl = process.env.MME_DEMO_URL ?? "http://127.0.0.1:5174/";
const visualDir = "docs/internal/visual-checks/MME-0074";
const port = 22000 + Math.floor(Math.random() * 500);
const userDataDir = `/tmp/mme-visual-0074-${Date.now()}`;
const fixturePath = "fixtures/038-table-reorder/input.md";

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
        const pending = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) {
          pending.reject(new Error(message.error.message));
        } else {
          pending.resolve(message.result ?? {});
        }
        return;
      }
      const handlers = this.events.get(message.method);
      if (handlers) {
        for (const handler of handlers.splice(0)) {
          handler(message.params ?? {});
        }
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

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
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

async function pressKey(cdp, key, { metaKey = false, shiftKey = false } = {}) {
  const modifiers = (metaKey ? 4 : 0) | (shiftKey ? 8 : 0);
  const code = key === "Tab" || key === "Enter" ? key : `Key${key.toUpperCase()}`;
  const virtualKeyCode = key === "Tab" ? 9 : key === "Enter" ? 13 : key.toUpperCase().charCodeAt(0);
  const params = {
    code,
    key,
    modifiers,
    nativeVirtualKeyCode: virtualKeyCode,
    windowsVirtualKeyCode: virtualKeyCode
  };
  await cdp.send("Input.dispatchKeyEvent", { ...params, type: key === "Enter" ? "keyDown" : "rawKeyDown" });
  await cdp.send("Input.dispatchKeyEvent", { ...params, type: "keyUp" });
}

async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForJson(url, options = {}) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 30000) {
    const exitStatus = options.getExitStatus?.();
    if (exitStatus) {
      throw new Error(`Chrome exited before CDP became available (${exitStatus.code ?? exitStatus.signal}).\n${options.getStderr?.() ?? ""}`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) {
        return response.json();
      }
    } catch {}
    await wait(100);
  }
  throw new Error(`Timed out waiting for ${url}.`);
}

async function waitFor(cdp, expression, label) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 8000) {
    if (await evaluate(cdp, expression)) {
      return;
    }
    await wait(100);
  }
  throw new Error(`Timed out waiting for ${label}.`);
}

async function main() {
  await mkdir(visualDir, { recursive: true });
  const source = await readFile(fixturePath, "utf8");
  const rowMovedSource = source.replace(
    "| alpha | 1 | draft | Ada |\n| beta | 2 | **ready** | Ben |",
    "| beta | 2 | **ready** | Ben |\n| alpha | 1 | draft | Ada |"
  );
  const finalSource = rowMovedSource.replace(
    "       | Key | Rank | State |\n       | :--- | ---: | :---: |\n       | ordered one | 1 | ready |\n       | ordered two | 2 | exact |\n       | ordered three | 3 | stable |",
    "       | Rank | Key | State |\n       | ---: | :--- | :---: |\n       | 1 | ordered one | ready |\n       | 2 | ordered two | exact |\n       | 3 | ordered three | stable |"
  );
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
      "--window-size=1360,900",
      "about:blank"
    ],
    { stdio: ["ignore", "ignore", "pipe"] }
  );
  const chromeExit = new Promise((resolve) => chrome.once("exit", resolve));
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
    await waitFor(cdp, `Boolean(window.__MME_DEMO_VISUAL_CHECK__?.loadWritableMarkdownFileForTest)`, "demo hooks");

    await evaluate(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.loadWritableMarkdownFileForTest("table-reorder-operations.md", ${JSON.stringify(source)})`
    );
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("rich")`);
    await waitFor(
      cdp,
      `(() => {
        const editor = document.querySelector('[data-testid="rich-editor-host"] .ProseMirror');
        return Boolean(editor?.querySelector('[data-mme-footnote-identifier="wide"] table'));
      })()`,
      "semantic table footnotes"
    );
    const mounted = await evaluate(cdp, `(() => {
      const editor = document.querySelector('[data-testid="rich-editor-host"] .ProseMirror');
      const definition = (identifier) => editor?.querySelector('[data-mme-footnote-definition="true"][data-mme-footnote-identifier="' + identifier + '"]');
      return {
        buttons: editor?.querySelectorAll('[data-todo-toggle]').length ?? 0,
        definitions: editor?.querySelectorAll('[data-mme-footnote-definition="true"]').length ?? 0,
        fallbacks: editor?.querySelectorAll('[data-mme-preserved-footnote="true"]').length ?? 0,
        orderedStart: definition('ordered')?.querySelector('ol')?.getAttribute('start') ?? null,
        roles: editor?.querySelectorAll('[data-mme-footnote-definition="true"][role="doc-footnote"]').length ?? 0,
        scriptElements: editor?.querySelectorAll('script').length ?? 0,
        tables: editor?.querySelectorAll('[data-mme-footnote-definition="true"] table').length ?? 0,
        rootRows: editor?.querySelector(':scope > table')?.querySelectorAll('tr').length ?? 0,
        directRows: definition('direct')?.querySelectorAll('tr').length ?? 0,
        orderedRows: definition('ordered')?.querySelectorAll('tr').length ?? 0,
        taskRows: definition('task')?.querySelectorAll('tr').length ?? 0,
        wideHeaders: definition('wide')?.querySelectorAll('th').length ?? 0
      };
    })()`);
    assert(
      mounted.definitions === 4 &&
      mounted.roles === 4 &&
      mounted.tables === 4 &&
      mounted.rootRows === 4 &&
      mounted.directRows === 4 &&
      mounted.orderedRows === 4 &&
      mounted.taskRows === 4 &&
      mounted.wideHeaders === 8 &&
      mounted.orderedStart === "3" &&
      mounted.buttons === 2 &&
      mounted.fallbacks === 2 &&
      mounted.scriptElements === 0 &&
      await evaluate(cdp, "window.__MME_TABLE_FOOTNOTE_RAN__ !== true"),
      `Table-reorder mount incomplete: ${JSON.stringify(mounted)}`
    );
    assert(await evaluate(cdp, `(() => {
      const html = document.querySelector('[data-testid="rich-editor-host"] .ProseMirror')?.innerHTML ?? '';
      return !html.includes('blockSources') && !html.includes('blockFingerprints');
    })()`), "Source metadata leaked into editor DOM.");
    assert(await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getMarkdown() === ${JSON.stringify(source)}`), "Untouched Rich mount changed source bytes.");
    await evaluate(cdp, `document.querySelector('[data-testid="toolbar-more-button"]')?.click()`);
    const unavailableActions = await evaluate(cdp, `(() => {
      const ids = ['mme:tableRowUp', 'mme:tableRowDown', 'mme:tableColumnLeft', 'mme:tableColumnRight'];
      return ids.map((id) => {
        const button = document.querySelector('[data-toolbar-command-id="' + id + '"]');
        return { disabled: button?.disabled ?? null, label: button?.textContent?.trim() ?? null };
      });
    })()`);
    assert(
      unavailableActions.every((action) => action.disabled === true) &&
      unavailableActions.map((action) => action.label).join("|") === "Move row up|Move row down|Move column left|Move column right",
      `Reorder commands must be labelled and unavailable outside tables: ${JSON.stringify(unavailableActions)}`
    );
    await screenshot(cdp, "table-reorder-commands-unavailable.png");
    await evaluate(cdp, `document.querySelector('[data-testid="toolbar-more-button"]')?.click()`);

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.selectRichTableCellForTest(1, 0, 0)`);
    await evaluate(cdp, `document.querySelectorAll('[data-testid="rich-editor-host"] .ProseMirror table')[0]?.scrollIntoView({ block: "center" })`);
    await wait(150);
    assert(await evaluate(cdp, `(() => {
      const table = document.querySelectorAll('[data-testid="rich-editor-host"] .ProseMirror table')[0];
      const rect = table?.getBoundingClientRect();
      return Boolean(rect && rect.bottom > 100 && rect.top < window.innerHeight);
    })()`), "Boundary table must be visible in its visual proof.");
    await evaluate(cdp, `document.querySelector('[data-testid="toolbar-more-button"]')?.click()`);
    const protectedActions = await evaluate(cdp, `(() => {
      const ids = ['mme:tableRowUp', 'mme:tableRowDown', 'mme:tableColumnLeft', 'mme:tableColumnRight'];
      return ids.map((id) => document.querySelector('[data-toolbar-command-id="' + id + '"]')?.disabled ?? null);
    })()`);
    assert(
      protectedActions[0] === true && protectedActions[1] === false && protectedActions[2] === true && protectedActions[3] === false,
      `First body-row/column boundaries must be disabled: ${JSON.stringify(protectedActions)}`
    );
    await screenshot(cdp, "table-reorder-boundaries.png");
    await evaluate(cdp, `document.querySelector('[data-testid="toolbar-more-button"]')?.click()`);

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.selectRichTableCellForTest(2, 1, 0)`);
    await evaluate(cdp, `document.querySelectorAll('[data-testid="rich-editor-host"] .ProseMirror table')[0]?.scrollIntoView({ block: "center" })`);
    await wait(150);
    assert(await evaluate(cdp, `(() => {
      const table = document.querySelectorAll('[data-testid="rich-editor-host"] .ProseMirror table')[0];
      const rect = table?.getBoundingClientRect();
      return Boolean(rect && rect.bottom > 100 && rect.top < window.innerHeight);
    })()`), "Enabled table must be visible in its visual proof.");
    await evaluate(cdp, `document.querySelector('[data-testid="toolbar-more-button"]')?.click()`);
    const enabledActions = await evaluate(cdp, `(() => {
      const ids = ['mme:tableRowUp', 'mme:tableRowDown', 'mme:tableColumnLeft', 'mme:tableColumnRight'];
      return ids.map((id) => document.querySelector('[data-toolbar-command-id="' + id + '"]')?.disabled ?? null);
    })()`);
    assert(enabledActions.every((disabled) => disabled === false), `Table-reorder commands must be enabled: ${JSON.stringify(enabledActions)}`);
    await screenshot(cdp, "table-reorder-commands-enabled.png");
    await evaluate(cdp, `document.querySelector('[data-testid="toolbar-more-button"]')?.click()`);

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.selectRichTableCellForTest(1, 0, 0)`);
    await evaluate(cdp, `document.querySelector('[data-testid="toolbar-more-button"]')?.click()`);
    assert(await evaluate(cdp, `(() => {
      const button = document.querySelector('[data-toolbar-command-id="mme:tableRowDown"]');
      button?.focus();
      return button === document.activeElement && button?.disabled === false;
    })()`), "Move row down must be keyboard-focusable and available.");
    await pressKey(cdp, "Enter");
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getMarkdown() === ${JSON.stringify(rowMovedSource)}`, "root row movement");
    await screenshot(cdp, "table-row-moved.png");

    await pressKey(cdp, "z", { metaKey: true });
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getMarkdown() === ${JSON.stringify(source)}`, "row movement undo");
    await pressKey(cdp, "z", { metaKey: true, shiftKey: true });
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getMarkdown() === ${JSON.stringify(rowMovedSource)}`, "row movement redo");
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.selectRichTableCellForTest(1, 0, 2)`);
    assert(await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.runRichCommand("tableColumnRight")`), "Nested column-right command was not handled.");
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getMarkdown() === ${JSON.stringify(finalSource)}`, "nested column movement");
    await screenshot(cdp, "table-column-moved.png");

    await wait(750);
    await pressKey(cdp, "z", { metaKey: true });
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getMarkdown() === ${JSON.stringify(rowMovedSource)}`, "column movement undo");
    await pressKey(cdp, "z", { metaKey: true, shiftKey: true });
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getMarkdown() === ${JSON.stringify(finalSource)}`, "column movement redo");
    await wait(750);
    assert(await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.runRichCommand("tableColumnAfter")`), "Existing insert-column command failed after reorder.");
    await pressKey(cdp, "z", { metaKey: true });
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getMarkdown() === ${JSON.stringify(finalSource)}`, "post-reorder column insertion undo");
    await wait(750);
    assert(await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.runRichCommand("tableRowAfter")`), "Existing insert-row command failed after reorder.");
    await pressKey(cdp, "z", { metaKey: true });
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getMarkdown() === ${JSON.stringify(finalSource)}`, "post-reorder row insertion undo");

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.memorySave("button")`);
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getSaveState().status === "saved"`, "saved state");
    assert(await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getTestDiskContent() === ${JSON.stringify(finalSource)}`), "Saved content differs from Source Markdown.");
    await screenshot(cdp, "table-reorder-saved-desktop.png");

    assert(await evaluate(cdp, `(() => {
      const fallbacks = Array.from(document.querySelectorAll('[data-mme-preserved-footnote="true"]'));
      const quote = fallbacks.find((element) => element.textContent?.includes('[^quote-table]:'));
      const malformed = fallbacks.find((element) => element.textContent?.includes('[^malformed-table]:'));
      return quote?.getAttribute('aria-label') === 'Preserved Markdown footnote. Edit in Source mode.' && Boolean(malformed);
    })()`), "Table fallback was not explicit and accessible.");
    await evaluate(cdp, `Array.from(document.querySelectorAll('[data-mme-preserved-footnote="true"]')).find((element) => element.textContent?.includes('[^quote-table]:'))?.scrollIntoView({ block: "center" })`);
    await wait(150);
    await screenshot(cdp, "table-reorder-unsupported-desktop.png");

    await cdp.send("Emulation.setDeviceMetricsOverride", {
      deviceScaleFactor: 1,
      height: 844,
      mobile: true,
      width: 390
    });
    await wait(250);
    const constrained = await evaluate(cdp, `(() => {
      const host = document.querySelector('[data-testid="rich-editor-host"]');
      const editor = host?.querySelector('.ProseMirror');
      const definitions = Array.from(editor?.querySelectorAll('[data-mme-footnote-definition="true"]') ?? []);
      const ordinaryTables = ['direct', 'ordered', 'task'].map((identifier) =>
        editor?.querySelector('[data-mme-footnote-definition="true"][data-mme-footnote-identifier="' + identifier + '"] table')
      );
      const fallback = editor?.querySelector('[data-mme-preserved-footnote="true"]');
      const hostRect = host?.getBoundingClientRect();
      const fallbackRect = fallback?.getBoundingClientRect();
      return {
        contained: Boolean(
          hostRect && fallbackRect && definitions.length === 4 && ordinaryTables.every(Boolean) &&
          fallbackRect.right <= hostRect.right + 1 &&
          definitions.every((definition) => definition.getBoundingClientRect().right <= hostRect.right + 1) &&
          ordinaryTables.every((table) => table.getBoundingClientRect().width > 0)
        ),
        noPageOverflow: document.documentElement.scrollWidth <= window.innerWidth + 1,
        overflow: Boolean(host && host.scrollWidth > host.clientWidth + 1)
      };
    })()`);
    assert(constrained.contained, "Table-reorder content escaped constrained editor bounds.");
    assert(constrained.noPageOverflow, "Wide nested table caused page-level overflow.");
    assert(constrained.overflow, "Wide nested table must expose editor-local horizontal overflow.");
    await screenshot(cdp, "table-reorder-constrained.png");

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.selectRichTableCellForTest(1, 7, 4)`);
    const wideTable = await evaluate(cdp, `(() => {
      const host = document.querySelector('[data-testid="rich-editor-host"]');
      const editor = host?.querySelector('.ProseMirror');
      const table = editor?.querySelector('[data-mme-footnote-definition="true"][data-mme-footnote-identifier="wide"] table');
      const selectedCell = table?.querySelector('.selectedCell');
      if (!host || !editor || !table || !selectedCell) return null;
      host.scrollLeft = host.scrollWidth;
      const hostRect = host.getBoundingClientRect();
      const tableRect = table.getBoundingClientRect();
      const selectedCellRect = selectedCell.getBoundingClientRect();
      return {
        focusVisible: editor.matches(':focus-visible'),
        reachesEnd: tableRect.right <= hostRect.right + 1,
        selectedCellVisible: selectedCellRect.left >= hostRect.left - 1 && selectedCellRect.right <= hostRect.right + 1,
        selectedCellShadow: getComputedStyle(selectedCell, '::after').boxShadow
      };
    })()`);
    assert(wideTable?.reachesEnd, "Wide table end must remain reachable after editor-local scrolling.");
    assert(wideTable?.selectedCellVisible, "Selected final column must be visible at the reachable table edge.");
    assert(wideTable?.focusVisible, "Keyboard-focused nested table must retain editor focus visibility.");
    assert(wideTable?.selectedCellShadow !== "none", "Selected nested table cell must retain a visible focus indicator.");
    await screenshot(cdp, "table-reorder-wide-constrained.png");

    await cdp.send("Emulation.clearDeviceMetricsOverride");
    await evaluate(cdp, `document.querySelector('[data-testid="rich-editor-host"]')?.scrollTo({ left: 0 })`);
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("source")`);
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getEditorMode() === "source"`, "source mode restored");
    assert(await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getMarkdown() === ${JSON.stringify(finalSource)}`), "Source/Rich switch lost exact edited Markdown.");
    await screenshot(cdp, "table-reorder-source-desktop.png");
    cdp.close();
    console.log(`MME-0074 runtime artifacts saved to ${visualDir}`);
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
    await rm(userDataDir, { force: true, maxRetries: 3, recursive: true, retryDelay: 100 });
  }
}

await main();
