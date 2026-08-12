import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { requireChromeExecutable } from "./chrome-helpers.mjs";

const chromePath = requireChromeExecutable();
const demoUrl = process.env.MME_DEMO_URL ?? "http://127.0.0.1:5174/";
const visualDir = "docs/internal/visual-checks/MME-0055";
const port = 17900 + Math.floor(Math.random() * 500);
const userDataDir = `/tmp/mme-visual-0055-${Date.now()}`;
const fixturePath = "fixtures/019-gfm-table-variants/input.md";

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
  const code = key === "Tab" ? "Tab" : `Key${key.toUpperCase()}`;
  const virtualKeyCode = key === "Tab" ? 9 : key.toUpperCase().charCodeAt(0);
  const params = {
    code,
    key,
    modifiers,
    nativeVirtualKeyCode: virtualKeyCode,
    windowsVirtualKeyCode: virtualKeyCode
  };
  await cdp.send("Input.dispatchKeyEvent", { ...params, type: "rawKeyDown" });
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
  const malformed = [
    "| broken table-like block | should stay raw |",
    "| missing delimiter row |",
    "| too | many | cells |"
  ].join("\n");
  const wideSource = [
    "| Alpha | Bravo | Charlie | Delta | Echo | Foxtrot | Golf | Hotel |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    "| one | two | three | four | five | six | seven | eight |"
  ].join("\n");
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
      `window.__MME_DEMO_VISUAL_CHECK__.loadWritableMarkdownFileForTest("rich-table.md", ${JSON.stringify(source)})`
    );
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("rich")`);
    await waitFor(
      cdp,
      `(() => {
        const editor = document.querySelector('[data-testid="rich-editor-host"] .ProseMirror');
        const table = editor?.querySelector("table");
        const malformedFallback = editor?.querySelector('[data-mme-preserved-table="true"]');
        return Boolean(
          table &&
          table.querySelectorAll("th").length === 3 &&
          table.querySelectorAll("td").length === 9 &&
          malformedFallback?.textContent.includes("broken table-like block")
        );
      })()`,
      "editable table and malformed fallback"
    );
    assert(await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getMarkdown() === ${JSON.stringify(source)}`), "Untouched rich mount must preserve source bytes.");
    await screenshot(cdp, "table-editable-desktop.png");

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.setRichSelectionForText("preserved")`);
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.typeRichTextForTest("edited")`);
    await waitFor(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.getMarkdown().includes("| Escaped \\\\| pipe | Editor | edited |")`,
      "completed table cell edit"
    );
    await pressKey(cdp, "Tab");
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.typeRichTextForTest("Tab ")`);
    const editedMarkdown = await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getMarkdown()`);
    /*
     * MME-0116: this expected `| Tab | Parser | ready |`. The typed text is
     * `"Tab "` with a trailing space, and MME-0080 added edge-whitespace
     * encoding, so the cell correctly serialises as `Tab&#32;` — the entity is
     * the feature. Expecting the bare `Tab` was expecting the trailing space to
     * be silently dropped, which is the data loss MME-0080 fixed.
     *
     * Both halves are asserted: Tab moved to the next row's first cell (the
     * navigation this scenario is about), and the trailing space survived as an
     * entity rather than being trimmed.
     */
    assert(
      editedMarkdown.includes("| Tab&#32; | Parser | ready |"),
      `Tab must move into the next row's first cell before typing, and the trailing space must survive as an entity.\n${editedMarkdown}`
    );
    await pressKey(cdp, "Tab", { shiftKey: true });
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.typeRichTextForTest("revisited")`);
    const shiftedMarkdown = await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getMarkdown()`);
    assert(shiftedMarkdown.includes("| Escaped \\| pipe | Editor | revisited |"), "Shift+Tab must return to the previous cell.");
    await pressKey(cdp, "z", { metaKey: true });
    assert((await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getMarkdown()`)).includes("| Escaped \\| pipe | Editor | edited |"), "Undo must restore the prior cell value.");
    await pressKey(cdp, "z", { metaKey: true, shiftKey: true });
    assert((await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getMarkdown()`)).includes("| Escaped \\| pipe | Editor | revisited |"), "Redo must restore the completed cell edit.");
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.setRichSelectionAfterText("safe")`);
    await pressKey(cdp, "Tab");
    assert((await evaluate(cdp, `document.querySelectorAll('[data-testid="rich-editor-host"] table tr').length`)) === 5, "Final-cell Tab must append one rectangular row.");
    await pressKey(cdp, "z", { metaKey: true });
    assert((await evaluate(cdp, `document.querySelectorAll('[data-testid="rich-editor-host"] table tr').length`)) === 4, "Undo must remove the appended row.");
    const finalMarkdown = await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getMarkdown()`);
    assert(finalMarkdown.includes(malformed), "Malformed table-like syntax must remain byte-identical after rich edits.");
    assert(finalMarkdown.includes("| :--- | :---: | ---: |"), "Alignment semantics must survive table serialization.");
    assert(!finalMarkdown.includes("Preserved Markdown table"), "UI fallback labels must never enter Markdown source.");
    await screenshot(cdp, "table-edited-desktop.png");

    await cdp.send("Emulation.setDeviceMetricsOverride", {
      deviceScaleFactor: 1,
      height: 844,
      mobile: true,
      width: 390
    });
    await wait(250);
    const constrained = await evaluate(
      cdp,
      `(() => {
        const table = document.querySelector('[data-testid="rich-editor-host"] table');
        const editor = document.querySelector('[data-testid="rich-editor-host"] .ProseMirror');
        const rect = table?.getBoundingClientRect();
        const editorRect = editor?.getBoundingClientRect();
        return {
          nonblank: Boolean(rect && rect.width > 0 && rect.height > 0),
          fits: Boolean(rect && editorRect && rect.right <= editorRect.right + 1),
          text: table?.textContent ?? ""
        };
      })()`
    );
    assert(constrained.nonblank, "Constrained table must render nonblank.");
    assert(constrained.fits, "Constrained table must remain inside the editor measure.");
    assert(constrained.text.includes("revisited") && constrained.text.includes("Tab"), "Constrained table must show completed edits.");
    await screenshot(cdp, "table-edited-constrained.png");

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("source")`);
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getEditorMode() === "source"`, "source mode restored");
    assert(
      (await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getMarkdown()`)) === finalMarkdown,
      "Source/Rich switch must retain the exact edited Markdown."
    );

    await evaluate(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.loadWritableMarkdownFileForTest("wide-table.md", ${JSON.stringify(wideSource)})`
    );
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("rich")`);
    await waitFor(cdp, `document.querySelectorAll('[data-testid="rich-editor-host"] table th').length === 8`, "wide table");
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.selectRichTableCellForTest(1, 0)`);
    const wideTable = await evaluate(
      cdp,
      `(() => {
        const host = document.querySelector('[data-testid="rich-editor-host"]');
        const editor = host?.querySelector('.ProseMirror');
        const table = editor?.querySelector('table');
        const selectedCell = table?.querySelector('.selectedCell');
        if (!host || !editor || !table || !selectedCell) return null;
        const overflow = host.scrollWidth > host.clientWidth + 1;
        host.scrollLeft = host.scrollWidth;
        const hostRect = host.getBoundingClientRect();
        const tableRect = table.getBoundingClientRect();
        return {
          focusVisible: editor.matches(':focus-visible'),
          focusShadow: getComputedStyle(host).boxShadow,
          selectedCellShadow: getComputedStyle(selectedCell, '::after').boxShadow,
          overflow,
          reachesEnd: tableRect.right <= hostRect.right + 1
        };
      })()`
    );
    assert(wideTable?.overflow, "Wide table must expose horizontal overflow on a constrained editor.");
    assert(wideTable?.reachesEnd, "Wide table must remain reachable after horizontal scrolling.");
    /*
     * MME-0116: this also required a box-shadow on `.rich-editor-host`. MME-0086
     * deliberately removed that rule — the comment survives in
     * apps/md-demo/src/styles.css: outlining the entire writing area the moment a
     * caret lands is what Notion, Obsidian and BlockNote all avoid, and focus is
     * carried by the caret and by `:focus-visible` on the controls inside.
     *
     * The accessibility guarantee is the *cell* indicator, which is the next
     * assertion and is unchanged: a keyboard user must be able to see which cell
     * they are in. Requiring the host ring as well asserted a design decision
     * that was reversed on purpose, so it goes; requiring the cell ring stays.
     */
    assert(wideTable?.focusVisible, "Keyboard-focused rich table must keep the editing surface focus-visible.");
    assert(wideTable?.selectedCellShadow !== "none", "Selected table cell must retain a visible focus indicator.");
    await screenshot(cdp, "table-wide-constrained.png");
    cdp.close();
    console.log(`MME-0055 runtime artifacts saved to ${visualDir}`);
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
