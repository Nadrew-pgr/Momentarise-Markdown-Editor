import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { requireChromeExecutable } from "./chrome-helpers.mjs";

const chromePath = requireChromeExecutable();
const demoUrl = process.env.MME_DEMO_URL ?? "http://127.0.0.1:5174/";
const visualDir = "docs/internal/visual-checks/MME-0054";
const port = 17800 + Math.floor(Math.random() * 500);
const userDataDir = `/tmp/mme-visual-0054-${Date.now()}`;
const source = "# Asset upload\n\nBefore stays.\n\nINSERT HERE\n\n| Keep | Opaque |\n| --- | --- |\n| yes | untouched |\n\nAfter stays.\n";
const expected = source.replace("INSERT HERE", "![Reference image](./assets/reference-card.png)");
const richSource = "# Rich asset upload\n\nBefore cursor.\n\n| Keep | Opaque |\n| --- | --- |\n| yes | untouched |\n\nAfter stays.\n";
const richExpected = richSource.replace("Before cursor.", "Before cursor.\n\n![Rich cursor](./assets/rich-cursor.png)");
const opaqueOnlySource = "| Opaque | Table |\n| --- | --- |\n| keep | exact |\n";

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

async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForJson(url, options = {}) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < (options.timeoutMs ?? 30000)) {
    const exitStatus = options.getExitStatus?.();
    if (exitStatus) {
      throw new Error(`Chrome exited before CDP became available (code ${exitStatus.code}, signal ${exitStatus.signal}).\n${options.getStderr?.() ?? ""}`);
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
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await evaluate(cdp, expression)) {
      return;
    }
    await wait(100);
  }
  throw new Error(`Timed out waiting for ${label}.`);
}

async function snapshot(cdp) {
  return evaluate(
    cdp,
    `(() => ({
      asset: window.__MME_DEMO_VISUAL_CHECK__.getAssetUploadState(),
      activeDocument: window.__MME_DEMO_VISUAL_CHECK__.getActiveDocument(),
      content: window.__MME_DEMO_VISUAL_CHECK__.getMarkdown(),
      save: window.__MME_DEMO_VISUAL_CHECK__.getSaveState(),
      buttonText: document.querySelector("[data-testid='asset-upload-button']")?.textContent?.trim() ?? "",
      buttonVisible: Boolean(document.querySelector("[data-testid='asset-upload-button']")?.getClientRects().length),
      statusHidden: document.querySelector("[data-testid='asset-upload-status']")?.hidden ?? true
    }))()`
  );
}

