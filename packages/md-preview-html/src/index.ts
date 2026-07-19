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

export type SvgPreviewWarningCode =
  | "svg-preview-invalid-root"
  | "svg-preview-sandboxed"
  | "svg-preview-sanitized"
  | "svg-preview-scripts-disabled";

export interface HtmlPreviewWarning {
  readonly code: HtmlPreviewWarningCode;
  readonly message: string;
  readonly severity: "info" | "warning";
}

export interface SvgPreviewWarning {
  readonly code: SvgPreviewWarningCode;
  readonly message: string;
  readonly severity: "info" | "warning";
}

export interface CreateSandboxedHtmlPreviewOptions {
  readonly fileName: string;
  readonly html: string;
  readonly sandboxTokens?: readonly HtmlPreviewSandboxToken[];
}

export interface CreateSandboxedSvgPreviewOptions {
  readonly fileName: string;
  readonly sandboxTokens?: readonly HtmlPreviewSandboxToken[];
  readonly svg: string;
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

export interface SandboxedSvgPreviewDescriptor {
  readonly fileName: string;
  readonly kind: "svg-artifact-preview";
  readonly sandbox: string;
  readonly sandboxTokens: readonly HtmlPreviewSandboxToken[];
  readonly sanitizedSvg: string;
  readonly scriptsEnabled: false;
  readonly srcdoc: string;
  readonly warnings: readonly SvgPreviewWarning[];
}

export const htmlPreviewPackage: HtmlPreviewContract = {
  dependsOnCore: true,
  packageName: "@momentarise/md-preview-html",
  previewKind: "html"
};

export function createSandboxedHtmlPreview(
  options: CreateSandboxedHtmlPreviewOptions
): SandboxedHtmlPreviewDescriptor {
  const sandboxTokens = normalizeSandboxTokens(options.sandboxTokens ?? []);
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

export function createSandboxedSvgPreview(
  options: CreateSandboxedSvgPreviewOptions
): SandboxedSvgPreviewDescriptor {
  const sandboxTokens = normalizeSandboxTokens(options.sandboxTokens ?? []);
  const sanitized = sanitizeSvgSource(options.svg);
  return {
    fileName: options.fileName,
    kind: "svg-artifact-preview",
    sandbox: sandboxTokens.join(" "),
    sandboxTokens,
    sanitizedSvg: sanitized.svg,
    scriptsEnabled: false,
    srcdoc: createSvgPreviewSrcdoc(sanitized.svg),
    warnings: svgPreviewWarnings(sanitized, sandboxTokens)
  };
}

export function isHtmlFileName(fileName: string): boolean {
  return /\.html?$/i.test(fileName);
}

export function isSvgFileName(fileName: string): boolean {
  return /\.svg$/i.test(fileName);
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

interface SanitizedSvgSource {
  readonly changed: boolean;
  readonly invalidRoot: boolean;
  readonly svg: string;
}

function sanitizeSvgSource(svg: string): SanitizedSvgSource {
  const original = svg.trim();
  if (!containsSvgRoot(original)) {
    return {
      changed: true,
      invalidRoot: true,
      svg: "<svg viewBox=\"0 0 1 1\" role=\"img\" aria-label=\"Invalid SVG source\"></svg>"
    };
  }

  const domParser = runtimeDomParser();
  if (!domParser) {
    return {
      changed: true,
      invalidRoot: false,
      svg: "<svg viewBox=\"0 0 1 1\" role=\"img\" aria-label=\"SVG preview unavailable without DOM sanitization\"></svg>"
    };
  }

  const svgDom = domParser.parseFromString(original, "image/svg+xml");
  const root = svgDom.documentElement;
  if (root.localName.toLowerCase() !== "svg" || root.querySelector("parsererror")) {
    return {
      changed: true,
      invalidRoot: true,
      svg: "<svg viewBox=\"0 0 1 1\" role=\"img\" aria-label=\"Invalid SVG source\"></svg>"
    };
  }

  sanitizeSvgElementTree(root);
  const sanitized = root.outerHTML.trim();

  return {
    changed: sanitized !== original,
    invalidRoot: false,
    svg: sanitized
  };
}

function containsSvgRoot(source: string): boolean {
  return /<svg(?:\s|>)/i.test(source);
}

function runtimeDomParser(): DOMParser | null {
  return typeof DOMParser === "undefined" ? null : new DOMParser();
}

const SAFE_SVG_ELEMENTS = new Set([
  "circle",
  "clipPath",
  "defs",
  "desc",
  "ellipse",
  "g",
  "line",
  "linearGradient",
  "mask",
  "path",
  "polygon",
  "polyline",
  "radialGradient",
  "rect",
  "stop",
  "svg",
  "text",
  "title",
  "tspan"
].map((elementName) => elementName.toLowerCase()));

const SAFE_SVG_ATTRIBUTES = new Set([
  "aria-hidden",
  "aria-label",
  "class",
  "clip-path",
  "cx",
  "cy",
  "d",
  "dominant-baseline",
  "fill",
  "fill-opacity",
  "font-family",
  "font-size",
  "font-weight",
  "gradienttransform",
  "gradientunits",
  "height",
  "id",
  "mask",
  "offset",
  "opacity",
  "points",
  "r",
  "role",
  "rx",
  "ry",
  "stop-color",
  "stop-opacity",
  "stroke",
  "stroke-dasharray",
  "stroke-dashoffset",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-miterlimit",
  "stroke-opacity",
  "stroke-width",
  "text-anchor",
  "transform",
  "viewbox",
  "width",
  "x",
  "x1",
  "x2",
  "xml:space",
  "xmlns",
  "y",
  "y1",
  "y2"
]);

function sanitizeSvgElementTree(root: Element): void {
  for (const element of Array.from(root.querySelectorAll("*"))) {
    if (!SAFE_SVG_ELEMENTS.has(element.localName.toLowerCase())) {
      element.remove();
    }
  }

  for (const element of [root, ...Array.from(root.querySelectorAll("*"))]) {
    sanitizeSvgAttributes(element);
  }
}

function sanitizeSvgAttributes(element: Element): void {
  for (const attribute of Array.from(element.attributes)) {
    const name = attribute.name.toLowerCase();
    if (
      name.startsWith("on") ||
      !SAFE_SVG_ATTRIBUTES.has(name) ||
      isUnsafeSvgAttributeValue(name, attribute.value)
    ) {
      element.removeAttribute(attribute.name);
    }
  }
}

function isUnsafeSvgAttributeValue(name: string, value: string): boolean {
  const normalized = value.replace(/[\u0000-\u001f\u007f\s]+/g, "").toLowerCase();
  if (
    normalized.includes("javascript:") ||
    normalized.includes("data:") ||
    normalized.includes("vbscript:") ||
    normalized.includes("file:") ||
    normalized.includes("http://") ||
    normalized.includes("https://") ||
    normalized.includes("//")
  ) {
    return true;
  }
  if (name === "href" || name === "xlink:href" || name === "src") {
    return !value.trim().startsWith("#");
  }
  if (/url\s*\(/i.test(value)) {
    return !/^url\(\s*#[A-Za-z][\w:.-]*\s*\)$/i.test(value.trim());
  }
  return false;
}

function createSvgPreviewSrcdoc(svg: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;height:100%;background:transparent;}body{display:grid;place-items:center;min-height:100%;overflow:auto;}svg{display:block;max-width:100%;max-height:100%;}</style></head><body>${svg}</body></html>`;
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
      message: "Scripts are disabled by default and the preview sandbox grants no tokens unless the host opts in.",
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

function svgPreviewWarnings(
  sanitized: SanitizedSvgSource,
  sandboxTokens: readonly HtmlPreviewSandboxToken[]
): readonly SvgPreviewWarning[] {
  const warnings: SvgPreviewWarning[] = [
    {
      code: "svg-preview-sandboxed",
      message: "SVG preview is rendered in a sandboxed iframe.",
      severity: "info"
    },
    {
      code: "svg-preview-scripts-disabled",
      message: "Scripts are disabled and active SVG content is stripped before preview rendering.",
      severity: "info"
    }
  ];

  if (sanitized.invalidRoot) {
    warnings.push({
      code: "svg-preview-invalid-root",
      message: "The source does not contain a valid SVG root, so the preview renders an inert placeholder.",
      severity: "warning"
    });
  } else if (sanitized.changed) {
    warnings.push({
      code: "svg-preview-sanitized",
      message: "Potentially active SVG content was removed from the preview artifact.",
      severity: "warning"
    });
  }

  if (sandboxTokens.includes("allow-same-origin")) {
    warnings.push({
      code: "svg-preview-sandboxed",
      message: "The sandbox grants allow-same-origin for preview compatibility but still blocks scripts.",
      severity: "info"
    });
  }

  return warnings;
}
