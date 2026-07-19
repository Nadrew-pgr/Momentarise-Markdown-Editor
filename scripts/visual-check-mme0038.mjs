import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { requireChromeExecutable } from "./chrome-helpers.mjs";

const chromePath = requireChromeExecutable();
const siteUrl = assertLocalDocsUrl(process.env.MME_DOCS_URL ?? "http://127.0.0.1:5178/");
const docsUrl = new URL("/docs", siteUrl).href;
const visualDir = "docs/internal/visual-checks/MME-0038";
const port = 17100 + Math.floor(Math.random() * 500);
const userDataDir = `/tmp/mme-visual-0038-${Date.now()}`;

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

async function clickSelector(cdp, selector) {
  const box = await evaluate(
    cdp,
    `(() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    })()`
  );
  if (!box) {
    throw new Error(`Could not find ${selector} to click.`);
  }
  await cdp.send("Input.dispatchMouseEvent", {
    button: "left",
    clickCount: 1,
    type: "mousePressed",
    x: box.x,
    y: box.y
  });
  await cdp.send("Input.dispatchMouseEvent", {
    button: "left",
    clickCount: 1,
    type: "mouseReleased",
    x: box.x,
    y: box.y
  });
}

async function clickButtonByText(cdp, text) {
  const box = await evaluate(
    cdp,
    `(() => {
      const button = [...document.querySelectorAll("button")].find((candidate) => candidate.textContent.trim() === ${JSON.stringify(text)});
      if (!button) return null;
      const rect = button.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    })()`
  );
  if (!box) {
    throw new Error(`Could not find button ${text} to click.`);
  }
  await cdp.send("Input.dispatchMouseEvent", {
    button: "left",
    clickCount: 1,
    type: "mousePressed",
    x: box.x,
    y: box.y
  });
  await cdp.send("Input.dispatchMouseEvent", {
    button: "left",
    clickCount: 1,
    type: "mouseReleased",
    x: box.x,
    y: box.y
  });
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
          "Run with system Chrome permission if sandboxed local Chrome aborts before startup." +
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

async function waitFor(cdp, expression, label, timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await evaluate(cdp, expression)) {
      return;
    }
    await wait(100);
  }
  throw new Error(`Timed out waiting for ${label}.`);
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
      "--window-size=1280,900",
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
    await cdp.send("Browser.grantPermissions", {
      origin: new URL(siteUrl).origin,
      permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"]
    });
    const loadEvent = cdp.once("Page.loadEventFired");
    await cdp.send("Page.navigate", { url: siteUrl });
    await loadEvent;
    await waitFor(
      cdp,
      `document.querySelector("[data-testid='site-landing']")?.textContent.includes("Build rich document editors") && document.querySelector("[data-testid='site-landing']")?.textContent.includes("One Markdown file. Four working surfaces.") && document.querySelector("[data-testid='site-landing']")?.textContent.includes("Read the docs") && Boolean(document.querySelector("[data-testid='live-editor-frame'][role='group']")) && Boolean(document.querySelector("[data-testid='editable-render-preview'][aria-label='Editable rendered preview']")) && document.querySelector(".source-mount .cm-content")?.textContent.includes("Styled HTML Block") && document.querySelector(".source-mount .cm-content")?.textContent.includes("slash editor") && document.querySelector("[data-testid='editable-render-preview']")?.textContent.includes("Styled HTML Block") && document.querySelector("[data-testid='editable-render-preview']")?.textContent.includes("slash editor")`,
      "site landing"
    );
    await waitFor(
      cdp,
      `document.documentElement.scrollWidth <= window.innerWidth + 2 && [...document.querySelectorAll(".landing-story, .landing-workflow, .landing-principles, .landing-footer")].every((section) => section.getBoundingClientRect().left >= -1)`,
      "landing sections fit viewport"
    );
    await screenshot(cdp, "site-landing.png");
    await evaluate(cdp, `window.scrollTo(0, document.documentElement.scrollHeight)`);
    await wait(250);
    await waitFor(
      cdp,
      `${JSON.stringify(["/docs", "/docs/quickstart/react", "/docs/concepts/agentic-experience", "/docs/packages/md-cli", "/docs/packages/md-core", "/docs/roadmap"])}.every((href) => [...document.querySelectorAll(".landing-footer a")].some((link) => link.getAttribute("href") === href))`,
      "landing footer critical links"
    );
    await screenshot(cdp, "site-footer.png");

    const docsLoadEvent = cdp.once("Page.loadEventFired");
    await cdp.send("Page.navigate", { url: docsUrl });
    await docsLoadEvent;
    await waitFor(
      cdp,
      `document.querySelector("[data-testid='docs-content-rendered']")?.textContent.includes("Momentarise Markdown Editor") && document.body.textContent.includes("Agentic Experience") && document.body.textContent.includes("CLI For Agents And Developers") && Boolean(document.querySelector("[data-testid='docs-live-demo']")) && Boolean(document.querySelector(".source-mount .cm-editor")) && Boolean(document.querySelector("[data-testid='editable-render-preview']")) && Boolean(document.querySelector("[data-testid='docs-search-trigger']")) && Boolean(document.querySelector("[data-testid='theme-toggle']")) && Boolean(document.querySelector("[data-testid='docs-actions']")) && Boolean(document.querySelector("[data-testid='docs-pager']"))`,
      "docs home rendered by MME"
    );
    await clickSelector(cdp, "[data-testid='docs-search-trigger']");
    await waitFor(
      cdp,
      `Boolean(document.querySelector("[data-testid='docs-search-overlay'] input"))`,
      "docs search opens"
    );
    await clickSelector(cdp, "[data-testid='docs-search-overlay'] input");
    await cdp.send("Input.insertText", { text: "React" });
    await waitFor(
      cdp,
      `document.querySelector("[data-testid='docs-search-overlay']")?.textContent.includes("React Quickstart")`,
      "docs search returns React quickstart"
    );
    await evaluate(cdp, `document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))`);
    await waitFor(cdp, `!document.querySelector("[data-testid='docs-search-overlay']")`, "docs search closes");
    await clickSelector(cdp, "[data-testid='theme-toggle']");
    await waitFor(
      cdp,
      `document.documentElement.dataset.mmeScheme === "dark"`,
      "theme toggle switches to dark"
    );
    await screenshot(cdp, "docs-dark.png");
    await clickSelector(cdp, "[data-testid='theme-toggle']");
    await waitFor(
      cdp,
      `document.documentElement.dataset.mmeScheme === "light"`,
      "theme toggle switches back to light"
    );
    await screenshot(cdp, "docs-home.png");
    await evaluate(cdp, `document.querySelector("[data-testid='docs-live-demo']").scrollIntoView({ block: "start" })`);
    await wait(250);
    await evaluate(
      cdp,
      `(() => {
        const preview = document.querySelector("[data-testid='editable-render-preview']");
        preview.innerHTML = preview.innerHTML.replace("Styled HTML Block", "Edited Styled HTML Block");
        const paragraph = preview.querySelector("p");
        if (paragraph) {
          paragraph.insertAdjacentHTML("beforeend", " <strong>Strong proof</strong> <code>code-proof</code> <s>draft proof</s>");
        }
        const proof = document.createElement("div");
        proof.className = "mme-proof-block";
        proof.textContent = "Custom MME proof block";
        preview.append(proof);
        preview.dispatchEvent(new InputEvent("input", { bubbles: true, data: "Edited Styled HTML Block", inputType: "insertText" }));
        return true;
      })()`
    );
    await waitFor(
      cdp,
      `document.querySelector(".source-mount .cm-content")?.textContent.includes("Edited Styled HTML Block") && document.querySelector(".source-mount .cm-content")?.textContent.includes("# Rich Markdown Surface") && document.querySelector(".source-mount .cm-content")?.textContent.includes("**source**") && document.querySelector(".source-mount .cm-content")?.textContent.includes("**Strong proof**") && document.querySelector(".source-mount .cm-content")?.textContent.includes("\`code-proof\`") && document.querySelector(".source-mount .cm-content")?.textContent.includes("~~draft proof~~") && document.querySelector(".source-mount .cm-content")?.textContent.includes("\`mme-*\`") && document.querySelector(".source-mount .cm-content")?.textContent.includes("<div class=\\"mme-html-panel\\">") && document.querySelector(".source-mount .cm-content")?.textContent.includes("<div class=\\"mme-slash-editor\\">") && document.querySelector(".source-mount .cm-content")?.textContent.includes("<div class=\\"mme-proof-block\\">Custom MME proof block</div>") && document.querySelector(".source-mount .cm-content")?.textContent.includes("- Edit the source pane for exact Markdown.") && !document.querySelector(".source-mount .cm-content")?.textContent.includes("<h1>Rich Markdown Surface</h1>")`,
      "editable rendered preview syncs to Markdown source"
    );
    await screenshot(cdp, "docs-home-demo.png");
    await evaluate(cdp, `window.scrollTo(0, document.documentElement.scrollHeight)`);
    await wait(250);
    await waitFor(
      cdp,
      `${JSON.stringify(["/docs", "/docs/quickstart/react", "/docs/concepts/document-model", "/docs/concepts/ai-privacy", "/docs/concepts/agentic-experience", "/docs/packages/md-cli", "/docs/roadmap", "/docs/packages/md-core"])}.every((href) => [...document.querySelectorAll(".docs-footer a")].some((link) => link.getAttribute("href") === href))`,
      "docs footer critical links"
    );
    await screenshot(cdp, "docs-footer.png");
    await evaluate(cdp, `window.scrollTo(0, 0)`);
    await wait(250);

    await evaluate(cdp, `document.querySelector("[data-testid='docs-actions']").open = true`);
    await clickSelector(cdp, "[data-testid='copy-markdown']");
    await waitFor(
      cdp,
      `document.querySelector("[data-testid='docs-action-status']")?.textContent.includes("Markdown copied")`,
      "copy Markdown action"
    );
    await clickSelector(cdp, "[data-testid='copy-prompt']");
    await waitFor(
      cdp,
      `document.querySelector("[data-testid='docs-action-status']")?.textContent.includes("Prompt copied")`,
      "copy prompt action"
    );
    await clickSelector(cdp, "[data-testid='copy-section']");
    await waitFor(
      cdp,
      `document.querySelector("[data-testid='docs-action-status']")?.textContent.includes("Section copied")`,
      "copy section action"
    );
    await clickSelector(cdp, "[data-testid='copy-link']");
    await waitFor(
      cdp,
      `document.querySelector("[data-testid='docs-action-status']")?.textContent.includes("Page link copied")`,
      "copy link action"
    );
    await evaluate(cdp, `document.querySelector("[data-testid='open-in-chat']").open = true`);
    await waitFor(cdp, `document.querySelector("[data-testid='open-in-chat'] button")?.textContent.includes("ChatGPT")`, "open-in-chat menu");
    await screenshot(cdp, "docs-page-actions.png");
    await clickButtonByText(cdp, "Codex");
    await waitFor(
      cdp,
      `document.querySelector("[data-testid='docs-action-status']")?.textContent.includes("Prompt copied. Paste into Codex")`,
      "open-in-chat copy fallback action"
    );

    const routeLoadEvent = cdp.once("Page.loadEventFired");
    await cdp.send("Page.navigate", { url: new URL("/docs/quickstart/react", siteUrl).href });
    await routeLoadEvent;
    await waitFor(
      cdp,
      `document.querySelector(".docs-title")?.textContent.includes("React Quickstart") && document.querySelector("[data-testid='docs-content-rendered']")?.textContent.includes("React binding")`,
      "React docs route"
    );
    const rawMarkdownOk = await evaluate(
      cdp,
      `fetch(${JSON.stringify(new URL("/docs/quickstart/react.md", siteUrl).href)}).then((response) => response.text()).then((text) => text.includes("# React Quickstart"))`
    );
    if (!rawMarkdownOk) {
      throw new Error("Raw Markdown fetch for /docs/quickstart/react.md did not return the source file.");
    }
    const footerRouteContractsOk = await evaluate(
      cdp,
      `Promise.all(${JSON.stringify([
        ["/docs", "Momentarise Markdown Editor"],
        ["/docs/quickstart/react", "React Quickstart"],
        ["/docs/concepts/agentic-experience", "Agentic Experience"],
        ["/docs/packages/md-cli", "CLI For Agents And Developers"],
        ["/docs/packages/md-core", "Core Contracts"],
        ["/docs/roadmap", "Roadmap"]
      ])}.map(async ([path, expectedText]) => {
        const response = await fetch(new URL(path, ${JSON.stringify(siteUrl)}).href);
        const body = await response.text();
        return response.ok && body.includes(expectedText);
      })).then((results) => results.every(Boolean))`
    );
    if (!footerRouteContractsOk) {
      throw new Error("Footer critical routes did not resolve to the expected static docs pages.");
    }

    const cliLoadEvent = cdp.once("Page.loadEventFired");
    await cdp.send("Page.navigate", { url: new URL("/docs/packages/md-cli", siteUrl).href });
    await cliLoadEvent;
    await waitFor(
      cdp,
      `document.querySelector(".docs-title")?.textContent.includes("CLI For Agents And Developers") && document.querySelector("[data-testid='docs-content-rendered']")?.textContent.includes("Public API Checkpoints") && document.querySelector("[data-testid='docs-content-rendered']")?.textContent.includes("runCli") && document.querySelector("[data-testid='docs-content-rendered']")?.textContent.includes("0.x")`,
      "CLI package launch hardening route"
    );
    await screenshot(cdp, "docs-package-md-cli.png");

    const axLoadEvent = cdp.once("Page.loadEventFired");
    await cdp.send("Page.navigate", { url: new URL("/docs/concepts/agentic-experience", siteUrl).href });
    await axLoadEvent;
    await waitFor(
      cdp,
      `document.querySelector(".docs-title")?.textContent.includes("Agentic Experience") && document.querySelector("[data-testid='docs-content-rendered']")?.textContent.includes("Not Shipped Yet") && document.querySelector("[data-testid='docs-content-rendered']")?.textContent.includes("hosted Ask AI") && document.querySelector("[data-testid='docs-content-rendered']")?.textContent.includes("semantic docs search")`,
      "Agentic Experience truthfulness route"
    );
    await screenshot(cdp, "docs-agentic-experience.png");

    const rendererLoadEvent = cdp.once("Page.loadEventFired");
    await cdp.send("Page.navigate", { url: new URL("/docs/packages/md-render-html", siteUrl).href });
    await rendererLoadEvent;
    await waitFor(
      cdp,
      `document.querySelector(".docs-title")?.textContent.includes("HTML Renderer") && document.querySelector("[data-testid='docs-content-rendered']")?.textContent.includes("renderMarkdownToHtml") && document.querySelector("[data-testid='docs-content-rendered']")?.textContent.includes("mmeSanitizeSchema") && Boolean(document.querySelector("[data-testid='theme-toggle']"))`,
      "HTML renderer package route"
    );
    if ((await evaluate(cdp, `document.documentElement.dataset.mmeScheme`)) !== "dark") {
      await clickSelector(cdp, "[data-testid='theme-toggle']");
      await waitFor(cdp, `document.documentElement.dataset.mmeScheme === "dark"`, "package route dark mode");
    }
    await screenshot(cdp, "docs-package-code-dark.png");

    await cdp.send("Emulation.setDeviceMetricsOverride", {
      deviceScaleFactor: 1,
      height: 900,
      mobile: true,
      width: 390
    });
    const mobilePackageLoadEvent = cdp.once("Page.loadEventFired");
    await cdp.send("Page.navigate", { url: new URL("/docs/packages/md-cli", siteUrl).href });
    await mobilePackageLoadEvent;
    await waitFor(
      cdp,
      `document.querySelector(".docs-title")?.textContent.includes("CLI For Agents And Developers") && document.documentElement.scrollWidth <= window.innerWidth + 2`,
      "mobile package docs route"
    );
    await wait(250);
    await screenshot(cdp, "docs-mobile-package.png");
    await screenshot(cdp, "docs-mobile.png");
    cdp.close();
  } finally {
    chrome.kill("SIGTERM");
  }
}

function assertLocalDocsUrl(value) {
  const url = new URL(value);
  const loopbackHosts = new Set(["127.0.0.1", "::1", "[::1]", "localhost"]);
  if ((url.protocol !== "http:" && url.protocol !== "https:") || !loopbackHosts.has(url.hostname)) {
    throw new Error(`MME_DOCS_URL must point to a local loopback dev server, got ${value}`);
  }
  return url.href;
}

await main();
