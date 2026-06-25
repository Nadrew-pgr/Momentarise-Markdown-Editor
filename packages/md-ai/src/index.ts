import { hashMarkdownContent, type DocumentHash, type PolicyDecision } from "@momentarise/md-core";
import { createDefaultPolicyResolver, type PolicyResolver } from "@momentarise/md-policy";

export interface AiWritingContract {
  readonly packageName: "@momentarise/md-ai";
  readonly dependsOnCore: true;
  readonly policyCapability: "share";
}

export type AiWritingAction =
  | "complete"
  | "rewrite"
  | "improve"
  | "summarize"
  | "generate-title"
  | "insert-block";

export interface AiDocumentInput {
  readonly content: string;
  readonly path: string | null;
}

export interface AiSelectionRange {
  readonly from: number;
  readonly to: number;
}

export interface AiWritingRequest {
  readonly action: AiWritingAction;
  readonly document: AiDocumentInput;
  readonly prompt?: string;
  readonly selection?: AiSelectionRange;
}

export interface AiProviderRequest extends AiWritingRequest {
  readonly selectedText: string;
}

export interface AiProvider {
  readonly providerName: string;
  generate(request: AiProviderRequest): Promise<AiProviderSuggestion>;
}

export interface AiProviderSuggestion {
  readonly replacement: string;
  readonly title: string;
}

export type AiSuggestionStatus = "pending" | "accepted" | "rejected" | "blocked" | "stale";

export interface AiWritingSuggestion {
  readonly action: AiWritingAction;
  readonly baseHash: DocumentHash;
  readonly id: string;
  readonly originalRange: AiSelectionRange;
  readonly policyDecision?: PolicyDecision;
  readonly replacement: string;
  readonly status: AiSuggestionStatus;
  readonly title: string;
}

export interface AiWritingSession {
  readonly credentialStatus: "byok-present";
  readonly providerName: string;
  requestSuggestion(request: AiWritingRequest): Promise<AiWritingSuggestion>;
}

export interface CreateAiWritingSessionOptions {
  readonly apiKey: string;
  readonly policyResolver?: PolicyResolver;
  readonly provider: AiProvider;
}

export interface AiSuggestionApplyResult {
  readonly content: string;
  readonly suggestion: AiWritingSuggestion;
}

export interface MockAiProvider extends AiProvider {
  readonly requests: AiProviderRequest[];
}

export const aiWritingPackage: AiWritingContract = {
  dependsOnCore: true,
  packageName: "@momentarise/md-ai",
  policyCapability: "share"
};

export function createAiWritingSession(options: CreateAiWritingSessionOptions): AiWritingSession {
  if (!options.apiKey.trim()) {
    throw new Error("BYOK API key is required to start an AI writing session.");
  }

  const provider = options.provider;
  const policyResolver = options.policyResolver ?? createDefaultPolicyResolver();
  const internalSession = createInternalSession({
    policyResolver,
    provider
  });

  return {
    credentialStatus: "byok-present",
    providerName: provider.providerName,
    requestSuggestion(request) {
      return requestAiSuggestion(internalSession, request);
    }
  };
}

export async function requestAiSuggestion(
  session: AiWritingSession,
  request: AiWritingRequest
): Promise<AiWritingSuggestion> {
  const internalSession = isInternalAiSession(session) ? session : null;
  if (!internalSession) {
    return session.requestSuggestion(request);
  }

  const policyDecision = internalSession.policyResolver.resolve({
    capability: "share",
    subject: {
      documentPath: request.document.path
    }
  });

  const originalRange = normalizeSelectionRange(request);
  const baseHash = hashMarkdownContent(request.document.content);
  if (!policyDecision.allowed) {
    return {
      action: request.action,
      baseHash,
      id: createSuggestionId(request.action),
      originalRange,
      policyDecision,
      replacement: "",
      status: "blocked",
      title: `Blocked ${labelForAction(request.action)}`
    };
  }

  const providerSuggestion = await internalSession.provider.generate({
    ...request,
    selectedText: selectedTextForRequest(request)
  });

  return {
    action: request.action,
    baseHash,
    id: createSuggestionId(request.action),
    originalRange,
    policyDecision,
    replacement: providerSuggestion.replacement,
    status: "pending",
    title: providerSuggestion.title
  };
}

