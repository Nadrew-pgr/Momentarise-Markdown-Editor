import { readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { extname, join, normalize, relative, resolve, sep } from "node:path";
import { createMarkdownEditorSession, type OutlineItem } from "@momentarise/md-editor";
import { createMemorySaveTarget } from "@momentarise/md-save";
import {
  comparePublicDocsPages,
  parsePublicDocsFrontmatter,
  sectionFromPath,
  titleFromPath,
  type PublicDocsMetadata
} from "./docs-shared.mjs";
import { flattenOutline, sectionMarkdownForSlug } from "./outline-utils";

export type DocsMetadata = PublicDocsMetadata;

export interface DocsPage {
  readonly body: string;
  readonly description: string;
  readonly metadata: DocsMetadata;
  readonly path: string;
  readonly rawUrl: string;
  readonly route: string;
  readonly routeSegments: readonly string[];
  readonly source: string;
  readonly title: string;
}

export interface DocsNavGroup {
  readonly label: string;
  readonly pages: readonly DocsPage[];
}

export interface ResolvedMarkdownLink {
  readonly page: DocsPage;
  readonly sectionSlug?: string;
}

const docsRoot = resolve(process.cwd(), "../../docs/public");
const realDocsRoot = realpathSync(docsRoot);

export function allDocsPages(): readonly DocsPage[] {
  return collectMarkdownFiles(docsRoot).map(createDocsPage).sort(comparePublicDocsPages);
}

export function buildDocsNavigation(pages: readonly DocsPage[] = allDocsPages()): readonly DocsNavGroup[] {
  const groups = new Map<string, DocsPage[]>();
  for (const page of pages) {
    const section = page.metadata.navSection ?? sectionFromPath(page.path);
    const sectionPages = groups.get(section) ?? [];
    sectionPages.push(page);
    groups.set(section, sectionPages);
  }
  return [...groups.entries()].map(([label, sectionPages]) => ({
    label,
    pages: sectionPages
  }));
}

export function createOutlineForPage(page: DocsPage): readonly OutlineItem[] {
  const session = createMarkdownEditorSession({
    content: page.source,
    path: `docs/public/${page.path}`,
    scheduler: {
      schedule() {
        return () => {};
      }
    },
    target: createMemorySaveTarget({
      initialContent: page.source
    })
  });
  try {
    return session.getOutline();
  } finally {
    session.destroy();
  }
}

export { flattenOutline, sectionMarkdownForSlug };

export function getDefaultPage(pages: readonly DocsPage[] = allDocsPages()): DocsPage {
  return pages.find((page) => page.path === "index.md") ?? pages[0]!;
}

export function getPageByRouteSegments(
  routeSegments: readonly string[] | undefined,
  pages: readonly DocsPage[] = allDocsPages()
): DocsPage | undefined {
  const normalized = routeSegments?.join("/") ?? "";
  return pages.find((page) => page.route === normalized);
}

export function hrefForPage(page: DocsPage, sectionSlug?: string): string {
  const base = page.route ? `/docs/${page.route}` : "/docs";
  return sectionSlug ? `${base}#${encodeURIComponent(sectionSlug)}` : base;
}

export function resolveMarkdownLink(
  currentPath: string,
  href: string,
  pages: readonly DocsPage[] = allDocsPages()
): ResolvedMarkdownLink | null {
  if (isExternalOrSpecialLink(href)) {
    return null;
  }
  const [targetPath = "", rawSection] = href.split("#");
  const sectionSlug = rawSection ? safeDecodeComponent(rawSection) : undefined;
  if (!targetPath) {
    const currentPage = pages.find((page) => page.path === currentPath);
    return currentPage ? { page: currentPage, ...(sectionSlug ? { sectionSlug } : {}) } : null;
  }
  const absoluteDocsPage = resolveAbsoluteDocsTarget(targetPath, pages);
  if (absoluteDocsPage) {
    return { page: absoluteDocsPage, ...(sectionSlug ? { sectionSlug } : {}) };
  }
  if (!targetPath.endsWith(".md")) {
    return null;
  }
  const resolvedPath = resolveRelativeMarkdownPath(currentPath, targetPath);
  const page = pages.find((candidate) => candidate.path === resolvedPath);
  return page ? { page, ...(sectionSlug ? { sectionSlug } : {}) } : null;
}

function resolveAbsoluteDocsTarget(targetPath: string, pages: readonly DocsPage[]): DocsPage | undefined {
  const normalizedTarget = targetPath.replace(/\/+$/, "");
  if (normalizedTarget === "/docs") {
    return getDefaultPage(pages);
  }
  if (!normalizedTarget.startsWith("/docs/")) {
    return undefined;
  }
  const docsTarget = normalizedTarget.slice("/docs/".length);
  if (!docsTarget) {
    return getDefaultPage(pages);
  }
  if (docsTarget.endsWith(".md")) {
    return pages.find((page) => page.path === docsTarget);
  }
  return pages.find((page) => page.route === docsTarget);
}

function createDocsPage(fullPath: string): DocsPage {
  const relPath = relative(docsRoot, fullPath).replaceAll("\\", "/");
  const source = readFileSync(fullPath, "utf8");
  const parsed = parsePublicDocsFrontmatter(source);
  const h1 = parsed.body.match(/^#\s+(.+)$/m)?.[1]?.trim();
  const title = parsed.metadata.title ?? h1 ?? titleFromPath(relPath);
  const route = routeFromPath(relPath);
  return {
    body: parsed.body,
    description: parsed.metadata.description ?? "",
    metadata: parsed.metadata,
    path: relPath,
    rawUrl: `/docs/${relPath}`,
    route,
    routeSegments: route ? route.split("/") : [],
    source,
    title
  };
}

function collectMarkdownFiles(root: string): readonly string[] {
  const files: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const fullPath = join(root, entry.name);
    const realFullPath = realpathSync(fullPath);
    if (!isInsideDocsRoot(realFullPath)) {
      continue;
    }
    if (entry.isDirectory()) {
      files.push(...collectMarkdownFiles(fullPath));
    } else if (entry.isFile() && extname(entry.name).toLowerCase() === ".md" && statSync(realFullPath).isFile()) {
      files.push(fullPath);
    }
  }
  return files.sort();
}

function isExternalOrSpecialLink(href: string): boolean {
  return href.startsWith("#") || /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("//");
}

function isInsideDocsRoot(path: string): boolean {
  const normalizedRoot = normalize(realDocsRoot);
  const normalizedPath = normalize(path);
  return normalizedPath === normalizedRoot || normalizedPath.startsWith(`${normalizedRoot}${sep}`);
}

function resolveRelativeMarkdownPath(currentPath: string, targetPath: string): string {
  const parts = currentPath.split("/").slice(0, -1);
  for (const segment of targetPath.split("/")) {
    if (!segment || segment === ".") {
      continue;
    }
    if (segment === "..") {
      parts.pop();
      continue;
    }
    parts.push(segment);
  }
  return parts.join("/");
}

function routeFromPath(path: string): string {
  const withoutExtension = path.replace(/\.md$/, "");
  return withoutExtension === "index" ? "" : withoutExtension;
}

function safeDecodeComponent(value: string): string | undefined {
  try {
    return decodeURIComponent(value);
  } catch {
    return undefined;
  }
}
