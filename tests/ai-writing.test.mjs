import {
  acceptAiSuggestion,
  createAiWritingSession,
  createMockAiProvider,
  createOpenAiCompatibleProvider,
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

const openAiCompatibleCalls = [];
const openAiCompatibleProvider = createOpenAiCompatibleProvider({
  apiKey: "sk-test-openai-compatible-must-stay-out-of-payloads",
  endpoint: "http://127.0.0.1:4000/v1/chat/completions",
  mode: "personal-byok",
  model: "local-test-model",
  providerName: "local-litellm",
  transport: async (request) => {
    openAiCompatibleCalls.push(request);
    return {
      body: {
        choices: [
          {
            message: {
              content: "Mapped provider suggestion"
            }
          }
        ]
      },
      status: 200
    };
  }
});

const realSession = createAiWritingSession({
  apiKey: "memory-only-browser-session",
  provider: openAiCompatibleProvider
});
const realSuggestion = await requestAiSuggestion(realSession, {
  action: "rewrite",
  document: {
    content: originalMarkdown,
    path: "notes/openai-compatible.md"
  },
  prompt: "Make it concrete.",
  selection: {
    from: originalMarkdown.indexOf("This"),
    to: originalMarkdown.indexOf("rough.") + "rough.".length
  }
});

if (realSuggestion.status !== "pending" || realSuggestion.replacement !== "Mapped provider suggestion") {
  throw new Error("OpenAI-compatible provider must map chat responses into AiWritingSuggestion replacements.");
}
if (realSuggestion.title !== "local-litellm rewrite") {
  throw new Error("OpenAI-compatible provider must return a stable title for staged suggestions.");
}
if (openAiCompatibleCalls.length !== 1) {
  throw new Error("OpenAI-compatible provider should call the configured host transport exactly once.");
}
const [openAiRequest] = openAiCompatibleCalls;
if (openAiRequest.url !== "http://127.0.0.1:4000/v1/chat/completions") {
  throw new Error("OpenAI-compatible provider must use the configured endpoint.");
}
if (openAiRequest.headers.Authorization !== "Bearer sk-test-openai-compatible-must-stay-out-of-payloads") {
  throw new Error("Personal BYOK mode must pass the memory-only key only as the auth header.");
}
const providerPayload = JSON.stringify(openAiRequest.body);
for (const leaked of [
  "sk-test-openai-compatible-must-stay-out-of-payloads",
  "memory-only-browser-session"
]) {
  if (providerPayload.includes(leaked)) {
    throw new Error("OpenAI-compatible payload must not include configured keys.");
  }
}
if (JSON.stringify(openAiCompatibleProvider).includes("sk-test-openai-compatible")) {
  throw new Error("OpenAI-compatible provider must not serialize configured keys.");
}

const localGatewayCalls = [];
const localGatewayProvider = createOpenAiCompatibleProvider({
  endpoint: "http://127.0.0.1:11434/v1/chat/completions",
  mode: "sidecar-local",
  model: "local-model",
  providerName: "local-gateway",
  transport: async (request) => {
    localGatewayCalls.push(request);
    return {
      body: {
        choices: [
          {
            text: "Mapped completion suggestion"
          }
        ]
      },
      status: 200
    };
  }
});
const localGatewaySession = createAiWritingSession({
  credentialStatus: "host-managed",
  provider: localGatewayProvider
});
const localGatewaySuggestion = await requestAiSuggestion(localGatewaySession, {
  action: "complete",
  document: {
    content: originalMarkdown,
    path: "notes/local-gateway.md"
  }
});
if (localGatewaySuggestion.replacement !== "Mapped completion suggestion") {
  throw new Error("OpenAI-compatible provider must map completion-style choices too.");
}
if ("Authorization" in localGatewayCalls[0].headers) {
  throw new Error("Host-managed/local gateway mode must not invent a browser Authorization header.");
}

const deniedOpenAiCalls = [];
const deniedOpenAiProvider = createOpenAiCompatibleProvider({
  endpoint: "http://127.0.0.1:4000/v1/chat/completions",
  mode: "host-managed",
  model: "local-test-model",
  providerName: "blocked-host-provider",
  transport: async (request) => {
    deniedOpenAiCalls.push(request);
    return {
      body: {
        choices: [
          {
            message: {
              content: "This should not be called"
            }
          }
        ]
      },
      status: 200
    };
  }
});
const deniedOpenAiSession = createAiWritingSession({
  credentialStatus: "host-managed",
  policyResolver: createPolicyResolver({
    hardDenyRules: [],
    rules: [
      {
        capabilities: ["share"],
        effect: "deny",
        id: "deny-openai-compatible",
        pathPattern: /^private\//,
        reason: "Workspace policy denies AI sharing",
        source: "workspace"
      }
    ]
  }),
  provider: deniedOpenAiProvider
});
const deniedOpenAiSuggestion = await requestAiSuggestion(deniedOpenAiSession, {
  action: "summarize",
  document: {
    content: "# Secret\n\nDo not send.",
    path: "private/openai.md"
  }
});
if (deniedOpenAiSuggestion.status !== "blocked" || deniedOpenAiCalls.length !== 0) {
  throw new Error("Policy denial must prevent OpenAI-compatible host transport calls.");
}
