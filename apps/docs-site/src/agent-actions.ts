import actionsRegistryJson from "../../../docs/agent/actions.json";

export interface AgentActionDescriptor {
  readonly availability: "shipped" | "future";
  readonly id: string;
  readonly label: string;
  readonly payload: {
    readonly href?: "page.rawUrl";
    readonly kind: "copy" | "external-workflow" | "hosted-ai" | "link" | "open-in-chat";
    readonly prompt?: "page.prompt";
    readonly success?: string;
    readonly value?: "browser.currentUrl" | "page.currentSection" | "page.prompt" | "page.source";
    readonly workflow?: string;
  };
  readonly sourceDocs: readonly string[];
  readonly testId?: string;
}

export interface OpenInChatTargetDescriptor {
  readonly availability: "shipped" | "future";
  readonly baseUrl?: string;
  readonly id: string;
  readonly label: string;
  readonly maxEncodedPromptLength?: number;
  readonly mode: "copy-only" | "query-param";
  readonly parameterName?: string;
}

export interface AgentActionRegistry {
  readonly generatedBy: string;
  readonly openInChatTargets: readonly OpenInChatTargetDescriptor[];
  readonly pageActions: readonly AgentActionDescriptor[];
  readonly schema: string;
  readonly sourceBoundary: "public-docs-only";
  readonly sourceHash: string;
}

export function getDocsAgentActionRegistry(): AgentActionRegistry {
  const registry = actionsRegistryJson as AgentActionRegistry;
  assertAgentActionRegistry(registry);
  return registry;
}

function assertAgentActionRegistry(registry: AgentActionRegistry): void {
  if (registry.schema !== "https://momentarise.dev/schemas/agent-actions.v0.json") {
    throw new Error("Invalid MME agent action registry schema.");
  }
  if (registry.sourceBoundary !== "public-docs-only") {
    throw new Error("MME agent action registry must stay public-docs-only.");
  }
  if (!Array.isArray(registry.pageActions) || !Array.isArray(registry.openInChatTargets)) {
    throw new Error("MME agent action registry is malformed.");
  }
}
