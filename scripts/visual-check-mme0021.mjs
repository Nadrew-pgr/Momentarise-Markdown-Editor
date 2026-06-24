import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { requireChromeExecutable } from "./chrome-helpers.mjs";

const chromePath = requireChromeExecutable();
const demoUrl = process.env.MME_DEMO_URL ?? "http://127.0.0.1:5174/";
const visualDir = "docs/internal/visual-checks/MME-0021";
const port = 12600 + Math.floor(Math.random() * 500);
const userDataDir = `/tmp/mme-visual-0021-${Date.now()}`;

const listEditingMarkdown = `# Rich list editing

- Parent task group
- [ ] Child todo to indent
- Peer bullet

1. Ordered parent
2. Ordered child
`;

const enterBeforeHeadingMarkdown = `# Enter caret check

- Alpha
## Next
`;

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

async function pressRichKey(cdp, key, options = {}) {
  await evaluate(
    cdp,
    `(() => {
      const view = document.querySelector('[data-testid="rich-editor-host"] .ProseMirror');
      if (!view) throw new Error("Missing rich editor view");
      view.focus();
      view.dispatchEvent(new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key: ${JSON.stringify(key)},
        shiftKey: ${Boolean(options.shiftKey)}
      }));
      return true;
    })()`
  );
}

async function pressNativeRichKey(cdp, key, options = {}) {
  await evaluate(
    cdp,
    `(() => {
      const view = document.querySelector('[data-testid="rich-editor-host"] .ProseMirror');
      if (!view) throw new Error("Missing rich editor view");
      view.focus();
      return true;
    })()`
  );
  await cdp.send("Input.dispatchKeyEvent", {
    code: options.code ?? key,
    key,
    type: "keyDown",
    windowsVirtualKeyCode: options.virtualKeyCode
  });
  await cdp.send("Input.dispatchKeyEvent", {
    code: options.code ?? key,
    key,
    type: "keyUp",
    windowsVirtualKeyCode: options.virtualKeyCode
  });
}

async function typeRichText(cdp, text) {
  await cdp.send("Input.insertText", { text });
}

