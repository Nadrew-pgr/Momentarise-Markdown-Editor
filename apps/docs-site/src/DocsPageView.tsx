import { renderMarkdownToHtml } from "@momentarise/md-render-html";
import {
  allDocsPages,
  buildDocsNavigation,
  createOutlineForPage,
  getDefaultPage,
  hrefForPage,
  type DocsPage
} from "./docs-data";
import { decorateRenderedMarkdownHtml } from "./rendered-html";
import { DocActions } from "./DocActions";
import { DocsSearch } from "./DocsSearch";
import { LiveMarkdownDemo } from "./LiveMarkdownDemo";
import { ThemeToggle } from "./ThemeToggle";
import { BrandMark } from "./BrandMark";
import { getDocsAgentActionRegistry, type AgentActionRegistry } from "./agent-actions";

export function DocsPageView({ page }: { readonly page: DocsPage }) {
  const pages = allDocsPages();
  const outline = createOutlineForPage(page);
  const actionRegistry = getDocsAgentActionRegistry();
  const rendered = renderMarkdownToHtml(page.body, { fileName: page.path });
  const decoratedHtml = decorateRenderedMarkdownHtml(rendered.html, page, pages, outline);

  return (
    <div className="docs-app">
      <a className="skip-link" href="#docs-content">Skip to content</a>
      <Topbar currentPage={page} pages={pages} />
      <div className="docs-shell">
        <Sidebar currentPage={page} pages={pages} />
        <main className="docs-main" id="docs-content" tabIndex={-1}>
          <details className="docs-mobile-nav">
            <summary>Documentation</summary>
            <NavigationList currentPage={page} pages={pages} />
          </details>
          <header className="docs-page-header">
            <nav aria-label="Breadcrumb" className="docs-breadcrumbs">
              <a href={hrefForPage(getDefaultPage(pages))}>Docs</a>
              <span aria-hidden="true">/</span>
              <span>{page.metadata.navSection ?? "Guide"}</span>
              <span aria-hidden="true">/</span>
              <span>{page.title}</span>
            </nav>
            <h1 className="docs-title">{page.title}</h1>
            {page.description ? <p className="docs-description">{page.description}</p> : null}
          </header>
          <article
            className="mme-rendered-doc"
            data-testid="docs-content-rendered"
            dangerouslySetInnerHTML={{ __html: decoratedHtml }}
          />
          {page.path === "index.md" ? <HomeExtras pages={pages} /> : null}
          <DocsPager currentPage={page} pages={pages} />
          <DocsFooter pages={pages} />
        </main>
        <Outline actionRegistry={actionRegistry} page={page} outline={outline} />
      </div>
    </div>
  );
}

function Topbar({ currentPage, pages }: { readonly currentPage: DocsPage; readonly pages: readonly DocsPage[] }) {
  const docsHome = getDefaultPage(pages);
  const quickstart = pages.find((page) => page.route === "quickstart/next");
  const ax = pages.find((page) => page.route === "concepts/agentic-experience");
  const reference = pages.find((page) => page.route === "packages/md-core");
  const searchPages = pages.map((page) => ({
    description: page.description,
    href: hrefForPage(page),
    path: page.path,
    ...(page.metadata.navSection ? { section: page.metadata.navSection } : {}),
    title: page.title
  }));
  return (
    <header className="docs-topbar">
      <a className="docs-topbar-brand" href="/">
        <BrandMark />
        <span>Momentarise</span>
      </a>
      <nav aria-label="Primary documentation" className="docs-topbar-nav">
        <a aria-current={currentPage.path === docsHome.path ? "page" : undefined} href={hrefForPage(docsHome)}>Docs</a>
        {quickstart ? <a href={hrefForPage(quickstart)}>Quickstart</a> : null}
        {ax ? <a href={hrefForPage(ax)}>AX</a> : null}
        {reference ? <a href={hrefForPage(reference)}>Reference</a> : null}
      </nav>
      <div className="docs-topbar-controls">
        <DocsSearch pages={searchPages} />
        <a className="docs-topbar-action" href="#docs-actions" aria-label="Open page actions for AI prompts">Ask AI</a>
        <ThemeToggle />
      </div>
    </header>
  );
}

