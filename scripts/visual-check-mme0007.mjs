import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { requireChromeExecutable } from "./chrome-helpers.mjs";

const chromePath = requireChromeExecutable();
const demoUrl = process.env.MME_DEMO_URL ?? "http://127.0.0.1:5173/";
const visualDir = "docs/internal/visual-checks/MME-0007";
const port = 10000 + Math.floor(Math.random() * 500);
const userDataDir = `/tmp/mme-visual-0007-${Date.now()}`;

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

async function getMarkdown(cdp) {
  return evaluate(cdp, "window.__MME_DEMO_VISUAL_CHECK__.getMarkdown()");
}

async function press(cdp, key) {
  await cdp.send("Input.dispatchKeyEvent", {
    code: key,
    key,
    type: "keyDown"
  });
  await cdp.send("Input.dispatchKeyEvent", {
    code: key,
    key,
    type: "keyUp"
  });
}

async function keyChord(cdp, key, options = {}) {
  const modifiers = process.platform === "darwin" ? 4 : 2;
  const code = `Key${key.toUpperCase()}`;
  const virtualKeyCode = key.toUpperCase().charCodeAt(0);
  await cdp.send("Input.dispatchKeyEvent", {
    code,
    key,
    modifiers: options.shift ? modifiers | 8 : modifiers,
    nativeVirtualKeyCode: virtualKeyCode,
    type: "keyDown",
    windowsVirtualKeyCode: virtualKeyCode
  });
  await cdp.send("Input.dispatchKeyEvent", {
    code,
    key,
    modifiers: options.shift ? modifiers | 8 : modifiers,
    nativeVirtualKeyCode: virtualKeyCode,
    type: "keyUp",
    windowsVirtualKeyCode: virtualKeyCode
  });
}

async function typeCharacter(cdp, character) {
  await cdp.send("Input.dispatchKeyEvent", {
    key: character,
    text: character,
    type: "keyDown",
    unmodifiedText: character
  });
  await cdp.send("Input.dispatchKeyEvent", {
    key: character,
    type: "keyUp"
  });
}

function assertIncludes(value, expected, label) {
  if (!String(value).includes(expected)) {
    throw new Error(
      `Expected ${label} to include ${JSON.stringify(expected)}.\nActual value:\n${String(value)}`
    );
  }
}

function assertNotIncludes(value, expected, label) {
  if (String(value).includes(expected)) {
    throw new Error(
      `Expected ${label} not to include ${JSON.stringify(expected)}.\nActual value:\n${String(value)}`
    );
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
    await screenshot(cdp, "source-editing-baseline-loaded.png");

    await evaluate(cdp, "window.__MME_DEMO_VISUAL_CHECK__.setCursorToEnd()");
    await cdp.send("Input.insertText", {
      text: "\n\n## MME-0007 keyboard QA\n\n- first list item"
    });
    await press(cdp, "Enter");
    await cdp.send("Input.insertText", {
      text: "continued list item"
    });
    await press(cdp, "Enter");
    await press(cdp, "Enter");
    await cdp.send("Input.insertText", {
      text: "plain paragraph after list\n\n- [ ] first checkbox"
    });
    await press(cdp, "Enter");
    await cdp.send("Input.insertText", {
      text: "continued checkbox"
    });
    await press(cdp, "Enter");
    await press(cdp, "Enter");
    await cdp.send("Input.insertText", {
      text: "plain paragraph after checkbox"
    });
    await wait(100);
    const listMarkdown = await getMarkdown(cdp);
    assertIncludes(
      listMarkdown,
      "- continued list item\nplain paragraph after list",
      "list continuation and exit"
    );
    assertIncludes(
      listMarkdown,
      "- [ ] continued checkbox\nplain paragraph after checkbox",
      "checkbox continuation and exit"
    );
    assertNotIncludes(listMarkdown, "- plain paragraph after list", "list marker after exit");
    assertNotIncludes(listMarkdown, "- [ ] plain paragraph after checkbox", "checkbox marker after exit");
    await screenshot(cdp, "source-editing-list-checkbox-exit.png");

    await evaluate(cdp, "window.__MME_DEMO_VISUAL_CHECK__.setCursorToEnd()");
    for (const character of ["(", "[", "{", "\"", "`"]) {
      await typeCharacter(cdp, character);
      await evaluate(cdp, "window.__MME_DEMO_VISUAL_CHECK__.setCursorToEnd()");
    }
    const pairedMarkdown = await getMarkdown(cdp);
    assertIncludes(pairedMarkdown, "()", "parentheses pairing");
    assertIncludes(pairedMarkdown, "[]", "bracket pairing");
    assertIncludes(pairedMarkdown, "{}", "brace pairing");
    assertIncludes(pairedMarkdown, "\"\"", "quote pairing");
    assertIncludes(pairedMarkdown, "``", "backtick pairing");

    await evaluate(cdp, "window.__MME_DEMO_VISUAL_CHECK__.setCursorToEnd()");
    await cdp.send("Input.insertText", {
      text: "\n\n```ts\n"
    });
    await press(cdp, "Tab");
    await cdp.send("Input.insertText", {
      text: "const insideFence = true;"
    });
    await cdp.send("Input.insertText", {
      text: "\n```\n[[MME-0007 visual opaque]]"
    });
    await wait(150);
    const codeFenceMarkdown = await getMarkdown(cdp);
    assertIncludes(codeFenceMarkdown, "```ts", "code fence opening");
    assertIncludes(codeFenceMarkdown, "const insideFence = true;", "code fence editing");
    assertIncludes(codeFenceMarkdown, "[[MME-0007 visual opaque]]", "opaque syntax typed");
    const diagnosticsText = await evaluate(
      cdp,
      "document.querySelector('[data-testid=\"roundtrip-diagnostics\"]').innerText"
    );
    assertIncludes(diagnosticsText, "opaque_preserved", "opaque_preserved diagnostic");
    await screenshot(cdp, "source-editing-code-fence-keyboard.png");

    const beforeUndo = await getMarkdown(cdp);
    await cdp.send("Input.insertText", {
      text: "\nundo-redo-marker"
    });
    await keyChord(cdp, "z");
    await wait(100);
    assertNotIncludes(await getMarkdown(cdp), "undo-redo-marker", "undo");
    await keyChord(cdp, "z", {
      shift: true
    });
    await wait(100);
    assertIncludes(await getMarkdown(cdp), "undo-redo-marker", "redo");
    if (beforeUndo === (await getMarkdown(cdp))) {
      throw new Error("Redo should restore the edited document.");
    }

    const selectionAnchor = (await getMarkdown(cdp)).indexOf("MME-0007 keyboard QA");
    await evaluate(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.setSelection(${selectionAnchor}, ${selectionAnchor + 8})`
    );
    const beforeSelection = await evaluate(cdp, "window.__MME_DEMO_VISUAL_CHECK__.getSelectionRange()");
    await evaluate(cdp, "window.__MME_DEMO_VISUAL_CHECK__.forceStatusRefresh()");
    const afterSelection = await evaluate(cdp, "window.__MME_DEMO_VISUAL_CHECK__.getSelectionRange()");
    if (beforeSelection.anchor !== afterSelection.anchor || beforeSelection.head !== afterSelection.head) {
      throw new Error("Selection changed during non-destructive status refresh.");
    }
    await screenshot(cdp, "source-editing-selection-preserved.png");

    cdp.close();
    console.log(`MME-0007 visual artifacts saved to ${visualDir}`);
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
    await rm(userDataDir, {
      force: true,
      maxRetries: 3,
      recursive: true,
      retryDelay: 100
    });
  }
}

await main();
