import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { requireChromeExecutable } from "./chrome-helpers.mjs";

const chromePath = requireChromeExecutable();
const demoUrl = process.env.MME_DEMO_URL ?? "http://127.0.0.1:5174/";
const visualDir = "docs/internal/visual-checks/MME-0028.6";
const port = 15050 + Math.floor(Math.random() * 500);
const userDataDir = `/tmp/mme-visual-00286-${Date.now()}`;

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
      "--window-size=1360,1500",
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

    await evaluate(cdp, `document.querySelector('[data-testid="debug-inspector"]').open = true`);
    await evaluate(cdp, `document.querySelector('[data-testid="ai-provider-state"]').scrollIntoView({ block: "center" })`);
    await waitFor(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.getAiProviderRuntimeState().mode === "mock"`,
      "default mock provider"
    );
    await screenshot(cdp, "ai-provider-default-mock.png");

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.configureHostAiProviderForTest()`);
    await evaluate(cdp, `document.querySelector('[data-testid="ai-provider-state"]').scrollIntoView({ block: "center" })`);
    await waitFor(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.getAiProviderRuntimeState().mode === "host-managed" && window.__MME_DEMO_VISUAL_CHECK__.getAiWritingState().hasSession`,
      "host-managed provider configured"
    );
    const redactedHostEndpoint = await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getAiProviderRuntimeState().endpoint`);
    if (redactedHostEndpoint.includes("?") || redactedHostEndpoint.includes("@") || redactedHostEndpoint.includes("#")) {
      throw new Error("Provider endpoint display/state must redact credentials and query params.");
    }
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.configureRelativeSecretEndpointForTest()`);
    const redactedRelativeEndpoint = await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getAiProviderRuntimeState().endpoint`);
    if (
      redactedRelativeEndpoint.includes("?") ||
      redactedRelativeEndpoint.includes("@") ||
      redactedRelativeEndpoint.includes("#") ||
      redactedRelativeEndpoint.includes("secret")
    ) {
      throw new Error("Relative provider endpoint display/state must redact credentials, fragments, and query params.");
    }
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.configureHostAiProviderForTest()`);
    await screenshot(cdp, "ai-provider-host-managed.png");

    await evaluate(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.loadImportedCopyForTest("provider.md", "# Provider\\n\\nUse provider path.\\n")`
    );
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("rich")`);
    await waitFor(cdp, `Boolean(document.querySelector('[data-testid="rich-editor-host"] .ProseMirror'))`, "rich editor");
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.configurePersonalByokProviderForTest()`);
    await evaluate(cdp, `document.querySelector('[data-testid="ai-provider-state"]').scrollIntoView({ block: "center" })`);
    const personalPrePromptState = await evaluate(
      cdp,
      `JSON.stringify({
        ai: window.__MME_DEMO_VISUAL_CHECK__.getAiWritingState(),
        inline: window.__MME_DEMO_VISUAL_CHECK__.getInlineAiPromptState(),
        provider: window.__MME_DEMO_VISUAL_CHECK__.getAiProviderRuntimeState()
      })`
    );
    if (personalPrePromptState.includes("sk-visual-redacted")) {
      throw new Error("Visual/test state leaked the personal BYOK key before prompt submit.");
    }
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.openInlineAiPromptForTest("rewrite")`);
    await waitFor(cdp, `document.querySelector('[data-testid="inline-ai-prompt"]')?.hidden === false`, "personal BYOK prompt");
    await evaluate(
      cdp,
      `(() => {
        const input = document.querySelector('[data-testid="inline-ai-prompt-input"]');
        input.value = "Rewrite with a real provider path.";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        document.querySelector('[data-testid="inline-ai-generate-button"]').click();
      })()`
    );
    await waitFor(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.getAiWritingState().pendingStatus === "pending" && window.__MME_DEMO_VISUAL_CHECK__.getAiWritingState().suggestionText.includes("Visual personal BYOK provider suggestion")`,
      "personal BYOK staged suggestion"
    );
    const keyLeakState = await evaluate(
      cdp,
      `JSON.stringify({
        ai: window.__MME_DEMO_VISUAL_CHECK__.getAiWritingState(),
        inline: window.__MME_DEMO_VISUAL_CHECK__.getInlineAiPromptState(),
        provider: window.__MME_DEMO_VISUAL_CHECK__.getAiProviderRuntimeState()
      })`
    );
    if (keyLeakState.includes("sk-visual-redacted")) {
      throw new Error("Visual/test state leaked the personal BYOK key.");
    }
    await screenshot(cdp, "ai-provider-personal-byok-staged.png");

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.loadAiPolicyDeniedDocumentForTest()`);
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.switchEditorMode("rich")`);
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.configureHostAiProviderForTest()`);
    const beforePolicyCount = await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getAiWritingState().providerRequestCount`);
    await evaluate(cdp, `document.querySelector('[data-testid="ai-provider-state"]').scrollIntoView({ block: "center" })`);
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.openInlineAiPromptForTest("summarize")`);
    await evaluate(cdp, `document.querySelector('[data-testid="inline-ai-generate-button"]').click()`);
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getAiWritingState().pendingStatus === "blocked"`, "policy blocked");
    const afterPolicyCount = await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getAiWritingState().providerRequestCount`);
    if (afterPolicyCount !== beforePolicyCount) {
      throw new Error("Policy denial should not add a provider transport call.");
    }
    await screenshot(cdp, "ai-provider-policy-blocked.png");

    cdp.close();
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
  process.exit(1);
});
