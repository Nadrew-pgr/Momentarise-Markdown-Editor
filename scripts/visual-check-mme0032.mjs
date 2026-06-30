import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { requireChromeExecutable } from "./chrome-helpers.mjs";

const chromePath = requireChromeExecutable();
const demoUrl = process.env.MME_DEMO_URL ?? "http://127.0.0.1:5174/";
const visualDir = "docs/internal/visual-checks/MME-0032";
const port = 16090 + Math.floor(Math.random() * 500);
const userDataDir = `/tmp/mme-visual-0032-${Date.now()}`;

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

async function getSnapshot(cdp) {
  return evaluate(
    cdp,
    `(() => ({
      activeDocument: window.__MME_DEMO_VISUAL_CHECK__.getActiveDocument(),
      editorMode: window.__MME_DEMO_VISUAL_CHECK__.getEditorMode(),
      htmlPreview: window.__MME_DEMO_VISUAL_CHECK__.getHtmlPreviewState(),
      markdown: window.__MME_DEMO_VISUAL_CHECK__.getMarkdown(),
      read: window.__MME_DEMO_VISUAL_CHECK__.getMarkdownReadState(),
      renderScriptRan: window.__MME_RENDER_HTML_SCRIPT_RAN__ === true,
      artifactScriptRan: window.__MME_HTML_PREVIEW_SCRIPT_RAN__ === true
    }))()`
  );
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

function assertNoUnsafeRenderedHtml(html) {
  const lower = html.toLowerCase();
  for (const forbidden of ["<script", "</script", "<iframe", "</iframe", "<style", "</style", "onclick=", "onerror=", "javascript:"]) {
    if (lower.includes(forbidden)) {
      throw new Error(`Markdown Read view leaked unsafe HTML token: ${forbidden}\n${html}`);
    }
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
    await waitForExpression(
      cdp,
      `Boolean(window.__MME_DEMO_VISUAL_CHECK__?.getMarkdownReadState)`,
      "MME-0032 demo visual hook"
    );

    const safeMarkdown = `# Markdown Read view

This view renders sanitized Markdown without editing source.

- [x] Task list keeps disabled checkbox rendering
- [[Project Alpha|Opaque wikilink text stays visible]]

\`\`\`ts
const durable = "Markdown";
\`\`\`
`;
    await evaluate(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.loadImportedCopyForTest("read-view.md", ${JSON.stringify(safeMarkdown)})`
    );
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("preview")`);
    await waitForSnapshot(
      cdp,
      (snapshot) =>
        snapshot.activeDocument.kind === "markdown" &&
        snapshot.editorMode === "preview" &&
        snapshot.read.visible === true &&
        snapshot.read.text.includes("Markdown Read view") &&
        snapshot.read.text.includes("[[Project Alpha|Opaque wikilink text stays visible]]"),
      "Markdown Read view opened"
    );
    await screenshot(cdp, "markdown-read-view.png");

    const hostileMarkdown = `# Sanitized inline HTML

<div onclick="window.__MME_RENDER_HTML_SCRIPT_RAN__ = true">Visible div text</div>
<a href="javascript:alert(1)">Visible unsafe link label</a>
<img src="x" onerror="window.__MME_RENDER_HTML_SCRIPT_RAN__ = true" alt="Unsafe image">
<script>window.__MME_RENDER_HTML_SCRIPT_RAN__ = true</script>
<iframe src="https://example.invalid"></iframe>
`;
    await evaluate(
      cdp,
      `(() => {
        window.__MME_RENDER_HTML_SCRIPT_RAN__ = false;
        window.__MME_DEMO_VISUAL_CHECK__.loadImportedCopyForTest("unsafe-read.md", ${JSON.stringify(hostileMarkdown)});
        window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("preview");
      })()`
    );
    const sanitized = await waitForSnapshot(
      cdp,
      (snapshot) =>
        snapshot.editorMode === "preview" &&
        snapshot.read.visible === true &&
        snapshot.read.text.includes("Visible div text") &&
        snapshot.read.text.includes("Visible unsafe link label") &&
        snapshot.read.diagnostics.includes("render_html_stripped") &&
        snapshot.renderScriptRan === false,
      "sanitized Markdown HTML rendered"
    );
    assertNoUnsafeRenderedHtml(sanitized.read.html);
    await screenshot(cdp, "markdown-read-sanitized-html.png");

    const hostileArtifact = `<!doctype html>
<html>
  <body>
    <h1>Sandboxed HTML artifact</h1>
    <script>
      try {
        window.top.__MME_HTML_PREVIEW_SCRIPT_RAN__ = true;
      } catch {}
    </script>
  </body>
</html>`;
    await evaluate(
      cdp,
      `(() => {
        window.__MME_HTML_PREVIEW_SCRIPT_RAN__ = false;
        window.__MME_DEMO_VISUAL_CHECK__.loadHtmlArtifactForTest("unsafe-artifact.html", ${JSON.stringify(hostileArtifact)});
        window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("preview");
      })()`
    );
    const artifact = await waitForSnapshot(
      cdp,
      (snapshot) =>
        snapshot.activeDocument.kind === "html-artifact" &&
        snapshot.editorMode === "preview" &&
        snapshot.htmlPreview.frameSandbox === "" &&
        snapshot.htmlPreview.sandbox === "" &&
        snapshot.htmlPreview.statusText.includes("no sandbox tokens") &&
        snapshot.artifactScriptRan === false,
      "HTML artifact empty sandbox preview"
    );
    if (artifact.htmlPreview.scriptsEnabled !== false) {
      throw new Error("HTML artifact preview must keep scripts disabled.");
    }

    cdp.close();
    console.log(`MME-0032 visual artifacts saved to ${visualDir}`);
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
