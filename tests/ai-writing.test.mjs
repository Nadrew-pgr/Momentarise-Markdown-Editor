import {
  acceptAiSuggestion,
  createAiWritingSession,
  createMockAiProvider,
  rejectAiSuggestion,
  requestAiSuggestion
} from "../packages/md-ai/dist/index.js";
import { createPolicyResolver } from "../packages/md-policy/dist/index.js";

const provider = createMockAiProvider();
const session = createAiWritingSession({
  apiKey: "sk-test-this-must-not-be-exposed",
  provider
});

if (session.apiKey || JSON.stringify(session).includes("sk-test")) {
  throw new Error("AI session must not expose or serialize the BYOK key.");
}

const originalMarkdown = "# Launch note\n\nThis section is rough.\n";
const suggestion = await requestAiSuggestion(session, {
  action: "improve",
  document: {
    content: originalMarkdown,
    path: "notes/launch.md"
  },
  prompt: "Make this more direct.",
  selection: {
    from: originalMarkdown.indexOf("This"),
    to: originalMarkdown.indexOf("rough.") + "rough.".length
  }
});

if (provider.requests.length !== 1) {
  throw new Error("Mock provider should receive one request after policy allows AI sharing.");
}

if (provider.requests[0].apiKey || JSON.stringify(provider.requests[0]).includes("sk-test")) {
  throw new Error("Provider request must not expose the BYOK key in test-observable payloads.");
}

if (suggestion.status !== "pending" || !suggestion.replacement.includes("AI suggestion")) {
  throw new Error("AI writing must return a pending suggestion from the mock provider.");
}

if (!suggestion.baseHash || typeof suggestion.baseHash !== "string") {
  throw new Error("AI writing suggestions must record the base document hash.");
}

if (originalMarkdown.includes("AI suggestion")) {
  throw new Error("AI suggestion must not silently mutate the original document.");
}

const accepted = acceptAiSuggestion(originalMarkdown, suggestion);
if (!accepted.content.includes("AI suggestion") || accepted.suggestion.status !== "accepted") {
  throw new Error("Accepting a suggestion should apply the staged replacement.");
}

const stale = acceptAiSuggestion(`${originalMarkdown}\nConcurrent edit.\n`, suggestion);
if (stale.suggestion.status !== "stale" || stale.content.includes("AI suggestion")) {
  throw new Error("Accepting a suggestion against changed content must mark it stale without mutation.");
}

const rejected = rejectAiSuggestion(originalMarkdown, suggestion);
if (rejected.content !== originalMarkdown || rejected.suggestion.status !== "rejected") {
  throw new Error("Rejecting a suggestion should leave the original document unchanged.");
}

const actions = ["complete", "rewrite", "improve", "summarize", "generate-title", "insert-block"];
for (const action of actions) {
  const result = await requestAiSuggestion(session, {
    action,
    document: {
      content: originalMarkdown,
      path: "notes/actions.md"
    },
    prompt: "Test action coverage."
  });
  if (result.action !== action || result.status !== "pending") {
    throw new Error(`Mock provider did not produce a pending suggestion for ${action}.`);
  }
}

const deniedProvider = createMockAiProvider();
const deniedSession = createAiWritingSession({
  apiKey: "sk-test-denied",
  policyResolver: createPolicyResolver({
    hardDenyRules: [],
    rules: [
      {
        capabilities: ["share"],
        effect: "deny",
        id: "deny-ai-share",
        pathPattern: /^private\//,
        reason: "Workspace policy denies AI sharing",
        source: "workspace"
      }
    ]
  }),
  provider: deniedProvider
});

const deniedSuggestion = await requestAiSuggestion(deniedSession, {
  action: "summarize",
  document: {
    content: "# Secret\n\nDo not send.",
    path: "private/secret.md"
  }
});

if (
  deniedSuggestion.status !== "blocked" ||
  !deniedSuggestion.policyDecision ||
  deniedSuggestion.policyDecision.allowed !== false
) {
  throw new Error("AI writing must return a blocked suggestion when policy denies share.");
}

if (deniedProvider.requests.length !== 0) {
  throw new Error("Policy-denied AI writing must not call the provider with document content.");
}
