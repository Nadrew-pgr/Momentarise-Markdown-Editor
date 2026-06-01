export interface HtmlPreviewContract {
  readonly packageName: "@momentarise/md-preview-html";
  readonly dependsOnCore: true;
  readonly previewKind: "html";
}

export type HtmlPreviewSandboxToken =
  | "allow-downloads"
  | "allow-forms"
  | "allow-modals"
  | "allow-popups"
  | "allow-popups-to-escape-sandbox"
  | "allow-presentation"
  | "allow-same-origin"
  | "allow-scripts"
  | "allow-top-navigation-by-user-activation";

export type HtmlPreviewWarningCode =
  | "html-preview-sandboxed"
  | "html-preview-scripts-disabled"
  | "html-preview-inline-script-present";

export interface HtmlPreviewWarning {
  readonly code: HtmlPreviewWarningCode;
  readonly message: string;
  readonly severity: "info" | "warning";
}

export interface CreateSandboxedHtmlPreviewOptions {
  readonly fileName: string;
  readonly html: string;
  readonly sandboxTokens?: readonly HtmlPreviewSandboxToken[];
}

export interface SandboxedHtmlPreviewDescriptor {
  readonly fileName: string;
  readonly kind: "html-artifact-preview";
  readonly sandbox: string;
  readonly sandboxTokens: readonly HtmlPreviewSandboxToken[];
  readonly scriptsEnabled: false;
  readonly srcdoc: string;
  readonly warnings: readonly HtmlPreviewWarning[];
}

export const htmlPreviewPackage: HtmlPreviewContract = {
  dependsOnCore: true,
  packageName: "@momentarise/md-preview-html",
  previewKind: "html"
};

export function createSandboxedHtmlPreview(
  options: CreateSandboxedHtmlPreviewOptions
): SandboxedHtmlPreviewDescriptor {
  const sandboxTokens = normalizeSandboxTokens(options.sandboxTokens ?? ["allow-same-origin"]);
  return {
    fileName: options.fileName,
    kind: "html-artifact-preview",
    sandbox: sandboxTokens.join(" "),
    sandboxTokens,
    scriptsEnabled: false,
    srcdoc: options.html,
    warnings: htmlPreviewWarnings(options.html, sandboxTokens)
  };
}

export function isHtmlFileName(fileName: string): boolean {
  return /\.html?$/i.test(fileName);
}

export function sandboxAllowsScripts(sandbox: string): boolean {
  return sandbox
    .split(/\s+/)
    .filter(Boolean)
    .includes("allow-scripts");
}

function normalizeSandboxTokens(tokens: readonly HtmlPreviewSandboxToken[]): readonly HtmlPreviewSandboxToken[] {
  const unique = new Set<HtmlPreviewSandboxToken>();
  for (const token of tokens) {
    if (token === "allow-scripts") {
      continue;
    }
    unique.add(token);
  }
  return [...unique].sort();
}

function htmlPreviewWarnings(
  html: string,
  sandboxTokens: readonly HtmlPreviewSandboxToken[]
): readonly HtmlPreviewWarning[] {
  const warnings: HtmlPreviewWarning[] = [
    {
      code: "html-preview-sandboxed",
      message: "HTML preview is rendered in a sandboxed iframe.",
      severity: "info"
    },
    {
      code: "html-preview-scripts-disabled",
      message: "Scripts are disabled by default and the preview sandbox does not grant allow-scripts.",
      severity: "info"
    }
  ];

  if (/<script\b/i.test(html)) {
    warnings.push({
      code: "html-preview-inline-script-present",
      message: "The source contains script tags, but the default sandbox prevents script execution.",
      severity: "warning"
    });
  }

  if (sandboxTokens.includes("allow-same-origin")) {
    warnings.push({
      code: "html-preview-sandboxed",
      message: "The sandbox grants allow-same-origin for preview compatibility but still blocks scripts.",
      severity: "info"
    });
  }

  return warnings;
}
