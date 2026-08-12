import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { requireChromeExecutable } from "./chrome-helpers.mjs";

const chromePath = requireChromeExecutable();
const demoUrl = process.env.MME_DEMO_URL ?? "http://127.0.0.1:5174/";
const visualDir = "docs/internal/visual-checks/MME-0045";
const port = 17600 + Math.floor(Math.random() * 500);
const userDataDir = `/tmp/mme-visual-0045-${Date.now()}`;

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
  await new Promise((resolve) => setTimeout(resolve, ms));
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

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function snapshot(cdp) {
  return evaluate(
    cdp,
    `(() => ({
      bubbleVisible: !document.querySelector('[data-testid="selection-bubble-toolbar"]')?.hidden,
      modeControlHidden: document.querySelector('[data-testid="mode-control"]')?.hidden ?? false,
      selectedSlashCommand: document.querySelector('[data-testid="slash-command-menu"] [data-selected="true"]')?.dataset.slashCommand ?? document.querySelector('[data-testid="slash-command-menu"] [data-selected="true"]')?.dataset.referenceAiAction ?? null,
      slashActiveDescendant: document.querySelector('[data-testid="slash-command-menu"]')?.getAttribute("aria-activedescendant") ?? null,
      slashAiItems: Array.from(document.querySelectorAll('[data-reference-ai-action]')).map((node) => node.dataset.referenceAiAction),
      slashFocusable: document.querySelector('[data-testid="slash-command-menu"]')?.tabIndex === 0,
      slashHidden: document.querySelector('[data-testid="slash-command-menu"]')?.hidden ?? true,
      slashItems: Array.from(document.querySelectorAll('[data-slash-command]')).map((node) => node.dataset.slashCommand),
      slashSections: Array.from(document.querySelectorAll('[data-testid^="slash-section-"]')).map((node) => node.textContent.trim()),
      toolbarButtons: Array.from(document.querySelectorAll('[data-testid="rich-command-toolbar"] button')).filter((button) => getComputedStyle(button).display !== "none").map((button) => button.getAttribute("aria-label") || button.textContent.trim()),
      viewportWidth: window.innerWidth
    }))()`
  );
}

async function overflowingCommandSurfaces(cdp) {
  return evaluate(
    cdp,
    `(() => Array.from(document.querySelectorAll('[data-testid="rich-command-toolbar"], [data-testid="slash-command-menu"], [data-testid="selection-bubble-toolbar"]'))
      .filter((node) => !node.hidden && getComputedStyle(node).display !== "none")
      .map((node) => {
        const rect = node.getBoundingClientRect();
        return {
          left: Math.round(rect.left),
          bottom: Math.round(rect.bottom),
          right: Math.round(rect.right),
          testid: node.dataset.testid,
          top: Math.round(rect.top),
          viewportHeight: window.innerHeight,
          viewportWidth: window.innerWidth,
          pointerReachable: node.contains(document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2))
        };
      })
      .filter((rect) => rect.left < -1 || rect.right > rect.viewportWidth + 1 || rect.top < -1 || rect.bottom > rect.viewportHeight + 1 || !rect.pointerReachable))()`
  );
}

/*
 * MME-0116: this measured every control at whatever scroll offset the page
 * happened to be at, and failed anything whose box fell outside the viewport.
 * MME-0078 made the narrow topbar a horizontal scroller, so at 390px several
 * controls legitimately start off-screen — they are reached by scrolling the bar,
 * exactly as designed. The gate never scrolled, so it reported a working design
 * as unreachable.
 *
 * Scrolling each control into view first is the interaction a user performs, and
 * it is the only change: everything the check proved before it still has to
 * hold afterwards — present, enabled, non-zero, not `display:none` or
 * `visibility:hidden`, fully inside the viewport, and the topmost element at its
 * own centre. A control hidden behind an overlay, clipped to nothing, or parked
 * somewhere no scroll can reach still fails.
 */
