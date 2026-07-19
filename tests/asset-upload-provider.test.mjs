import { createHash } from "node:crypto";
import {
  createMarkdownEditorSession,
  createMarkdownImageReference,
  insertMarkdownImageReference
} from "../packages/md-editor/dist/index.js";
import { applyRichMarkdownCommand, createRichMarkdownState, selectFirstRichText, serializeRichMarkdownState } from "../packages/md-rich-prosemirror/dist/index.js";
import { createPolicyResolver } from "../packages/md-policy/dist/index.js";
import { createMemorySaveTarget, hashMarkdownContent } from "../packages/md-save/dist/index.js";

const initial = "# Asset test\n\nBefore upload.\n\nAfter upload.\n";

assertEqual(
  createMarkdownImageReference({
    alt: "Design [draft]",
    title: "Q3 \"visual\"",
    url: "./assets/q3-design.png"
  }),
  '![Design \\[draft\\]](./assets/q3-design.png "Q3 \\"visual\\"")',
  "image reference must escape alt text and title without inventing non-Markdown storage"
);

assertEqual(
  createMarkdownImageReference({
    alt: "Unsafe",
    url: "data:image/png;base64,abc"
  }),
  null,
  "data URLs must not be accepted by default"
);

assertEqual(
  createMarkdownImageReference({
    alt: "Unsafe syntax",
    url: "./assets/bad path.png"
  }),
  null,
  "provider URLs with whitespace must be rejected instead of silently rewritten"
);

assertEqual(
  createMarkdownImageReference({
    alt: "Safe syntax",
    url: './assets/risky)"name".png'
  }),
  '![Safe syntax](./assets/risky%29%22name%22.png)',
  "Markdown image destinations must escape syntax-breaking URL characters"
);

const insertRange = { from: initial.indexOf("\n\nAfter upload."), to: initial.indexOf("\n\nAfter upload.") };
const inserted = insertMarkdownImageReference(initial, insertRange, {
  alt: "Diagram",
  url: "./assets/diagram.png"
});
assertIncludes(inserted.content, "![Diagram](./assets/diagram.png)", "headless image insertion must emit Markdown image syntax");
assertEqual(
  inserted.content,
  initial.replace("\n\nAfter upload.", "\n\n![Diagram](./assets/diagram.png)\n\nAfter upload."),
  "headless insertion must preserve unrelated source bytes around the inserted Markdown image"
);

let providerCalls = 0;
const provider = {
  async upload(input, context) {
    providerCalls += 1;
    assertEqual(input.name, "whiteboard.png", "provider receives asset input");
    assertEqual(context.documentPath, "notes/assets.md", "provider receives document path context");
    assert(context.requestedAt !== "1970-01-01T00:00:00.000Z", "provider context requestedAt must be a real timestamp");
    assert(Number.isFinite(Date.parse(context.requestedAt)), "provider context requestedAt must parse as an ISO timestamp");
    return {
      alt: "Whiteboard",
      title: "Sprint sketch",
      status: "uploaded",
      url: "./assets/whiteboard.png"
    };
  }
};
const session = createMarkdownEditorSession({
  assetProvider: provider,
  content: initial,
  path: "notes/assets.md",
  scheduler: createManualScheduler(),
  target: createMemorySaveTarget({ initialContent: initial })
});
const success = await session.insertAsset(
  {
    bytes: fixtureBytes("whiteboard"),
    hash: "sha256:whiteboard",
    mediaType: "image/png",
    name: "whiteboard.png",
    size: 10
  },
  {
    alt: "Fallback alt",
    range: insertRange
  }
);
assertEqual(success.status, "inserted", "provider upload should insert after uploaded result");
assertEqual(providerCalls, 1, "provider should be called once for allowed insertion");
assertIncludes(session.getContent(), '![Whiteboard](./assets/whiteboard.png "Sprint sketch")', "session insertion must use provider metadata");
assertEqual(session.getSaveState().currentHash, hashMarkdownContent(session.getContent()), "session save hash must track inserted content");

const deniedResolver = createPolicyResolver({
  hardDenyRules: [],
  rules: [
    {
      capabilities: ["export"],
      effect: "deny",
      id: "deny-asset-export",
      pathPattern: /^private\//,
      reason: "Workspace denies asset upload egress",
      source: "workspace"
    }
  ]
});
let deniedProviderCalls = 0;
const deniedSession = createMarkdownEditorSession({
  assetProvider: {
    async upload() {
      deniedProviderCalls += 1;
      return {
        status: "uploaded",
        url: "./assets/should-not-exist.png"
      };
    }
  },
  content: initial,
  path: "private/assets.md",
  policyResolver: deniedResolver,
  scheduler: createManualScheduler(),
  target: createMemorySaveTarget({ initialContent: initial })
});
const denied = await deniedSession.insertAsset({
  bytes: fixtureBytes("blocked"),
  mediaType: "image/png",
  name: "blocked.png",
  size: 7
});
assertEqual(denied.status, "denied", "policy-denied upload must return a denied result");
assertEqual(deniedProviderCalls, 0, "provider must not be called before asset egress policy passes");
assertUnchanged(deniedSession, initial, "denied upload must not mutate content or hash");

const unavailableSession = createMarkdownEditorSession({
  content: initial,
  path: "notes/no-provider.md",
  scheduler: createManualScheduler(),
  target: createMemorySaveTarget({ initialContent: initial })
});
const unavailable = await unavailableSession.insertAsset({
  bytes: fixtureBytes("missing"),
  mediaType: "image/png",
  name: "missing.png",
  size: 7
});
assertEqual(unavailable.status, "unavailable", "missing provider must be explicit");
assertUnchanged(unavailableSession, initial, "missing provider must not mutate content or hash");