export function acceptAiSuggestion(content: string, suggestion: AiWritingSuggestion): AiSuggestionApplyResult {
  if (suggestion.status !== "pending") {
    return {
      content,
      suggestion
    };
  }

  if (hashMarkdownContent(content) !== suggestion.baseHash) {
    return {
      content,
      suggestion: {
        ...suggestion,
        status: "stale"
      }
    };
  }

  const range = clampRange(suggestion.originalRange, content.length);
  return {
    content: `${content.slice(0, range.from)}${suggestion.replacement}${content.slice(range.to)}`,
    suggestion: {
      ...suggestion,
      status: "accepted"
    }
  };
}

export function rejectAiSuggestion(content: string, suggestion: AiWritingSuggestion): AiSuggestionApplyResult {
  return {
    content,
    suggestion: {
      ...suggestion,
      status: "rejected"
    }
  };
}

export function createMockAiProvider(): MockAiProvider {
  const requests: AiProviderRequest[] = [];
  return {
    providerName: "mock",
    requests,
    async generate(request) {
      requests.push(request);
      return {
        replacement: mockReplacementForRequest(request),
        title: `Mock ${labelForAction(request.action)}`
      };
    }
  };
}

interface InternalAiWritingSession extends AiWritingSession {
  readonly policyResolver: PolicyResolver;
  readonly provider: AiProvider;
}

function createInternalSession(options: {
  readonly policyResolver: PolicyResolver;
  readonly provider: AiProvider;
}): InternalAiWritingSession {
  return {
    credentialStatus: "byok-present",
    policyResolver: options.policyResolver,
    provider: options.provider,
    providerName: options.provider.providerName,
    requestSuggestion(request) {
      return requestAiSuggestion(this, request);
    }
  };
}

function isInternalAiSession(session: AiWritingSession): session is InternalAiWritingSession {
  return "policyResolver" in session && "provider" in session;
}

function normalizeSelectionRange(request: AiWritingRequest): AiSelectionRange {
  const contentLength = request.document.content.length;
  if (!request.selection) {
    return {
      from: contentLength,
      to: contentLength
    };
  }
  return clampRange(request.selection, contentLength);
}

function selectedTextForRequest(request: AiWritingRequest): string {
  const range = normalizeSelectionRange(request);
  return request.document.content.slice(range.from, range.to);
}

function clampRange(range: AiSelectionRange, contentLength: number): AiSelectionRange {
  const from = Math.max(0, Math.min(range.from, contentLength));
  const to = Math.max(from, Math.min(range.to, contentLength));
  return {
    from,
    to
  };
}

function mockReplacementForRequest(request: AiProviderRequest): string {
  const basis = request.selectedText || request.prompt || request.document.content.slice(0, 120) || "Markdown";
  const trimmedBasis = basis.trim() || "Markdown";
  switch (request.action) {
    case "complete":
      return `${trimmedBasis}\n\nAI suggestion: continue with one concrete next sentence.`;
    case "rewrite":
      return `AI suggestion rewrite: ${trimmedBasis}`;
    case "improve":
      return `AI suggestion improvement: ${trimmedBasis}`;
    case "summarize":
      return `AI suggestion summary: ${trimmedBasis.slice(0, 180)}`;
    case "generate-title":
      return `# AI suggestion title`;
    case "insert-block":
      return `\n\n> AI suggestion block: ${trimmedBasis}\n`;
  }
}

function labelForAction(action: AiWritingAction): string {
  switch (action) {
    case "complete":
      return "completion";
    case "rewrite":
      return "rewrite";
    case "improve":
      return "improvement";
    case "summarize":
      return "summary";
    case "generate-title":
      return "title";
    case "insert-block":
      return "block insertion";
  }
}

function createSuggestionId(action: AiWritingAction): string {
  const randomValue =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `ai-${action}-${randomValue}`;
}
