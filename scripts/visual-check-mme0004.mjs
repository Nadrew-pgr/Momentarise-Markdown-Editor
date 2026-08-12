import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { requireChromeExecutable } from "./chrome-helpers.mjs";
import {
  DEMO_DISCLOSURES,
  assertDisclosuresOpened,
  openDemoDisclosuresExpression
} from "./visual-demo-disclosures.mjs";

const chromePath = requireChromeExecutable();
const demoUrl = process.env.MME_DEMO_URL ?? "http://127.0.0.1:5173/";
const visualDir = "docs/internal/visual-checks/MME-0004";
const port = 9800 + Math.floor(Math.random() * 500);
const userDataDir = `/tmp/mme-visual-0004-${Date.now()}`;

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
    this.nextId = 1;
    this.pending = new Map();
    this.events = new Map();
    this.socket = socket;
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
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

  send(method, params = {}) {
    const id = this.nextId;
    this.nextId += 1;
    this.socket.send(
      JSON.stringify({
        id,
        method,
        params
      })
    );
    return new Promise((resolve, reject) => {
      this.pending.set(id, {
        reject,
        resolve
      });
    });
  }

  once(method) {
    return new Promise((resolve) => {
      const handlers = this.events.get(method) ?? [];
      handlers.push(resolve);
      this.events.set(method, handlers);
    });
  }

  close() {
    this.socket.close();
  }
}

async function evaluate(cdp, expression) {
  const result = await cdp.send("Runtime.evaluate", {
    awaitPromise: true,
    expression,
    returnByValue: true
  });
  if (result.exceptionDetails) {
    throw new Error(`Runtime evaluation failed: ${expression}`);
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

function assertIncludes(value, expected, label) {
  if (!String(value).includes(expected)) {
    throw new Error(`Expected ${label} to include ${JSON.stringify(expected)}.`);
  }
}

/**
 * MME-0116 — the round-trip panel reports a passing round trip.
 *
 * Read each line by its own `data-testid` rather than scanning the panel's
 * `innerText`: a substring search over the whole panel cannot tell which line a
 * word came from, so "strict" appearing anywhere would satisfy a check meant for
 * the mode line.
 *
 * The outcome is what matters, not merely that the placeholder was replaced. The
 * demo renders `pass (remark AST)` / `pass (source preserved)` on a passing round
 * trip and the bare string `fail` otherwise (`parserStatusLabel` and
 * `serializerStatusLabel` in apps/md-demo/src/main.ts), so a check that only
 * rejected the initial `pending` would accept a failing round trip — in the gate
 * whose entire subject is the round trip. `pending` is rejected too, because a
 * panel that never ran is a different failure with the same symptom.
 */
async function assertRoundTripPasses(cdp, when) {
  for (const [testId, label] of [
    ["parser-status", "parser status"],
    ["serializer-status", "serializer status"]
  ]) {
    const value = String(
      await evaluate(cdp, `document.querySelector('[data-testid="${testId}"]').innerText`)
    ).trim();
    if (value === "pending") {
      throw new Error(`Round-trip ${label} still reads the initial placeholder "pending" ${when}.`);
    }
    if (!value.startsWith("pass")) {
      throw new Error(`Round-trip ${label} reads ${JSON.stringify(value)} ${when}; the round trip must pass.`);
    }
  }
  /*
   * The serializer line carries the preservation claim itself, which is the one
   * string in this panel a reader relies on. MME-0005 replaced the parser, so
   * that half is asserted as `pass (…)` rather than by a pinned engine name; the
   * preservation half has never changed and is pinned.
   */
  const serializer = String(
    await evaluate(cdp, `document.querySelector('[data-testid="serializer-status"]').innerText`)
  ).trim();
  assertIncludes(serializer, "source preserved", `serializer status ${when}`);
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
      "--window-size=1280,720",
      "about:blank"
    ],
    {
      stdio: ["ignore", "ignore", "pipe"]
    }
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
    const { targetId } = await browserCdp.send("Target.createTarget", {
      url: "about:blank"
    });
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
    await cdp.send("Page.navigate", {
      url: demoUrl
    });
    await loadEvent;
    await wait(200);

    /*
     * MME-0116: the round-trip panel lives inside the collapsed "Technical
     * diagnostics" disclosure, and `innerText` returns "" for content inside a
     * closed `<details>`. Open it the way a user does before reading it.
     */
    assertDisclosuresOpened(
      await evaluate(cdp, openDemoDisclosuresExpression([DEMO_DISCLOSURES.debugInspector])),
      "MME-0004"
    );
    await wait(120);

    const statusText = await evaluate(
      cdp,
      "document.querySelector('[data-testid=\"roundtrip-status\"]').innerText"
    );
    const diagnosticsText = await evaluate(
      cdp,
      "document.querySelector('[data-testid=\"roundtrip-diagnostics\"]').innerText"
    );
    assertIncludes(statusText, "source-mode-fixture.md", "round-trip fixture status");
    assertIncludes(statusText, "strict", "round-trip mode");
    /*
     * MME-0116: this used to demand the literal "pre-parser identity" and the
     * `pre_parser_identity_mode` diagnostic. MME-0005 replaced the identity
     * formatter with the real remark AST parser, so both had been unsatisfiable
     * since 2026-05. Pinning the new literal instead would only move the rot to
     * the next parser change — and MME-0005's own gate already pins the parser
     * identity, which is *its* contract.
     *
     * What MME-0004 exists to prove is the panel: fixture, mode, parser,
     * serializer and diagnostics all resolved to real values, and still resolved
     * after an edit. So assert that shape. `pending` is the markup's initial
     * placeholder, which is exactly the failure this must catch.
     */
    await assertRoundTripPasses(cdp, "on load");
    /*
     * Not "the list is non-empty": `renderDiagnostics` emits one entry per
     * diagnostic, so a clean document legitimately produces none and that check
     * would go red for a good round trip. What must never appear is an error.
     */
    if (/\berror\b/i.test(diagnosticsText)) {
      throw new Error(`Round-trip diagnostics report an error on load: ${JSON.stringify(diagnosticsText)}`);
    }
    await screenshot(cdp, "roundtrip-status-loaded.png");

    await evaluate(cdp, "window.__MME_DEMO_VISUAL_CHECK__.setCursorToEnd()");
    await cdp.send("Input.insertText", {
      text: "\n\nRound-trip visual edit.\n"
    });
    await wait(100);
    const updatedStatusText = await evaluate(
      cdp,
      "document.querySelector('[data-testid=\"roundtrip-status\"]').innerText"
    );
    await assertRoundTripPasses(cdp, "after edit");
    assertIncludes(updatedStatusText, "source-mode-fixture.md", "round-trip fixture status after edit");
    await screenshot(cdp, "roundtrip-status-after-edit.png");

    cdp.close();
    console.log(`MME-0004 visual artifacts saved to ${visualDir}`);
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
    await rm(userDataDir, {
      force: true,
      maxRetries: 3,
      recursive: true,
      retryDelay: 100
    });
  }
}

await main();