async function assertUnchanged(cdp, before, expectedStatus, label) {
  const after = await snapshot(cdp);
  assert(after.asset.status === expectedStatus, `${label} must expose ${expectedStatus} UI state.`);
  assert(after.content === before.content, `${label} must not mutate Markdown.`);
  assert(after.save.currentHash === before.save.currentHash, `${label} must not mutate the save hash.`);
  assert(after.statusHidden === false, `${label} must expose visible feedback.`);
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
    await waitFor(cdp, `Boolean(window.__MME_DEMO_VISUAL_CHECK__?.insertDemoAssetForTest)`, "MME-0054 visual hooks");

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.loadWritableMarkdownFileForTest("asset-demo.md", ${JSON.stringify(source)})`);
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getMarkdown() === ${JSON.stringify(source)}`, "asset fixture loaded");
    let state = await snapshot(cdp);
    assert(state.buttonVisible, "Visible asset upload button is required.");
    assert(state.buttonText.includes("Insert image"), "Visible asset upload button must have a clear label.");
    assert(state.asset.status === "idle", "Initial upload state must be idle.");
    assert(state.statusHidden, "Idle upload status must not add permanent topbar noise.");
    await screenshot(cdp, "asset-upload-visible.png");

    const markerStart = source.indexOf("INSERT HERE");
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.setSelection(${markerStart}, ${markerStart + "INSERT HERE".length})`);
    const inserted = await evaluate(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.insertDemoAssetForTest({ fileName: "reference-card.png", alt: "Reference image" })`
    );
    assert(inserted.status === "inserted", "Demo provider must return inserted for a safe image.");
    state = await snapshot(cdp);
    assert(state.content === expected, "Successful insertion must replace only the selected source range.");
    assert(state.save.status === "dirty", "Successful insertion must leave truthful dirty save state.");
    assert(state.asset.status === "inserted", "Successful insertion must expose inserted UI state.");
    assert(!state.statusHidden, "Successful insertion feedback must be visible.");
    await screenshot(cdp, "asset-upload-inserted.png");

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.loadWritableMarkdownFileForTest("paste-drop.md", ${JSON.stringify(source)})`);
    state = await snapshot(cdp);
    assert(state.asset.status === "idle" && state.statusHidden, "Opening another document must clear stale upload feedback.");
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.setSelection(${markerStart}, ${markerStart + "INSERT HERE".length})`);
    const pastePrevented = await evaluate(
      cdp,
      `(() => {
        const transfer = new DataTransfer();
        transfer.items.add(new File(["paste-image"], "pasted-board.png", { type: "image/png" }));
        const event = new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: transfer });
        document.querySelector("[data-testid='editor-host'] .cm-editor").dispatchEvent(event);
        return event.defaultPrevented;
      })()`
    );
    assert(pastePrevented, "Actual paste event with an image must be intercepted.");
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getAssetUploadState().status === "inserted"`, "paste insertion");
    assert((await snapshot(cdp)).content.includes("![pasted board](./assets/pasted-board.png)"), "Paste must insert normal Markdown image syntax.");

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.loadWritableMarkdownFileForTest("drop.md", ${JSON.stringify(source)})`);
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.setSelection(${markerStart}, ${markerStart + "INSERT HERE".length})`);
    const dropPrevented = await evaluate(
      cdp,
      `(() => {
        const transfer = new DataTransfer();
        transfer.items.add(new File(["drop-image"], "dropped-board.webp"));
        const event = new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer });
        document.querySelector(".editor-region").dispatchEvent(event);
        return event.defaultPrevented;
      })()`
    );
    assert(dropPrevented, "Actual drop event with a MIME-less image filename must be intercepted.");
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getAssetUploadState().status === "inserted"`, "drop insertion");
    assert((await snapshot(cdp)).content.includes("![dropped board](./assets/dropped-board.webp)"), "Drop must insert normal Markdown image syntax.");

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.loadWritableMarkdownFileForTest("rich-cursor.md", ${JSON.stringify(richSource)})`);
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("rich")`);
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getEditorMode() === "rich"`, "rich mode for cursor insertion");
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.setRichSelectionAfterText("Before cursor.")`);
    const richInserted = await evaluate(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.insertDemoAssetForTest({ fileName: "rich-cursor.png", alt: "Rich cursor" })`
    );
    assert(richInserted.status === "inserted", "Rich cursor insertion must use the provider path.");
    assert((await snapshot(cdp)).content === richExpected, "Rich cursor insertion must target the cursor and preserve the opaque table.");
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("source")`);
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getEditorMode() === "source"`, "source mode restored");

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.loadWritableMarkdownFileForTest("opaque-only.md", ${JSON.stringify(opaqueOnlySource)})`);
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("rich")`);
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getEditorMode() === "rich"`, "rich mode for unmappable selection");
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.selectFinalRichBlockForTest()`);
    const opaqueBefore = await snapshot(cdp);
    const unmappable = await evaluate(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.insertDemoAssetForTest({ fileName: "must-not-append.png" })`
    );
    assert(unmappable.status === "failed", "Unmappable rich selection must fail instead of appending at document end.");
    await assertUnchanged(cdp, opaqueBefore, "failed", "unmappable rich selection");
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("source")`);
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getEditorMode() === "source"`, "source mode restored after unmappable selection");

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.loadWritableMarkdownFileForTest("delayed.md", ${JSON.stringify(source)})`);
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.configureDemoAssetProviderForTest("delayed")`);
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.setSelection(${markerStart}, ${markerStart + "INSERT HERE".length})`);
    await evaluate(
      cdp,
      `(() => {
        window.__MME_PENDING_ASSET_TEST__ = window.__MME_DEMO_VISUAL_CHECK__.insertDemoAssetForTest({ fileName: "delayed.png" });
        return true;
      })()`
    );
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getAssetUploadState().busy === true`, "delayed upload pending");
    const replacementSource = "# Replacement document\n\nKeep this source.\n";
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.loadWritableMarkdownFileForTest("replacement.md", ${JSON.stringify("# Replacement document\n\nKeep this source.\n")})`);
    const staleResult = await evaluate(cdp, `window.__MME_PENDING_ASSET_TEST__`);
    state = await snapshot(cdp);
    assert(staleResult.status === "failed", "Upload completing after a document change must return a structured failure.");
    assert(state.content === replacementSource, "A stale upload must not overwrite the replacement document.");
    assert(state.asset.status === "idle" && !state.asset.busy, "A document change must clear the stale pending UI state.");

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.loadWritableMarkdownFileForTest("same-session-race.md", ${JSON.stringify(source)})`);
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.configureDemoAssetProviderForTest("delayed")`);
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.setSelection(${markerStart}, ${markerStart + "INSERT HERE".length})`);
    await evaluate(
      cdp,
      `(() => {
        window.__MME_PENDING_ASSET_TEST__ = window.__MME_DEMO_VISUAL_CHECK__.insertDemoAssetForTest({ fileName: "same-session-delayed.png" });
        return true;
      })()`
    );
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getAssetUploadState().busy === true`, "same-session upload pending");
    const externalSource = "# External source\n\nApplied while upload waited.\n";
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.simulateCleanExternalApplyForTest(${JSON.stringify("# External source\n\nApplied while upload waited.\n")})`);
    const sameSessionStale = await evaluate(cdp, `window.__MME_PENDING_ASSET_TEST__`);
    state = await snapshot(cdp);
    assert(sameSessionStale.status === "failed", "Upload completing after same-session external apply must fail.");
    assert(state.content === externalSource, "Stale upload must preserve same-session external content.");
    assert(state.save.currentHash === state.save.lastSavedHash, "External content must remain clean after stale upload rejection.");

    for (const [mode, expectedStatus] of [
      ["unavailable", "unavailable"],
      ["failed", "failed"],
      ["pending", "pending"],
      ["unsafe", "failed"]
    ]) {
      await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.loadWritableMarkdownFileForTest("${mode}.md", ${JSON.stringify(source)})`);
      await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.configureDemoAssetProviderForTest("${mode}")`);
      const before = await snapshot(cdp);
      await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.insertDemoAssetForTest({ fileName: "${mode}.png" })`);
      await assertUnchanged(cdp, before, expectedStatus, `${mode} provider result`);
    }

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.configureDemoAssetProviderForTest("demo")`);
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.loadAiPolicyDeniedDocumentForTest()`);
    const deniedBefore = await snapshot(cdp);
    const denied = await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.insertDemoAssetForTest({ fileName: "blocked.png" })`);
    assert(denied.status === "denied", "Policy denied image must return denied.");
    assert(deniedBefore.activeDocument.kind === "markdown", "Policy-denied fixture must reach the Markdown asset path.");
    assert(denied.policyDecisions.some((decision) => decision.allowed === false), "Denied result must contain a real blocking policy decision.");
    await assertUnchanged(cdp, deniedBefore, "denied", "policy denial");
    await screenshot(cdp, "asset-upload-denied.png");

    await cdp.send("Emulation.setDeviceMetricsOverride", {
      deviceScaleFactor: 1,
      height: 844,
      mobile: true,
      width: 390
    });
    await screenshot(cdp, "asset-upload-mobile.png");

    cdp.close();
    console.log(`MME-0054 runtime artifacts saved to ${visualDir}`);
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
