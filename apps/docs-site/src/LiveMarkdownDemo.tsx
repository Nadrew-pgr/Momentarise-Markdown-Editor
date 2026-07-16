"use client";

import { useEffect, useRef } from "react";

const initialDemoMarkdown = [
  "# Rich Markdown Surface",
  "",
  "Markdown remains the **source**, but it can render polished product UI when policy allows raw HTML and `mme-*` blocks.",
  "",
  "<div class=\"mme-html-panel\">",
  "  <div class=\"mme-html-eyebrow\">Styled HTML Block</div>",
  "  <h2>Agent-ready release note</h2>",
  "  <p>Raw HTML can carry a polished component while the original Markdown stays inspectable.</p>",
  "  <div class=\"mme-html-meter\"><span></span></div>",
  "  <ul class=\"mme-html-list\">",
  "    <li><strong>Source</strong><span>plain .md file</span></li>",
  "    <li><strong>Render</strong><span>sanitized HTML view</span></li>",
  "    <li><strong>Save</strong><span>truthful target state</span></li>",
  "  </ul>",
  "</div>",
  "",
  "<div class=\"mme-slash-editor\">",
  "  <p class=\"mme-slash-line\"><span>/</span><strong>slash editor</strong><em>Type /ai, /callout, or /table from the editor surface.</em></p>",
  "  <div class=\"mme-slash-menu-preview\">",
  "    <div class=\"mme-slash-option mme-slash-option-active\"><span>AI</span><strong>Draft next paragraph</strong><em>staged suggestion</em></div>",
  "    <div class=\"mme-slash-option\"><span>H2</span><strong>Heading</strong><em>structure the document</em></div>",
  "    <div class=\"mme-slash-option\"><span>MD</span><strong>Callout</strong><em>preserved Markdown block</em></div>",
  "  </div>",
  "</div>",
  "",
  "- Edit the source pane for exact Markdown.",
  "- Edit the rendered pane to push styled HTML back into source."
].join("\n");

