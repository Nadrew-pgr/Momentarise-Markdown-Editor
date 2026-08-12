import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { requireChromeExecutable } from "./chrome-helpers.mjs";

const chromePath = requireChromeExecutable();
const demoUrl = process.env.MME_DEMO_URL ?? "http://127.0.0.1:5174/";
const visualDir = "docs/internal/visual-checks/MME-0017";
const port = 11000 + Math.floor(Math.random() * 500);
const userDataDir = `/tmp/mme-visual-0017-${Date.now()}`;

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
      ai: window.__MME_DEMO_VISUAL_CHECK__.getAiWritingState(),
      eventLogText: document.querySelector('[data-testid="event-log"]')?.textContent ?? "",
      markdown: window.__MME_DEMO_VISUAL_CHECK__.getMarkdown()
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

async function waitForExpression(cdp, expression, label) {
  const start = Date.now();
  while (Date.now() - start < 6000) {
    if (await evaluate(cdp, expression)) {
      return;
    }
    await wait(100);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function waitForSnapshot(cdp, predicate, label) {
  const start = Date.now();
  let snapshot = await getSnapshot(cdp);
  while (Date.now() - start < 6000) {
    if (predicate(snapshot)) {
      return snapshot;
    }
    await wait(100);
    snapshot = await getSnapshot(cdp);
  }
  throw new Error(`Timed out waiting for ${label}.\nLast snapshot:\n${JSON.stringify(snapshot, null, 2)}`);
}

function assertNoKeyLeak(snapshot, label) {
  const text = JSON.stringify(snapshot);
  if (text.includes("sk-test-visual")) {
    throw new Error(`BYOK test key leaked into ${label}.`);
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
      "--window-size=1280,900",
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
      `Boolean(window.__MME_DEMO_VISUAL_CHECK__?.getAiWritingState)`,
      "MME AI visual hook"
    );

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.startMockAiSessionForTest()`);
    /*
     * MME-0116: this read `snapshot.ai.keyInputValue === ""`. MME-0028.6 removed
     * that field precisely so the raw BYOK key never enters page state, replacing
     * it with the boolean `keyInputHasValue` — so the predicate had been reading
     * `undefined === ""` and could never be true. It has been unsatisfiable since
     * 2026-06-30, and it was the no-key-leak check.
     *
     * Assert the same property against the field that exists: after
     * `startAiSession`, the key input must be empty, which is what says the raw
     * key was not retained. The complementary "no key text anywhere in the
     * exposed state" half is `assertNoKeyLeak` immediately below — a second,
     * field-scanning version of it was written here and then removed, because no
     * mutation could make it fail: the demo clears the input before this snapshot
     * is taken, so there is nothing left for it to find.
     */
    const sessionReady = await waitForSnapshot(
      cdp,
      (snapshot) =>
        snapshot.ai.hasSession === true &&
        snapshot.ai.keyInputHasValue === false &&
        snapshot.ai.statusText.includes("ready"),
      "AI session ready with no BYOK key retained in the input"
    );
    assertNoKeyLeak(sessionReady, "session-ready state");
    await screenshot(cdp, "ai-panel-session-ready.png");

    await evaluate(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.generateAiSuggestionForTest("improve", "Make this sharper.")`
    );
    const pending = await waitForSnapshot(
      cdp,
      (snapshot) =>
        snapshot.ai.pendingStatus === "pending" &&
        snapshot.ai.providerRequestCount === 1 &&
        snapshot.ai.suggestionText.includes("AI suggestion"),
      "pending AI suggestion"
    );
    assertNoKeyLeak(pending, "pending suggestion state");
    await screenshot(cdp, "ai-suggestion-pending.png");

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.acceptAiSuggestionForTest()`);
    const accepted = await waitForSnapshot(
      cdp,
      (snapshot) => snapshot.ai.pendingStatus === "accepted" && snapshot.markdown.includes("AI suggestion"),
      "accepted AI suggestion"
    );
    assertNoKeyLeak(accepted, "accepted suggestion state");
    await screenshot(cdp, "ai-suggestion-accepted.png");

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.loadAiPolicyDeniedDocumentForTest()`);
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.startMockAiSessionForTest()`);
    /*
     * MME-0116: this demanded `providerRequestCount === 0`. The count is the mock
     * provider's cumulative request log (`demoAiProvider.requests.length`), and
     * the accepted-suggestion scenario above legitimately makes one request — so
     * the absolute zero was only ever true when this scenario ran first.
     *
     * Checked rather than assumed: the observed state at this point is
     * `pendingStatus: "blocked"`, `statusText: "AI blocked by policy before
     * provider call"`, count 1 — the one request belongs to the earlier accepted
     * suggestion, not to this denied document. So this is a stale assertion, not
     * a policy bypass.
     *
     * The delta is the real invariant and is stronger than the old absolute: a
     * denied document must add no provider request, whatever happened before it.
     */
    const beforeBlocked = (await getSnapshot(cdp)).ai.providerRequestCount;
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.generateAiSuggestionForTest("summarize", "Summarize.")`);
    const blocked = await waitForSnapshot(
      cdp,
      (snapshot) =>
        snapshot.ai.pendingStatus === "blocked" &&
        snapshot.ai.providerRequestCount === beforeBlocked &&
        snapshot.ai.statusText.includes("blocked"),
      `policy blocked AI suggestion without reaching the provider (request count stays ${beforeBlocked})`
    );
    assertNoKeyLeak(blocked, "policy-blocked state");
    await screenshot(cdp, "ai-policy-blocked.png");

    cdp.close();
    console.log(`MME-0017 visual artifacts saved to ${visualDir}`);
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
