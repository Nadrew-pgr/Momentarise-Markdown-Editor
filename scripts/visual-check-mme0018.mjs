import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { requireChromeExecutable } from "./chrome-helpers.mjs";

const chromePath = requireChromeExecutable();
const demoUrl = process.env.MME_DEMO_URL ?? "http://127.0.0.1:5174/";
const visualDir = "docs/internal/visual-checks/MME-0018";
const port = 12000 + Math.floor(Math.random() * 500);
const userDataDir = `/tmp/mme-visual-0018-${Date.now()}`;

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

async function getSnapshot(cdp) {
  return evaluate(
    cdp,
    `(() => ({
      activeDocument: window.__MME_DEMO_VISUAL_CHECK__.getActiveDocument(),
      ai: window.__MME_DEMO_VISUAL_CHECK__.getAiWritingState(),
      editorMode: window.__MME_DEMO_VISUAL_CHECK__.getEditorMode(),
      referenceSurface: window.__MME_DEMO_VISUAL_CHECK__.getReferenceSurfaceState(),
      slash: window.__MME_DEMO_VISUAL_CHECK__.getSlashMenuState(),
      toolbar: window.__MME_DEMO_VISUAL_CHECK__.getToolbarState()
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
  while (Date.now() - start < 7000) {
    if (predicate(snapshot)) {
      return snapshot;
    }
    await wait(100);
    snapshot = await getSnapshot(cdp);
  }
  throw new Error(`Timed out waiting for ${label}.\nLast snapshot:\n${JSON.stringify(snapshot, null, 2)}`);
}

async function waitForExpression(cdp, expression, label) {
  const start = Date.now();
  while (Date.now() - start < 6000) {
    if (await evaluate(cdp, expression)) {
      return;
    }
    await wait(100);
  }
  throw new Error(`Timed out waiting for ${label}.`);
}

async function clickByTestId(cdp, testId) {
  await evaluate(
    cdp,
    `(() => {
      const element = document.querySelector('[data-testid="${testId}"]');
      if (!element) throw new Error('Missing element: ${testId}');
      element.click();
      return true;
    })()`
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
      "--window-size=1360,920",
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

    /*
     * MME-0089 turned the persistent formatting toolbar off by default
     * (benchmark contract 4): formatting now lives in the selection bubble and
     * the slash menu. This gate exercises the toolbar, so it opts in the way a
     * Google-Docs-style host would; the opt-in itself is proven by
     * `visual:mme-0089`.
     */
    await evaluate(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.setReferenceSurfacePreferencesForTest({ toolbarMode: "sticky" })`
    );
    await waitForSnapshot(
      cdp,
      (snapshot) =>
        snapshot.referenceSurface?.debugInspectorVisible === false &&
        snapshot.referenceSurface?.aiEntryPoints?.includes("toolbar") &&
        snapshot.referenceSurface?.statusDisclosure === "discreet",
      "reference surface loaded"
    );
    await screenshot(cdp, "reference-surface-desktop.png");

    await clickByTestId(cdp, "command-palette-button");
    await waitForSnapshot(
      cdp,
      (snapshot) => snapshot.referenceSurface?.commandPaletteOpen === true,
      "command palette open"
    );
    await screenshot(cdp, "reference-surface-command-palette.png");
    await evaluate(cdp, `document.querySelector('[data-testid="command-palette"]')?.click()`);

    await evaluate(
      cdp,
      `(() => {
        window.__MME_DEMO_VISUAL_CHECK__.startMockAiSessionForTest();
        window.__MME_DEMO_VISUAL_CHECK__.setSelection(7, 32);
      })()`
    );
    /*
     * MME-0116: this scenario clicked `selected-text-ai-action` and waited for the
     * assistant panel. MME-0029 made that control `disabled` and `hidden`
     * unconditionally, and MME-0028.5 rerouted every AI action to the inline
     * prompt, so there was nothing to click and no panel to wait for.
     *
     * The scenario is retired rather than re-pointed: the inline prompt path that
     * replaced it is already proven by `mme-0028.5`, and duplicating it here
     * would add a second place to update without adding coverage.
     *
     * What replaces it is the state the surface is actually in. The control is
     * still wired — `apps/md-demo/src/main.ts` registers a click handler that
     * calls `runEditorNativeAiCommand("rewrite")`, gated on the `selection` entry
     * point — but `renderReferenceSurfaceState` disables and hides it
     * unconditionally, so it is present and unreachable. Presenting a control the
     * surface has decided not to offer is the thing to catch.
     *
     * Known and NOT asserted here: the demo's default preferences still advertise
     * `selection` in `aiEntryPoints` (apps/md-demo/src/reference-surface.ts) while
     * no selection entry point exists. That inconsistency is a product defect
     * owned by MME-0098, recorded in the MME-0114 build-log entry. Asserting its
     * absence would leave this gate red for a defect it does not own, which is
     * quarantine under another name.
     */
    const selectionAi = await evaluate(
      cdp,
      `(() => {
        const button = document.querySelector('[data-testid="selected-text-ai-action"]');
        if (!button) {
          return { present: false };
        }
        return { disabled: button.disabled, hidden: button.hidden, present: true };
      })()`
    );
    if (selectionAi.present && !(selectionAi.disabled && selectionAi.hidden)) {
      throw new Error(
        `The source-mode selection AI control is presented as available (disabled: ${selectionAi.disabled}, hidden: ${selectionAi.hidden}), ` +
          "but the reference surface hides it unconditionally while still advertising `selection` in aiEntryPoints. " +
          "If MME-0098 has restored the selection entry point, this gate should be updated to exercise it rather than to assert its absence."
      );
    }
    await screenshot(cdp, "reference-surface-selected-ai.png");

    await clickByTestId(cdp, "rich-mode-button");
    await waitForSnapshot(
      cdp,
      (snapshot) => snapshot.editorMode === "rich" && snapshot.toolbar.visible === true,
      "rich reference toolbar loaded"
    );
    /*
     * MME-0116: this opened the slash menu as soon as the toolbar was visible,
     * and failed about two runs in three. The failure snapshot is the tell —
     * `aiItems` already contains "summarize" while `open` is false and `query` is
     * "", i.e. the menu was opened and then reset. `toolbar.visible` is not the
     * same event as "the rich view has finished mounting", and a mount that lands
     * after the menu opens closes it.
     *
     * This gate had never reached here before: it died at the selection-AI step,
     * so the race was invisible until that step was repaired.
     *
     * The repair is to stop using the programmatic hook. `openSlashMenuForTest`
     * assigns the menu state directly and renders it, so it races anything that
     * re-renders afterwards; typing `/summ` opens the menu through the editor's
     * own input rule, which is both the interaction a user performs — the
     * `AGENT.md` rule — and the version that cannot be raced, because the state
     * that opened the menu is the state the editor already settled on. Waiting on
     * `.ProseMirror` first was tried and still failed 3 runs in 5.
     */
    await waitForExpression(
      cdp,
      `Boolean(document.querySelector('[data-testid="rich-editor-host"] .ProseMirror'))`,
      "rich view mounted"
    );
    /*
     * Anchor the caret on real text before typing, the way the passing `mme-0013`
     * gate does. Clicking the host's centre was tried and lands in empty space
     * below the content, where ProseMirror places no caret, so the typed
     * characters went nowhere.
     */
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.setRichSelectionAfterText("Write Markdown")`);
    /* MME-0088: the trigger requires start-of-block or whitespace before the slash. */
    await cdp.send("Input.insertText", { text: " /summ" });
    await waitForSnapshot(
      cdp,
      (snapshot) => snapshot.slash.open === true && snapshot.slash.aiItems.includes("summarize"),
      "slash menu AI action available"
    );
    await screenshot(cdp, "reference-surface-slash-ai.png");

    await clickByTestId(cdp, "editor-ai-button");
    await waitForSnapshot(
      cdp,
      (snapshot) => snapshot.referenceSurface?.aiMenuOpen === true,
      "editor AI menu open"
    );
    await screenshot(cdp, "reference-surface-rich-ai.png");

    await cdp.send("Emulation.setDeviceMetricsOverride", {
      deviceScaleFactor: 1,
      height: 900,
      mobile: true,
      width: 390
    });
    await wait(350);
    await screenshot(cdp, "reference-surface-narrow.png");

    await cdp.send("Emulation.setDeviceMetricsOverride", {
      deviceScaleFactor: 1,
      height: 1024,
      mobile: true,
      width: 768
    });
    await wait(350);
    await screenshot(cdp, "reference-surface-tablet.png");

    await cdp.send("Emulation.setDeviceMetricsOverride", {
      deviceScaleFactor: 1,
      height: 760,
      mobile: false,
      width: 640
    });
    await wait(350);
    await screenshot(cdp, "reference-surface-ide-constrained.png");

    await cdp.send("Emulation.clearDeviceMetricsOverride");

    await evaluate(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.loadHtmlArtifactForTest("reference-preview.html", "<!doctype html><html><body><h1>Preview</h1><p>Sandboxed.</p></body></html>")`
    );
    await clickByTestId(cdp, "preview-mode-button");
    await waitForSnapshot(
      cdp,
      (snapshot) => snapshot.editorMode === "preview" && snapshot.activeDocument.kind === "html-artifact",
      "HTML preview mode loaded"
    );
    await screenshot(cdp, "reference-surface-html-preview.png");

    cdp.close();
    console.log(`MME-0018 visual artifacts saved to ${visualDir}`);
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

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