export function LiveMarkdownDemo() {
  const sourceRef = useRef<HTMLDivElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const sourceViewRef = useRef<{ destroy(): void; replaceContent(content: string): void } | null>(null);
  const currentMarkdownRef = useRef(initialDemoMarkdown);

  useEffect(() => {
    let destroyed = false;

    async function mount() {
      const [{ createMomentariseSourceView }, { renderMarkdownToHtml }] = await Promise.all([
        import("@momentarise/md-source-codemirror"),
        import("@momentarise/md-render-html")
      ]);
      if (destroyed || !sourceRef.current || !previewRef.current) {
        return;
      }
      const renderPreview = (markdown: string) => {
        if (previewRef.current) {
          previewRef.current.innerHTML = renderMarkdownToHtml(markdown, { fileName: "live-demo.md" }).html;
        }
      };
      renderPreview(initialDemoMarkdown);
      const view = createMomentariseSourceView({
        doc: initialDemoMarkdown,
        onChange(markdown) {
          currentMarkdownRef.current = markdown;
          renderPreview(markdown);
        },
        parent: sourceRef.current,
        preferences: {
          density: "comfortable",
          lineWrapping: false,
          readableLineWidth: 820
        }
      });
      sourceViewRef.current = view;
    }

    void mount();
    return () => {
      destroyed = true;
      sourceViewRef.current?.destroy();
      sourceViewRef.current = null;
    };
  }, []);

  function updateSourceFromRenderedHtml() {
    if (!previewRef.current || !sourceViewRef.current) {
      return;
    }
    const markdown = serializeRenderedPreviewToMarkdown(previewRef.current);
    const nextMarkdown = [
      "<!-- Edited from the rendered preview. MME custom HTML blocks remain HTML; native Markdown stays Markdown. -->",
      "",
      markdown
    ].join("\n");
    currentMarkdownRef.current = nextMarkdown;
    sourceViewRef.current.replaceContent(nextMarkdown);
  }

  return (
    <section aria-labelledby="docs-live-demo-title" className="docs-live-demo" data-testid="docs-live-demo">
      <h2 id="docs-live-demo-title">Live Editor Surface</h2>
      <div
        aria-label="Markdown editor demo with source and rendered preview"
        className="live-editor-frame"
        data-testid="live-editor-frame"
        role="group"
      >
        <div className="live-editor-toolbar">
          <span className="live-editor-file">release-note.md</span>
          <span className="live-editor-status">clean source</span>
          <span className="live-editor-tab">Source</span>
          <span className="live-editor-tab live-editor-tab-active">Render</span>
          <span className="live-editor-command">/</span>
        </div>
        <div className="live-demo-grid">
          <div className="live-demo-source">
            <h3>Source</h3>
            <div className="source-mount" ref={sourceRef} />
          </div>
          <div className="live-demo-preview">
            <h3>Rendered Preview</h3>
            <div
              aria-label="Editable rendered preview"
              className="live-preview-output"
              contentEditable
              data-testid="editable-render-preview"
              onBlur={updateSourceFromRenderedHtml}
              onInput={updateSourceFromRenderedHtml}
              ref={previewRef}
              suppressContentEditableWarning
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function serializeRenderedPreviewToMarkdown(root: HTMLElement): string {
  return Array.from(root.childNodes)
    .map((node) => nodeToMarkdown(node))
    .map((value) => value.trim())
    .filter(Boolean)
    .join("\n\n");
}

function nodeToMarkdown(node: ChildNode): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return normalizeText(node.textContent ?? "");
  }
  if (!(node instanceof HTMLElement)) {
    return "";
  }
  const tagName = node.tagName.toLowerCase();
  if (isMmeCustomHtmlBlock(node)) {
    return node.outerHTML.trim();
  }
  if (/^h[1-6]$/.test(tagName)) {
    const level = Number(tagName.slice(1));
    return `${"#".repeat(level)} ${inlineChildrenToMarkdown(node).trim()}`;
  }
  if (tagName === "p") {
    return inlineChildrenToMarkdown(node).trim();
  }
  if (tagName === "ul") {
    return Array.from(node.children)
      .filter((child): child is HTMLLIElement => child.tagName.toLowerCase() === "li")
      .map((child) => `- ${inlineChildrenToMarkdown(child).trim()}`)
      .join("\n");
  }
  if (tagName === "ol") {
    return Array.from(node.children)
      .filter((child): child is HTMLLIElement => child.tagName.toLowerCase() === "li")
      .map((child, index) => `${index + 1}. ${inlineChildrenToMarkdown(child).trim()}`)
      .join("\n");
  }
  if (tagName === "blockquote") {
    return inlineChildrenToMarkdown(node)
      .split("\n")
      .map((line) => `> ${line}`)
      .join("\n");
  }
  if (tagName === "pre") {
    return `\`\`\`\n${(node.textContent ?? "").replace(/\n$/, "")}\n\`\`\``;
  }
  if (tagName === "br") {
    return "\n";
  }
  const childMarkdown = Array.from(node.childNodes)
    .map((child) => nodeToMarkdown(child))
    .map((value) => value.trim())
    .filter(Boolean)
    .join("\n\n");
  return childMarkdown || inlineChildrenToMarkdown(node).trim();
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function isMmeCustomHtmlBlock(node: HTMLElement): boolean {
  return Array.from(node.classList).some((className) => className.startsWith("mme-"));
}

function inlineChildrenToMarkdown(element: HTMLElement): string {
  return Array.from(element.childNodes).map((node) => inlineNodeToMarkdown(node)).join("").replace(/[ \t]+/g, " ");
}

function inlineNodeToMarkdown(node: ChildNode): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? "";
  }
  if (!(node instanceof HTMLElement)) {
    return "";
  }
  const tagName = node.tagName.toLowerCase();
  if (tagName === "strong" || tagName === "b") {
    return `**${inlineChildrenToMarkdown(node).trim()}**`;
  }
  if (tagName === "em" || tagName === "i") {
    return `_${inlineChildrenToMarkdown(node).trim()}_`;
  }
  if (tagName === "del" || tagName === "s") {
    return `~~${inlineChildrenToMarkdown(node).trim()}~~`;
  }
  if (tagName === "code") {
    return `\`${(node.textContent ?? "").replaceAll("`", "\\`")}\``;
  }
  if (tagName === "a") {
    const label = inlineChildrenToMarkdown(node).trim();
    const href = node.getAttribute("href");
    return href && isSafeMarkdownHref(href) ? `[${label}](${href})` : label;
  }
  if (tagName === "br") {
    return "\n";
  }
  if (tagName === "img") {
    const alt = node.getAttribute("alt") ?? "";
    const src = node.getAttribute("src");
    return src && isSafeMarkdownHref(src) ? `![${alt}](${src})` : alt;
  }
  if (tagName === "mark" || tagName === "sub" || tagName === "sup" || tagName === "u") {
    return `<${tagName}>${inlineChildrenToMarkdown(node).trim()}</${tagName}>`;
  }
  return inlineChildrenToMarkdown(node);
}

function isSafeMarkdownHref(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("/") || trimmed.startsWith("./") || trimmed.startsWith("../")) {
    return true;
  }
  try {
    const url = new URL(trimmed);
    return ["http:", "https:", "mailto:"].includes(url.protocol);
  } catch {
    return false;
  }
}
