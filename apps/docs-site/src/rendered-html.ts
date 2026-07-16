import type { OutlineItem } from "@momentarise/md-editor";
import { hrefForPage, resolveMarkdownLink, type DocsPage } from "./docs-data";
import { flattenOutline } from "./outline-utils";

export function decorateRenderedMarkdownHtml(
  html: string,
  page: DocsPage,
  pages: readonly DocsPage[],
  outline: readonly OutlineItem[]
): string {
  const withAnchors = injectHeadingAnchors(html, page, outline);
  return rewriteRenderedLinks(removeDuplicatePageTitleHeading(withAnchors, page, outline), page, pages);
}

function removeDuplicatePageTitleHeading(html: string, page: DocsPage, outline: readonly OutlineItem[]): string {
  const firstHeading = flattenOutline(outline)[0];
  if (
    !firstHeading ||
    firstHeading.depth !== 1 ||
    normalizeHeadingText(firstHeading.text) !== normalizeHeadingText(page.title)
  ) {
    return html;
  }
  return html.replace(/^\s*<h1\b[^>]*>[\s\S]*?<\/h1>\s*/i, "");
}

function injectHeadingAnchors(html: string, page: DocsPage, outline: readonly OutlineItem[]): string {
  const headings = flattenOutline(outline);
  let index = 0;
  return html.replace(/<h([1-6])>([\s\S]*?)<\/h\1>/g, (match, depth, innerHtml) => {
    const item = headings[index];
    index += 1;
    if (!item) {
      return match;
    }
    const href = hrefForPage(page, item.slug);
    const anchor = `<a class="heading-anchor" href="${escapeHtmlAttribute(href)}" aria-label="Link to ${escapeHtmlAttribute(item.text)}">#</a>`;
    return `<h${depth} id="${escapeHtmlAttribute(item.slug)}">${innerHtml}${anchor}</h${depth}>`;
  });
}

function rewriteRenderedLinks(html: string, page: DocsPage, pages: readonly DocsPage[]): string {
  return html.replace(/<a\s+([^>]*?)href="([^"]+)"([^>]*)>/g, (match, before, href, after) => {
    const resolved = resolveMarkdownLink(page.path, decodeHtmlAttribute(href), pages);
    if (resolved) {
      return `<a ${before}href="${escapeHtmlAttribute(hrefForPage(resolved.page, resolved.sectionSlug))}" data-doc-link="${escapeHtmlAttribute(resolved.page.path)}"${after}>`;
    }
    if (isSafeExternalHref(href)) {
      const safeBefore = stripLinkSafetyAttributes(before);
      const safeAfter = stripLinkSafetyAttributes(after);
      return `<a ${safeBefore}href="${escapeHtmlAttribute(href)}" target="_blank" rel="noopener noreferrer"${safeAfter}>`;
    }
    return match;
  });
}

function isSafeExternalHref(href: string): boolean {
  if (href.startsWith("//")) {
    return true;
  }
  try {
    const parsed = new URL(href);
    return parsed.protocol === "http:" || parsed.protocol === "https:" || parsed.protocol === "mailto:";
  } catch {
    return false;
  }
}

function stripLinkSafetyAttributes(value: string): string {
  return value
    .replace(/\s+target="[^"]*"/gi, "")
    .replace(/\s+rel="[^"]*"/gi, "")
    .trimStart();
}

function decodeHtmlAttribute(value: string): string {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("\"", "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function normalizeHeadingText(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}