const malformedInput = await unavailableSession.insertAsset({
  bytes: fixtureBytes("malformed"),
  name: "malformed.png",
  size: 9
});
assertEqual(malformedInput.status, "failed", "malformed JS asset input must return a structured failure");
assertUnchanged(unavailableSession, initial, "malformed JS asset input must not mutate content or hash");

const throwingPolicySession = createMarkdownEditorSession({
  assetProvider: provider,
  content: initial,
  path: "notes/policy-throw.md",
  policyResolver: {
    resolve() {
      throw new Error("policy resolver exploded");
    }
  },
  scheduler: createManualScheduler(),
  target: createMemorySaveTarget({ initialContent: initial })
});
const throwingPolicy = await throwingPolicySession.insertAsset({
  bytes: fixtureBytes("policy"),
  mediaType: "image/png",
  name: "policy.png",
  size: 6
});
assertEqual(throwingPolicy.status, "failed", "policy resolver exceptions must return structured failures");
assertIncludes(throwingPolicy.reason, "policy resolver exploded", "policy resolver exception reason must be returned");
assertUnchanged(throwingPolicySession, initial, "policy resolver exception must not mutate content or hash");

let failedProviderCalls = 0;
const failedSession = createMarkdownEditorSession({
  assetProvider: {
    async upload() {
      failedProviderCalls += 1;
      return {
        reason: "host storage failed",
        status: "failed"
      };
    }
  },
  content: initial,
  path: "notes/failed.md",
  scheduler: createManualScheduler(),
  target: createMemorySaveTarget({ initialContent: initial })
});
const failed = await failedSession.insertAsset({
  bytes: fixtureBytes("failed"),
  mediaType: "image/png",
  name: "failed.png",
  size: 6
});
assertEqual(failed.status, "failed", "provider failures must be explicit");
assertEqual(failedProviderCalls, 1, "provider failures happen only after policy checks");
assertUnchanged(failedSession, initial, "failed provider result must not mutate content or hash");

const pendingSession = createMarkdownEditorSession({
  assetProvider: {
    async upload() {
      return {
        reason: "asset moderation pending",
        status: "pending"
      };
    }
  },
  content: initial,
  path: "notes/pending.md",
  scheduler: createManualScheduler(),
  target: createMemorySaveTarget({ initialContent: initial })
});
const pending = await pendingSession.insertAsset({
  bytes: fixtureBytes("pending"),
  mediaType: "image/png",
  name: "pending.png",
  size: 7
});
assertEqual(pending.status, "pending", "provider pending result must remain structured");
assertUnchanged(pendingSession, initial, "pending provider result must not mutate content or hash");

const thrownSession = createMarkdownEditorSession({
  assetProvider: {
    async upload() {
      throw new Error("provider exploded");
    }
  },
  content: initial,
  path: "notes/thrown.md",
  scheduler: createManualScheduler(),
  target: createMemorySaveTarget({ initialContent: initial })
});
const thrown = await thrownSession.insertAsset({
  bytes: fixtureBytes("thrown"),
  mediaType: "image/png",
  name: "thrown.png",
  size: 6
});
assertEqual(thrown.status, "failed", "provider exceptions must return structured failures");
assertIncludes(thrown.reason, "provider exploded", "provider exception reason must be returned");
assertUnchanged(thrownSession, initial, "provider exception must not mutate content or hash");

const unsafeUrlSession = createMarkdownEditorSession({
  assetProvider: {
    async upload() {
      return {
        status: "uploaded",
        url: "javascript:alert(1)"
      };
    }
  },
  content: initial,
  path: "notes/unsafe-url.md",
  scheduler: createManualScheduler(),
  target: createMemorySaveTarget({ initialContent: initial })
});
const unsafeUrl = await unsafeUrlSession.insertAsset({
  bytes: fixtureBytes("unsafe"),
  mediaType: "image/png",
  name: "unsafe.png",
  size: 6
});
assertEqual(unsafeUrl.status, "failed", "unsafe provider URLs must not be inserted");
assertUnchanged(unsafeUrlSession, initial, "unsafe provider URLs must not mutate content or hash");

const richSource = "# Rich asset\n\nBefore stays.\n\nCaption\n\n> Keep quote\n";
const selectedRichSource = selectFirstRichText(createRichMarkdownState(richSource), "Caption");
const richImage = applyRichMarkdownCommand(selectedRichSource, "image", {
  alt: "Rich [image]",
  src: "./assets/rich.png",
  title: "Rich \"title\""
});
assertEqual(
  serializeRichMarkdownState(richImage).content,
  '# Rich asset\n\nBefore stays.\n\n![Rich \\[image\\]](./assets/rich.png "Rich \\"title\\"")\n\n> Keep quote\n',
  "rich image insertion must serialize exact Markdown while preserving unrelated source blocks"
);

function fixtureBytes(label) {
  return createHash("sha256").update(label).digest();
}

function createManualScheduler() {
  return {
    schedule() {
      return () => {};
    }
  };
}

function assertUnchanged(session, expected, label) {
  assertEqual(session.getContent(), expected, label);
  assertEqual(session.getSaveState().currentHash, hashMarkdownContent(expected), `${label}: current hash changed`);
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}.`);
  }
}

function assertIncludes(content, expected, label) {
  if (!content.includes(expected)) {
    throw new Error(`${label}: missing ${JSON.stringify(expected)}.\n${content}`);
  }
}

function assert(condition, label) {
  if (!condition) {
    throw new Error(label);
  }
}
