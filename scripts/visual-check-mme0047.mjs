import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { requireChromeExecutable } from "./chrome-helpers.mjs";

const chromePath = requireChromeExecutable();
const demoUrl = process.env.MME_DEMO_URL ?? "http://127.0.0.1:5174/";
const visualDir = "docs/internal/visual-checks/MME-0047";
const port = 18100 + Math.floor(Math.random() * 500);
const userDataDir = `/tmp/mme-visual-0047-${Date.now()}`;

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
      activeFoldControl: document.activeElement?.classList?.contains("rich-fold-toggle") ? {
        ariaLabel: document.activeElement.getAttribute("aria-label"),
        expanded: document.activeElement.getAttribute("aria-expanded"),
        kind: document.activeElement.getAttribute("data-fold-kind")
      } : null,
      blockStates: Array.from(document.querySelectorAll("[data-rich-folded]")).map((element) => ({
        afterContent: getComputedStyle(element, "::after").content,
        blockSize: element.getBoundingClientRect().height,
        folded: element.getAttribute("data-rich-folded"),
        kind: element.getAttribute("data-rich-fold-kind"),
        text: element.textContent.trim()
      })),
      controls: Array.from(document.querySelectorAll(".rich-fold-toggle")).map((element) => ({
        ariaLabel: element.getAttribute("aria-label"),
        expanded: element.getAttribute("aria-expanded"),
        kind: element.getAttribute("data-fold-kind")
      })),
      editorMode: window.__MME_DEMO_VISUAL_CHECK__.getEditorMode(),
      foldState: window.__MME_DEMO_VISUAL_CHECK__.getFoldState(),
      hasPersistentFoldStrip: Boolean(document.querySelector('[data-testid="folding-session-state"]')),
      hiddenText: Array.from(document.querySelectorAll(".rich-fold-hidden")).map((element) => element.textContent.trim()),
      markdown: window.__MME_DEMO_VISUAL_CHECK__.getMarkdown(),
      saveState: window.__MME_DEMO_VISUAL_CHECK__.getSaveState(),
      visibleText: Array.from(document.querySelectorAll(".ProseMirror > :not(.rich-fold-hidden)")).map((element) => element.textContent.trim())
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
  while (Date.now() - start < 7000) {
    if (await evaluate(cdp, expression)) {
      return;
    }
    await wait(100);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function loadRichFixture(cdp, fileName, markdown) {
  await evaluate(
    cdp,
    `window.__MME_DEMO_VISUAL_CHECK__.loadImportedCopyForTest(${JSON.stringify(fileName)}, ${JSON.stringify(markdown)})`
  );
  await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("rich")`);
  await evaluate(cdp, `document.querySelector(".ProseMirror")?.focus()`);
  await waitForSnapshot(cdp, (snapshot) => snapshot.editorMode === "rich", "rich editor loaded");
}

const foldingMarkdown = `# Root

Root intro.

## Parent

Parent body.

### Child

Child body.

\`\`\`ts
const durable = "Markdown";
\`\`\`

> [!note] Callout title
> Callout body.

<section data-mme-raw>
  <p>Opaque HTML block.</p>
</section>

# Next root

Next root body.
`;

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
      "--window-size=1280,860",
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
    await waitForExpression(cdp, `Boolean(window.__MME_DEMO_VISUAL_CHECK__?.toggleRichFoldBlockForText)`, "MME-0047 folding hook");

    await loadRichFixture(cdp, "folding-polish.md", foldingMarkdown);
    const baseline = await waitForSnapshot(
      cdp,
      (snapshot) =>
        snapshot.foldState.items.some((item) => item.foldKind === "code") &&
        snapshot.foldState.items.some((item) => item.foldKind === "callout") &&
        snapshot.foldState.items.some((item) => item.foldKind === "opaque") &&
        snapshot.controls.every((control) => control.ariaLabel && control.expanded === "true") &&
        snapshot.controls.every((control) => control.kind === "heading" || control.ariaLabel.includes(": ")) &&
        snapshot.hasPersistentFoldStrip === false,
      "foldable block controls loaded"
    );
    const baselineMarkdown = baseline.markdown;
    await evaluate(cdp, `document.querySelector(".rich-fold-toggle")?.focus()`);
    await waitForSnapshot(
      cdp,
      (snapshot) => snapshot.activeFoldControl?.ariaLabel?.startsWith("Collapse"),
      "keyboard-focused fold control"
    );
    await screenshot(cdp, "folding-quiet-gutter-focus.png");

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.toggleRichFoldBlockForText("const durable")`);
    await waitForSnapshot(
      cdp,
      (snapshot) =>
        snapshot.foldState.items.some((item) => item.foldKind === "code" && item.folded) &&
        snapshot.blockStates.some((block) => block.kind === "code" && block.folded === "true" && block.afterContent === '"..."') &&
        snapshot.markdown === baselineMarkdown &&
        snapshot.saveState.status === "saved",
      "code block folded without source mutation"
    );
    await screenshot(cdp, "folding-code-block-collapsed.png");

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.toggleRichFoldBlockForText("Callout title")`);
    await waitForSnapshot(
      cdp,
      (snapshot) =>
        snapshot.foldState.items.some((item) => item.foldKind === "callout" && item.folded) &&
        snapshot.blockStates.some((block) => block.kind === "callout" && block.folded === "true" && block.afterContent === '"..."') &&
        snapshot.markdown === baselineMarkdown &&
        snapshot.saveState.status === "saved",
      "callout folded without source mutation"
    );
    await screenshot(cdp, "folding-callout-collapsed.png");

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.toggleRichFoldBlockForText("Opaque HTML block")`);
    await waitForSnapshot(
      cdp,
      (snapshot) =>
        snapshot.foldState.items.some((item) => item.foldKind === "opaque" && item.folded) &&
        snapshot.blockStates.some((block) => block.kind === "opaque" && block.folded === "true" && block.afterContent === '"..."') &&
        snapshot.markdown === baselineMarkdown &&
        snapshot.saveState.status === "saved",
      "opaque block folded without source mutation"
    );
    await screenshot(cdp, "folding-opaque-block-collapsed.png");

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.toggleRichFoldForText("Child")`);
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.toggleRichFoldForText("Parent")`);
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.toggleRichFoldForText("Parent")`);
    await waitForSnapshot(
      cdp,
      (snapshot) =>
        snapshot.foldState.hiddenText.includes("Child body.") &&
        !snapshot.foldState.hiddenText.includes("Parent body.") &&
        snapshot.visibleText.some((text) => text.includes("Parent body.")) &&
        snapshot.markdown === baselineMarkdown,
      "nested child remains folded after parent reopens"
    );
    await screenshot(cdp, "folding-parent-child-state.png");

    cdp.close();
  } finally {
    chrome.kill("SIGTERM");
    /*
     * MME-0114: bound the wait and escalate. A Chrome that ignores SIGTERM keeps
     * its stdio pipes open and so keeps Node's event loop alive; the gate prints
     * its result and never exits, which blocks the whole suite.
     */
    await Promise.race([chromeExit, wait(2000)]);
    if (chrome.exitCode === null && chrome.signalCode === null) {
      chrome.kill("SIGKILL");
    }
    await Promise.race([chromeExit, wait(2000)]);
    await rm(userDataDir, { force: true, recursive: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