function Sidebar({ currentPage, pages }: { readonly currentPage: DocsPage; readonly pages: readonly DocsPage[] }) {
  return (
    <aside className="docs-sidebar">
      <a className="docs-brand" href={hrefForPage(getDefaultPage(pages))}>
        <BrandMark />
        <span>Momentarise Markdown Editor</span>
      </a>
      <NavigationList currentPage={currentPage} pages={pages} />
    </aside>
  );
}

function NavigationList({ currentPage, pages }: { readonly currentPage: DocsPage; readonly pages: readonly DocsPage[] }) {
  return (
      <nav aria-label="Documentation" className="docs-nav">
        {buildDocsNavigation(pages).map((group) => (
          <section className="docs-nav-group" key={group.label}>
            <h2>{group.label}</h2>
            <ul>
              {group.pages.map((page) => (
                <li key={page.path}>
                  <a aria-current={page.path === currentPage.path ? "page" : undefined} href={hrefForPage(page)}>
                    {page.title}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </nav>
  );
}

function Outline({
  actionRegistry,
  page,
  outline
}: {
  readonly actionRegistry: AgentActionRegistry;
  readonly page: DocsPage;
  readonly outline: ReturnType<typeof createOutlineForPage>;
}) {
  return (
    <aside className="docs-outline-panel">
      <DocActions
        actionRegistry={actionRegistry}
        outline={outline}
        page={{
          path: page.path,
          rawUrl: page.rawUrl,
          source: page.source,
          title: page.title
        }}
      />
      <p className="docs-render-proof">Rendered by Momentarise Markdown Editor from plain Markdown.</p>
      <nav aria-label="On this page" className="docs-outline" data-testid="docs-outline">
        <h2>On This Page</h2>
        <ol>
          {outline.map((item) => (
            <OutlineItem item={item} key={item.slug} page={page} />
          ))}
        </ol>
      </nav>
    </aside>
  );
}

function OutlineItem({
  item,
  page
}: {
  readonly item: ReturnType<typeof createOutlineForPage>[number];
  readonly page: DocsPage;
}) {
  return (
    <li>
      <a data-depth={item.depth} href={hrefForPage(page, item.slug)}>{item.text}</a>
      {item.children.length > 0 ? (
        <ol>
          {item.children.map((child) => (
            <OutlineItem item={child} key={child.slug} page={page} />
          ))}
        </ol>
      ) : null}
    </li>
  );
}

function HomeExtras({ pages }: { readonly pages: readonly DocsPage[] }) {
  const quickstarts = pages.filter((page) => page.path.startsWith("quickstart/"));
  const featureRoutes = new Set([
    "concepts/editor-ui",
    "concepts/ai-privacy",
    "concepts/extensions",
    "concepts/import-export",
    "concepts/preferences",
    "concepts/theming",
    "concepts/policy",
    "concepts/save-truthfulness"
  ]);
  const agentRoutes = new Set([
    "concepts/agentic-experience",
    "concepts/ai-privacy",
    "packages/md-cli"
  ]);
  const features = pages.filter((page) => featureRoutes.has(page.route));
  const agentDocs = pages.filter((page) => agentRoutes.has(page.route));
  const foundations = pages
    .filter((page) => page.path.startsWith("concepts/") && !featureRoutes.has(page.route) && !agentRoutes.has(page.route))
    .slice(0, 4);
  return (
    <section className="home-extras">
      <section aria-labelledby="examples-gallery-title" className="examples-gallery">
        <h2 id="examples-gallery-title">Start Building</h2>
        <div className="examples-list">
          {quickstarts.map((page) => (
            <a className="example-link" href={hrefForPage(page)} key={page.path}>
              <strong>{page.title}</strong>
              <span>{page.description}</span>
            </a>
          ))}
        </div>
      </section>
      <section aria-labelledby="agentic-gallery-title" className="examples-gallery examples-gallery-highlight">
        <h2 id="agentic-gallery-title">Agentic Experience</h2>
        <div className="examples-list examples-list-three">
          {agentDocs.map((page) => (
            <a className="example-link" href={hrefForPage(page)} key={page.path}>
              <strong>{page.title}</strong>
              <span>{page.description}</span>
            </a>
          ))}
        </div>
      </section>
      <section aria-labelledby="concepts-gallery-title" className="examples-gallery">
        <h2 id="concepts-gallery-title">Editor Features</h2>
        <div className="examples-list">
          {features.map((page) => (
            <a className="example-link" href={hrefForPage(page)} key={page.path}>
              <strong>{page.title}</strong>
              <span>{page.description}</span>
            </a>
          ))}
        </div>
      </section>
      <section aria-labelledby="foundations-gallery-title" className="examples-gallery examples-gallery-compact">
        <h2 id="foundations-gallery-title">Foundations</h2>
        <div className="examples-list">
          {foundations.map((page) => (
            <a className="example-link" href={hrefForPage(page)} key={page.path}>
              <strong>{page.title}</strong>
              <span>{page.description}</span>
            </a>
          ))}
        </div>
      </section>
      <LiveMarkdownDemo />
    </section>
  );
}

function DocsPager({ currentPage, pages }: { readonly currentPage: DocsPage; readonly pages: readonly DocsPage[] }) {
  const currentIndex = pages.findIndex((page) => page.path === currentPage.path);
  const previous = currentIndex > 0 ? pages[currentIndex - 1] : undefined;
  const next = currentIndex >= 0 && currentIndex < pages.length - 1 ? pages[currentIndex + 1] : undefined;
  if (!previous && !next) {
    return null;
  }
  return (
    <nav aria-label="Previous and next docs" className="docs-pager" data-testid="docs-pager">
      {previous ? (
        <a className="docs-pager-link docs-pager-prev" href={hrefForPage(previous)}>
          <span>Previous</span>
          <strong>{previous.title}</strong>
        </a>
      ) : <span />}
      {next ? (
        <a className="docs-pager-link docs-pager-next" href={hrefForPage(next)}>
          <span>Next</span>
          <strong>{next.title}</strong>
        </a>
      ) : <span />}
    </nav>
  );
}

function DocsFooter({ pages }: { readonly pages: readonly DocsPage[] }) {
  const docsHome = getDefaultPage(pages);
  const quickstart = pages.find((page) => page.route === "quickstart/react");
  const concepts = pages.find((page) => page.route === "concepts/document-model");
  const ai = pages.find((page) => page.route === "concepts/ai-privacy");
  const ax = pages.find((page) => page.route === "concepts/agentic-experience");
  const cli = pages.find((page) => page.route === "packages/md-cli");
  const roadmap = pages.find((page) => page.route === "roadmap");
  return (
    <footer className="docs-footer">
      <div className="docs-footer-brand">
        <a href="/">
          <BrandMark />
          <span>Momentarise Markdown Editor</span>
        </a>
        <p>Portable Markdown, derived rich views, truthful save state, and agent-ready editing surfaces.</p>
      </div>
      <nav aria-label="Footer" className="docs-footer-links">
        <div>
          <h2>Start</h2>
          <a href={hrefForPage(docsHome)}>Docs</a>
          {quickstart ? <a href={hrefForPage(quickstart)}>Quickstart</a> : null}
        </div>
        <div>
          <h2>Framework</h2>
          {concepts ? <a href={hrefForPage(concepts)}>Document model</a> : null}
          {ai ? <a href={hrefForPage(ai)}>AI and privacy</a> : null}
        </div>
        <div>
          <h2>Agents</h2>
          {ax ? <a href={hrefForPage(ax)}>Agentic Experience</a> : null}
          {cli ? <a href={hrefForPage(cli)}>CLI</a> : null}
        </div>
        <div>
          <h2>Reference</h2>
          {roadmap ? <a href={hrefForPage(roadmap)}>Roadmap</a> : null}
          <a href="/docs/packages/md-core">Core contracts</a>
        </div>
      </nav>
    </footer>
  );
}