async function unreachableControls(cdp, selectors) {
  return evaluate(
    cdp,
    `((selectors) => selectors
      .map(({ label, selector }) => {
        const node = document.querySelector(selector);
        if (!node) {
          return { label, reason: "missing", selector };
        }
        node.scrollIntoView({ block: "nearest", inline: "nearest" });
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const topNode = rect.width > 0 && rect.height > 0 ? document.elementFromPoint(centerX, centerY) : null;
        const reachable =
          !node.closest("[hidden]") &&
          !node.disabled &&
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          rect.width > 0 &&
          rect.height > 0 &&
          rect.left >= -1 &&
          rect.right <= window.innerWidth + 1 &&
          rect.top >= -1 &&
          rect.bottom <= window.innerHeight + 1 &&
          node.contains(topNode);
        return reachable
          ? null
          : {
              bottom: Math.round(rect.bottom),
              disabled: Boolean(node.disabled),
              display: style.display,
              label,
              left: Math.round(rect.left),
              reason: "not-reachable",
              right: Math.round(rect.right),
              selector,
              top: Math.round(rect.top),
              viewportHeight: window.innerHeight,
              viewportWidth: window.innerWidth,
              visibility: style.visibility
            };
      })
      .filter(Boolean))(${JSON.stringify(selectors)})`
  );
}