async function main() {
  await mkdir(visualDir, { recursive: true });
  await writeFile(
    join(visualDir, "README.md"),
    [
      "# MME-0021 visual checks",
      "",
      "- `list-todo-rich-loaded.png`: rich mode loaded with sibling bullet/todo and ordered items.",
      "- `list-todo-keyboard-checked.png`: focusing the todo checkbox and pressing Space toggles it checked.",
      "- `list-todo-after-tab.png`: `Tab` nests the todo item under the previous list item.",
      "- `list-todo-after-shift-tab.png`: `Shift+Tab` outdents the nested todo item back to a sibling.",
      "- `list-enter-caret-before-heading.png`: after `Enter` before a following heading, typed text lands in the new bullet item rather than the heading.",
      "- `list-nested-empty-exit.png`: an empty nested bullet exits to the parent list level and preserves the nested sibling content.",
      "- `list-parent-empty-backspace.png`: `Backspace` on an empty parent-level item after a nested list removes the empty item and leaves the caret at the nested child.",
      "- `list-deep-grandchild-delete.png`: deleting the only grandchild bullet removes the child list without leaving an empty paragraph in the parent child item.",
      ""
    ].join("\n")
  );

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
      `window.__MME_DEMO_VISUAL_CHECK__.loadImportedCopyForTest("list-editing.md", ${JSON.stringify(listEditingMarkdown)})`
    );
    await clickByTestId(cdp, "rich-mode-button");
    await waitFor(cdp, `window.__MME_DEMO_VISUAL_CHECK__.getEditorMode() === "rich"`, "rich mode active");
    await waitFor(
      cdp,
      `document.querySelector('[data-testid="rich-editor-host"]')?.textContent.includes("Child todo to indent")`,
      "rich list document rendered"
    );
    await screenshot(cdp, "list-todo-rich-loaded.png");

    await evaluate(
      cdp,
      `(() => {
        const todo = Array.from(document.querySelectorAll('[data-type="todo-item"]')).find((element) =>
          element.textContent.includes("Child todo to indent")
        );
        if (!todo) throw new Error("Missing Child todo item");
        const toggle = todo.querySelector("[data-todo-toggle]");
        if (!toggle) throw new Error("Missing todo toggle");
        toggle.focus();
        toggle.dispatchEvent(new KeyboardEvent("keydown", {
          bubbles: true,
          cancelable: true,
          key: " "
        }));
        return true;
      })()`
    );
    await waitFor(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.getMarkdown().includes("- [x] Child todo to indent")`,
      "todo checked by keyboard Space"
    );
    await screenshot(cdp, "list-todo-keyboard-checked.png");
    await evaluate(
      cdp,
      `(() => {
        const todo = Array.from(document.querySelectorAll('[data-type="todo-item"]')).find((element) =>
          element.textContent.includes("Child todo to indent")
        );
        const toggle = todo?.querySelector("[data-todo-toggle]");
        if (!toggle) throw new Error("Missing todo toggle for reset");
        toggle.dispatchEvent(new KeyboardEvent("keydown", {
          bubbles: true,
          cancelable: true,
          key: " "
        }));
        return true;
      })()`
    );
    await waitFor(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.getMarkdown().includes("- [ ] Child todo to indent")`,
      "todo reset by keyboard Space"
    );

    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.setRichSelectionAfterText("Child todo to indent")`);
    await pressRichKey(cdp, "Tab");
    await waitFor(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.getMarkdown().includes("- Parent task group\\n  - [ ] Child todo to indent")`,
      "todo nested after Tab"
    );
    await screenshot(cdp, "list-todo-after-tab.png");

    await pressRichKey(cdp, "Tab", { shiftKey: true });
    await waitFor(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.getMarkdown().includes("- Parent task group\\n- [ ] Child todo to indent")`,
      "todo outdented after Shift+Tab"
    );
    await screenshot(cdp, "list-todo-after-shift-tab.png");

    await evaluate(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.loadImportedCopyForTest("enter-before-heading.md", ${JSON.stringify(enterBeforeHeadingMarkdown)})`
    );
    await waitFor(
      cdp,
      `document.querySelector('[data-testid="rich-editor-host"]')?.textContent.includes("Alpha")`,
      "enter-before-heading document rendered"
    );
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.setRichSelectionAfterText("Alpha")`);
    await pressRichKey(cdp, "Enter");
    await typeRichText(cdp, "Second item");
    await waitFor(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.getMarkdown().includes("- Alpha\\n- Second item\\n## Next")`,
      "typed text inserted into new bullet before heading"
    );
    await screenshot(cdp, "list-enter-caret-before-heading.png");

    await evaluate(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.loadImportedCopyForTest("nested-empty-exit.md", ${JSON.stringify("# Nested empty exit\n\n- Alpha\n")})`
    );
    await waitFor(
      cdp,
      `document.querySelector('[data-testid="rich-editor-host"]')?.textContent.includes("Alpha")`,
      "nested-empty-exit document rendered"
    );
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.setRichSelectionAfterText("Alpha")`);
    await pressRichKey(cdp, "Enter");
    await pressRichKey(cdp, "Tab");
    await typeRichText(cdp, "regftez");
    await pressRichKey(cdp, "Enter");
    await pressRichKey(cdp, "Enter");
    await typeRichText(cdp, "parent level");
    await waitFor(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.getMarkdown().includes("- Alpha\\n  - regftez\\n- parent level")`,
      "empty nested bullet exited to parent level"
    );
    await screenshot(cdp, "list-nested-empty-exit.png");

    await evaluate(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.loadImportedCopyForTest("parent-empty-backspace.md", ${JSON.stringify("# Parent empty backspace\n\n- oino\n")})`
    );
    await waitFor(
      cdp,
      `document.querySelector('[data-testid="rich-editor-host"]')?.textContent.includes("oino")`,
      "parent-empty-backspace document rendered"
    );
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.setRichSelectionAfterText("oino")`);
    await pressRichKey(cdp, "Enter");
    await pressRichKey(cdp, "Tab");
    await typeRichText(cdp, "noino");
    await pressRichKey(cdp, "Enter");
    await pressRichKey(cdp, "Enter");
    await waitFor(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.getMarkdown().includes("- oino\\n  - noino\\n-")`,
      "empty parent item exists after nested child"
    );
    await pressRichKey(cdp, "Backspace");
    await waitFor(
      cdp,
      `(() => {
        const markdown = window.__MME_DEMO_VISUAL_CHECK__.getMarkdown();
        const selection = window.getSelection();
        return markdown.includes("- oino\\n  - noino") &&
          !markdown.includes("\\n-\\n") &&
          selection?.anchorNode?.textContent === "noino" &&
          selection.anchorOffset === "noino".length;
      })()`,
      "empty parent item removed and caret stays at nested child"
    );
    await screenshot(cdp, "list-parent-empty-backspace.png");

    await evaluate(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.loadImportedCopyForTest("deep-grandchild-delete.md", ${JSON.stringify("# Deep grandchild delete\n\n- Parent\n")})`
    );
    await waitFor(
      cdp,
      `document.querySelector('[data-testid="rich-editor-host"]')?.textContent.includes("Parent")`,
      "deep-grandchild-delete document rendered"
    );
    await evaluate(cdp, `window.__MME_DEMO_VISUAL_CHECK__.setRichSelectionAfterText("Parent")`);
    await pressRichKey(cdp, "Enter");
    await pressRichKey(cdp, "Tab");
    await typeRichText(cdp, "Child");
    await pressRichKey(cdp, "Enter");
    await pressRichKey(cdp, "Tab");
    await typeRichText(cdp, "Only grandchild");
    await waitFor(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.getMarkdown().includes("- Parent\\n  - Child\\n    - Only grandchild")`,
      "single grandchild item exists"
    );
    for (let index = 0; index < "Only grandchild".length; index += 1) {
      await pressNativeRichKey(cdp, "Backspace", { code: "Backspace", virtualKeyCode: 8 });
    }
    await waitFor(
      cdp,
      `window.__MME_DEMO_VISUAL_CHECK__.getMarkdown().includes("- Parent\\n  - Child\\n    -")`,
      "single grandchild item is empty"
    );
    await pressNativeRichKey(cdp, "Backspace", { code: "Backspace", virtualKeyCode: 8 });
    await waitFor(
      cdp,
      `(() => {
        const markdown = window.__MME_DEMO_VISUAL_CHECK__.getMarkdown();
        const selection = window.getSelection();
        return markdown.includes("- Parent\\n  - Child") &&
          !markdown.includes("Only grandchild") &&
          !markdown.includes("\\n    -") &&
          selection?.anchorNode?.textContent === "Child" &&
          selection.anchorOffset === "Child".length;
      })()`,
      "single grandchild item removed without leaving an empty paragraph"
    );
    await screenshot(cdp, "list-deep-grandchild-delete.png");

    cdp.close();
    console.log(`MME-0021 visual artifacts saved to ${visualDir}`);
  } finally {
    chrome.kill("SIGTERM");
    await Promise.race([chromeExit, wait(2000)]);
    if (chrome.exitCode === null && chrome.signalCode === null) {
      chrome.kill("SIGKILL");
      await Promise.race([chromeExit, wait(2000)]);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
