import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { requireChromeExecutable } from "./chrome-helpers.mjs";

const chromePath = requireChromeExecutable();
const demoUrl = process.env.MME_DEMO_URL ?? "http://127.0.0.1:5174/";
const visualDir = "docs/internal/visual-checks/MME-0040";
const port = 17040 + Math.floor(Math.random() * 500);
const userDataDir = `/tmp/mme-visual-0040-${Date.now()}`;

const tableFixturePath = "fixtures/019-gfm-table-variants/input.md";

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

async function waitFor(cdp, expression, label) {
  const start = Date.now();
  while (Date.now() - start < 7000) {
    if (await evaluate(cdp, expression)) {
      return;
    }
    await wait(100);
  }
  throw new Error(`Timed out waiting for ${label}.`);
}

async function main() {
  await mkdir(visualDir, { recursive: true });
  const tableMarkdown = await readFile(tableFixturePath, "utf8");
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
    await waitFor(cdp, `Boolean(window.__MME_DEMO_VISUAL_CHECK__)`, "demo loaded");

    await evaluate(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.loadImportedCopyForTest("table-variants.md", ${JSON.stringify(tableMarkdown)})`
    );
    await waitFor(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.getActiveDocument().fileName === "table-variants.md"`,
      "table document loaded"
    );

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("preview")`);
    await waitFor(
      cdp,
      `(() => {
        const article = document.querySelector('[data-testid="markdown-read-article"]');
        return Boolean(
          article &&
          article.querySelector("table thead") &&
          article.textContent.includes("Escaped | pipe") &&
          article.textContent.includes("broken table-like block")
        );
      })()`,
      "semantic table read view"
    );
    await screenshot(cdp, "table-read-semantic.png");

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("rich")`);
    /*
     * MME-0116: this required *both* of the fixture's table-like blocks to mount
     * as preserved fallbacks. MME-0055 shipped native rich tables, so the
     * well-formed one is now an editable table and only the malformed one still
     * falls back — the old predicate asserted that a shipped feature had not
     * shipped.
     *
     * The preservation guarantee is what MME-0040 is for, and it is unchanged:
     * syntax the rich view cannot represent must keep its bytes rather than be
     * flattened. So this asserts both halves of the current split, by membership
     * rather than by a count that the next semantic conversion would rot:
     *
     *   - the well-formed table mounts natively, and the escaped pipe survives
     *     into a real cell rather than splitting it — the corruption this fixture
     *     exists to catch;
     *   - the malformed block stays raw, with its bytes and the affordance that
     *     tells the user where to edit it.
     */
    await waitFor(
      cdp,
      `(() => {
        const editor = document.querySelector('[data-testid="rich-editor-host"] .ProseMirror');
        const table = editor?.querySelector("table");
        if (!table) {
          return false;
        }
        const headers = [...table.querySelectorAll("th")].map((cell) => cell.textContent.trim()).join("|");
        const cells = [...table.querySelectorAll("td")].map((cell) => cell.textContent.trim());
        const figures = [...document.querySelectorAll('[data-mme-preserved-table="true"]')];
        return (
          headers === "Feature|Owner|Status" &&
          cells.includes("Escaped | pipe") &&
          figures.length === 1 &&
          figures[0].textContent.includes("| broken table-like block | should stay raw |") &&
          figures[0].textContent.includes("| missing delimiter row |") &&
          figures[0].textContent.includes("Preserved Markdown table") &&
          figures[0].textContent.includes("Edit in Source mode")
        );
      })()`,
      "well-formed table mounts natively (escaped pipe intact) while the malformed block stays preserved"
    );
    await screenshot(cdp, "rich-native-table-and-preserved-fallback.png");

    const markdownAfterRichMount = await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getMarkdown()`);
    if (markdownAfterRichMount !== tableMarkdown) {
      throw new Error(
        `Rich table mount must keep Markdown byte-identical.\n--- expected ---\n${tableMarkdown}\n--- actual ---\n${markdownAfterRichMount}`
      );
    }

    cdp.close();
    console.log(`MME-0040 visual artifacts saved to ${visualDir}`);
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

await main();
