export interface PromptPage {
  readonly path: string;
  readonly source: string;
  readonly title: string;
}

export const promptInstructionLines = [
  "Use web search if available.",
  "Prefer official docs.",
  "Cite sources when browsing.",
  "Respect Momentarise Markdown Editor's Markdown-as-source constraints.",
  "Do not assume JSON/block DB persistence.",
  "Separate framework-neutral guidance from host-specific integration."
] as const;

export function createPagePrompt(page: PromptPage, markdown: string = page.source): string {
  return [
    "You are helping integrate or evaluate Momentarise Markdown Editor from its public documentation.",
    "",
    "Instructions:",
    ...promptInstructionLines.map((line) => `- ${line}`),
    "",
    `Source: docs/public/${page.path}`,
    `Title: ${page.title}`,
    "",
    "Markdown source:",
    markdown
  ].join("\n");
}
