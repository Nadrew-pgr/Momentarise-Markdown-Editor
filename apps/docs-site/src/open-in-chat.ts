const maxEncodedPromptLength = 8000;

export interface OpenInChatTarget {
  readonly id: string;
  readonly label: string;
  buildUrl(prompt: string): string | null;
}

export const openInChatTargets: readonly OpenInChatTarget[] = [
  queryTarget("chatgpt", "ChatGPT", "https://chatgpt.com/", "q"),
  queryTarget("claude", "Claude", "https://claude.ai/new", "q"),
  queryTarget("gemini", "Gemini", "https://gemini.google.com/app", "q"),
  queryTarget("mistral", "Mistral", "https://chat.mistral.ai/chat", "q"),
  queryTarget("t3-chat", "T3 Chat", "https://t3.chat/new", "q"),
  queryTarget("scira", "Scira", "https://scira.ai/", "q"),
  copyTarget("v0", "v0"),
  copyTarget("claude-code", "Claude Code"),
  copyTarget("codex", "Codex"),
  copyTarget("cursor", "Cursor"),
  copyTarget("openclaw", "OpenClaw"),
  copyTarget("copilot", "Copilot-like agent")
];

function queryTarget(id: string, label: string, baseUrl: string, parameterName: string): OpenInChatTarget {
  return {
    buildUrl(prompt) {
      const encoded = encodeURIComponent(prompt);
      if (encoded.length > maxEncodedPromptLength) {
        return null;
      }
      return `${baseUrl}?${parameterName}=${encoded}`;
    },
    id,
    label
  };
}

function copyTarget(id: string, label: string): OpenInChatTarget {
  return {
    buildUrl() {
      return null;
    },
    id,
    label
  };
}