async function dispatchSlashKey(cdp, key) {
  return evaluate(
    cdp,
    `((key) => {
      const menu = document.querySelector('[data-testid="slash-command-menu"]');
      if (!menu) return false;
      menu.focus();
      return menu.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key }));
    })(${JSON.stringify(key)})`
  );
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
    await cdp.send("Page.navigate", { url: demoUrl });
    await waitFor(cdp, `Boolean(window.__MME_DEMO_VISUAL_CHECK__)`, "demo visual API");
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("rich")`);
    await waitFor(cdp, `document.querySelector('[data-testid="rich-command-toolbar"]') && !document.querySelector('[data-testid="rich-command-toolbar"]').hidden`, "rich toolbar");

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.openSlashMenuForTest("hng1")`);
    await waitFor(cdp, `!document.querySelector('[data-testid="slash-command-menu"]').hidden`, "slash menu open");
    let state = await snapshot(cdp);
    assert(state.slashItems.includes("mme:heading1"), "fuzzy slash query must find heading1.");
    assert(state.slashSections.includes("Blocks"), "slash menu must show grouped Blocks section.");
    assert(state.slashFocusable, "slash listbox root must become focusable when open.");
    assert(state.slashActiveDescendant, "slash listbox root must expose active descendant.");
    await screenshot(cdp, "slash-fuzzy-grouped-desktop.png");

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.openSlashMenuForTest("")`);
    await waitFor(cdp, `!document.querySelector('[data-testid="slash-command-menu"]').hidden`, "slash menu keyboard fixture");
    state = await snapshot(cdp);
    assert(state.slashItems.length > 1, "slash keyboard fixture must expose multiple commands.");
    const firstSlashSelection = state.selectedSlashCommand;
    await dispatchSlashKey(cdp, "ArrowDown");
    state = await snapshot(cdp);
    assert(
      state.selectedSlashCommand && state.selectedSlashCommand !== firstSlashSelection,
      `slash ArrowDown must move keyboard selection: before=${firstSlashSelection}, after=${state.selectedSlashCommand}, items=${JSON.stringify(state.slashItems)}`
    );
    await dispatchSlashKey(cdp, "Home");
    state = await snapshot(cdp);
    assert(state.selectedSlashCommand === firstSlashSelection, "slash Home must restore first keyboard selection.");

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.openSlashMenuForTest("ai")`);
    await waitFor(cdp, `!document.querySelector('[data-testid="slash-command-menu"]').hidden`, "slash AI entries");
    state = await snapshot(cdp);
    assert(state.slashAiItems.includes("continue"), "slash menu must expose AI entry-point items.");
    await screenshot(cdp, "slash-ai-entrypoints-desktop.png");

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.setRichSelectionForText("Write Markdown")`);
    await waitFor(cdp, `!document.querySelector('[data-testid="selection-bubble-toolbar"]').hidden`, "selection bubble");
    state = await snapshot(cdp);
    assert(state.bubbleVisible, "selection bubble must be visible after text selection.");
    assert(state.toolbarButtons.length > 4, "toolbar must expose command buttons.");
    await screenshot(cdp, "toolbar-active-disabled-desktop.png");

    await evaluate(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.setReferenceSurfacePreferencesForTest({ modeControl: "single-toggle" })`
    );
    await waitFor(cdp, `Boolean(document.querySelector('[data-testid="mode-cycle-button"]'))`, "single-toggle mode control");
    await screenshot(cdp, "mode-control-single-toggle.png");

    await cdp.send("Emulation.setDeviceMetricsOverride", {
      deviceScaleFactor: 1,
      height: 760,
      mobile: false,
      width: 760
    });
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.openSlashMenuForTest("card")`);
    await wait(200);
    let unreachable = await unreachableControls(cdp, [
      { label: "New", selector: '[data-testid="new-file-button"]' },
      { label: "Open file", selector: '[data-testid="open-file-button"]' },
      { label: "Save As", selector: '[data-testid="save-as-button"]' },
      { label: "Mode control", selector: '[data-testid="mode-control"]' },
      { label: "Command palette", selector: '[data-testid="command-palette-button"]' }
    ]);
    assert(unreachable.length === 0, `constrained controls must remain reachable: ${JSON.stringify(unreachable)}`);
    await screenshot(cdp, "command-surfaces-constrained.png");

    await cdp.send("Emulation.setDeviceMetricsOverride", {
      deviceScaleFactor: 2,
      height: 820,
      mobile: false,
      width: 390
    });
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.openSlashMenuForTest("card")`);
    await wait(200);
    state = await snapshot(cdp);
    assert(state.viewportWidth === 390, "mobile viewport must be active.");
    assert(!state.slashHidden, "slash menu must remain visible on mobile viewport.");
    const overflowingSurfaces = await overflowingCommandSurfaces(cdp);
    assert(
      overflowingSurfaces.length === 0,
      `mobile command surfaces must fit within viewport: ${JSON.stringify(overflowingSurfaces)}`
    );
    unreachable = await unreachableControls(cdp, [
      { label: "New", selector: '[data-testid="new-file-button"]' },
      { label: "Open file", selector: '[data-testid="open-file-button"]' },
      { label: "Save As", selector: '[data-testid="save-as-button"]' },
      { label: "Mode control", selector: '[data-testid="mode-control"]' },
      { label: "Command palette", selector: '[data-testid="command-palette-button"]' }
    ]);
    assert(unreachable.length === 0, `mobile controls must remain reachable: ${JSON.stringify(unreachable)}`);
    await screenshot(cdp, "command-surfaces-mobile.png");

    await cdp.send("Emulation.clearDeviceMetricsOverride");
    await evaluate(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.loadWritableMarkdownFileForTest("external-reset.md", ${JSON.stringify("# External reset\n\nWrite Markdown\n")})`
    );
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("rich")`);
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.openSlashMenuForTest("card")`);
    await waitFor(cdp, `!document.querySelector('[data-testid="slash-command-menu"]').hidden`, "slash open before external apply");
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.setRichSelectionForText("Write Markdown")`);
    await waitFor(cdp, `!document.querySelector('[data-testid="selection-bubble-toolbar"]').hidden`, "bubble open before external apply");
    await evaluate(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.simulateCleanExternalApplyForTest(${JSON.stringify("# External reset\n\nChanged externally\n")})`
    );
    await wait(200);
    state = await snapshot(cdp);
    assert(state.slashHidden, "clean external apply must close stale slash overlay.");
    assert(!state.bubbleVisible, "clean external apply must close stale selection bubble.");
    await screenshot(cdp, "command-surfaces-after-external-apply.png");

    cdp.close();
  } finally {
    chrome.kill("SIGTERM");
    /*
     * MME-0114: bound the wait and escalate. A Chrome that ignores SIGTERM keeps
     * its stdio pipes open and so keeps Node's event loop alive; the gate prints
     * its result and never exits, which blocks the whole suite. This file builds
     * no exit promise, so the bound is a plain timed wait.
     */
    await wait(2000);
    if (chrome.exitCode === null && chrome.signalCode === null) {
      chrome.kill("SIGKILL");
    }
    await wait(2000);
    await rm(userDataDir, { force: true, recursive: true });
  }
}

await main();
