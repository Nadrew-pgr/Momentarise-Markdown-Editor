import {
  createMarkdownEditorSession
} from "../packages/md-editor/dist/index.js";
import { createMockAiProvider } from "../packages/md-ai/dist/index.js";
import { createPolicyResolver } from "../packages/md-policy/dist/index.js";
import { createMemorySaveTarget } from "../packages/md-save/dist/index.js";

const initialContent = "# Session\n\nDraft body.\n";
const target = createMemorySaveTarget({
  initialContent,
  targetLabel: "memory://session.md"
});
const scheduler = createManualScheduler();
const provider = createMockAiProvider();
const events = [];

const session = createMarkdownEditorSession({
  aiProvider: provider,
  autosaveDelayMs: 25,
  content: initialContent,
  path: "notes/session.md",
  scheduler,
  target
});

const unsubscribers = [
  session.on("change", (payload) => events.push(["change", payload.content])),
  session.on("diagnostics", (payload) => events.push(["diagnostics", payload.diagnostics.length])),
  session.on("save-state", (payload) => events.push(["save-state", payload.status])),
  session.on("mode", (payload) => events.push(["mode", payload.mode])),
  session.on("destroy", () => events.push(["destroy"]))
];

if (session.getContent() !== initialContent) {
  throw new Error("Session must expose the canonical initial Markdown content.");
}

if (session.getParseResult() !== session.getParseResult()) {
  throw new Error("Session parse result should be cached until content changes.");
}

session.setMode("rich");
if (session.getMode() !== "rich") {
  throw new Error("Session mode setter must update mode state.");
}

const editedContent = "# Session\n\nEdited body.\n";
session.setContent(editedContent, "source-view");
if (session.getContent() !== editedContent) {
  throw new Error("Session setContent must update canonical content.");
}

if (!events.some(([event, payload]) => event === "change" && payload === editedContent)) {
  throw new Error("Session must emit change after content mutation.");
}

if (target.readContent() !== initialContent) {
  throw new Error("Autosave must not run before the injected scheduler fires.");
}

await scheduler.tick();
if (target.readContent() !== editedContent) {
  throw new Error("Injected scheduler tick should flush autosave to the save target.");
}

const parseAfterEdit = session.getParseResult();
if (parseAfterEdit === session.getParseResult()) {
  // cached after the first parse for edited content
} else {
  throw new Error("Session should cache parse result for the current content.");
}

target.simulateExternalChange("# Session\n\nExternal edit.\n");
session.setContent("# Session\n\nLocal conflicting edit.\n", "source-view");
const conflict = await session.flush("manual");
if (conflict.status !== "conflict" || session.getSaveState().status !== "conflict") {
  throw new Error("Session flush should surface Save Engine conflicts.");
}

session.startAiSession("sk-test-session-key");
const suggestion = await session.requestAiSuggestion({
  action: "improve",
  prompt: "Make it stronger.",
  selection: {
    from: 0,
    to: "# Session".length
  }
});
if (suggestion.status !== "pending" || !suggestion.baseHash) {
  throw new Error("AI suggestions must be pending and anchored to the source hash.");
}

session.setContent(`${session.getContent()}\nConcurrent edit.\n`, "host");
const staleAccepted = session.acceptPendingSuggestion();
if (staleAccepted !== null) {
  throw new Error("Accepting a stale AI suggestion must refuse to mutate content.");
}
if (!session.getPendingSuggestion() || session.getPendingSuggestion().status !== "stale") {
  throw new Error("Stale AI accept should mark the pending suggestion stale.");
}

const allowedSuggestion = await session.requestAiSuggestion({
  action: "insert-block",
  prompt: "Add a note."
});
if (allowedSuggestion.status !== "pending") {
  throw new Error("Allowed AI request should return a pending suggestion.");
}
const acceptedContent = session.acceptPendingSuggestion();
if (!acceptedContent || !acceptedContent.includes("AI suggestion")) {
  throw new Error("Accepting a fresh AI suggestion should apply it through the session.");
}

const deniedSession = createMarkdownEditorSession({
  aiProvider: createMockAiProvider(),
  content: "# Secret\n\nDo not send.\n",
  path: "private/secret.md",
  policyResolver: createPolicyResolver({
    hardDenyRules: [],
    rules: [
      {
        capabilities: ["share"],
        effect: "deny",
        id: "deny-session-ai-share",
        pathPattern: /^private\//,
        reason: "Workspace policy denies AI sharing",
        source: "workspace"
      }
    ]
  }),
  scheduler: createManualScheduler(),
  target: createMemorySaveTarget({
    initialContent: "# Secret\n\nDo not send.\n"
  })
});
deniedSession.startAiSession("sk-test-denied");
const deniedSuggestion = await deniedSession.requestAiSuggestion({
  action: "summarize"
});
if (deniedSuggestion.status !== "blocked") {
  throw new Error("Session AI request must honor policy-denied sharing.");
}
deniedSession.destroy();

for (const unsubscribe of unsubscribers) {
  unsubscribe();
}
session.setContent("# Session\n\nAfter unsubscribe.\n", "host");
if (events.some(([event, payload]) => event === "change" && payload === "# Session\n\nAfter unsubscribe.\n")) {
  throw new Error("Unsubscribed session handlers must not receive future events.");
}

const destroyScheduler = createManualScheduler();
const destroySession = createMarkdownEditorSession({
  content: "# Destroy\n",
  scheduler: destroyScheduler,
  target: createMemorySaveTarget({
    initialContent: "# Destroy\n"
  })
});
let destroyEventSeen = false;
destroySession.on("destroy", () => {
  destroyEventSeen = true;
});
destroySession.setContent("# Destroy\n\nPending autosave.\n", "host");
if (destroyScheduler.pendingCount() === 0) {
  throw new Error("Dirty content should schedule autosave before destroy.");
}
destroySession.destroy();
if (destroyScheduler.pendingCount() !== 0) {
  throw new Error("Destroy must cancel pending scheduler callbacks.");
}
if (!destroyEventSeen) {
  throw new Error("Destroy must emit a destroy event.");
}
session.destroy();

function createManualScheduler() {
  const callbacks = [];
  return {
    pendingCount() {
      return callbacks.filter(Boolean).length;
    },
    schedule(callback) {
      callbacks.push(callback);
      const index = callbacks.length - 1;
      return () => {
        callbacks[index] = null;
      };
    },
    async tick() {
      const pending = callbacks.splice(0);
      for (const callback of pending) {
        if (callback) {
          await callback();
        }
      }
    }
  };
}
