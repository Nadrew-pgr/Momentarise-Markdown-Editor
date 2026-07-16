import type { Metadata } from "next";
import { BrandMark } from "../src/BrandMark";
import { LiveMarkdownDemo } from "../src/LiveMarkdownDemo";
import { ThemeToggle } from "../src/ThemeToggle";

export const metadata: Metadata = {
  description: "Markdown-native framework for portable, AI-ready document editors.",
  title: "Momentarise Markdown Editor"
};

export default function LandingPage() {
  return (
    <main className="landing-page" data-testid="site-landing">
      <header className="landing-topbar">
        <a className="landing-brand" href="/">
          <BrandMark />
          <span>Momentarise</span>
        </a>
        <nav aria-label="Primary" className="landing-nav">
          <a href="/docs">Docs</a>
          <a href="/docs/quickstart/react">Quickstart</a>
          <a href="/docs/concepts/agentic-experience">AX</a>
          <ThemeToggle />
        </nav>
      </header>
      <section className="landing-hero">
        <div className="landing-copy">
          <p className="landing-kicker">Markdown-native editor framework</p>
          <h1>Build rich document editors without giving up real Markdown.</h1>
          <p>
            MME keeps `.md` files as the durable source while rich editing, HTML rendering,
            save truth, extensions, and AI assistance stay derived and policy-gated.
          </p>
          <div className="landing-actions">
            <a className="landing-primary" href="/docs">Read the docs</a>
            <a className="landing-secondary" href="/docs/quickstart/react">Start with React</a>
          </div>
        </div>
        <div className="landing-demo">
          <LiveMarkdownDemo />
        </div>
      </section>
      <section className="landing-story" aria-labelledby="landing-story-title">
        <div className="landing-story-copy">
          <p className="landing-kicker">Why it exists</p>
          <h2 id="landing-story-title">Most editors make the file disappear. MME keeps it in the room.</h2>
        </div>
        <div className="landing-story-body">
          <p>
            Teams want Notion-level editing, Obsidian-level ownership, and AI workflows that can be audited.
            That usually turns Markdown into an import/export format. Momentarise treats Markdown as the
            contract: every surface can help, but the source stays readable, portable, and recoverable.
          </p>
          <p>
            The framework gives product teams the primitives behind that promise: editor sessions, save
            targets, policy checks, rendered previews, extension registries, and host-controlled theming.
          </p>
        </div>
      </section>
      <section className="landing-workflow" aria-labelledby="landing-workflow-title">
        <div>
          <p className="landing-kicker">Editor model</p>
          <h2 id="landing-workflow-title">One Markdown file. Four working surfaces.</h2>
          <p>Source, rich editing, HTML preview, and AI actions all point back to the same durable document.</p>
        </div>
        <ol className="landing-flow">
          <li>
            <span>01</span>
            <strong>Source stays inspectable</strong>
            <p>Open the `.md` file anywhere and the document still makes sense.</p>
          </li>
          <li>
            <span>02</span>
            <strong>Rich editing is derived</strong>
            <p>Slash actions, toolbar choices, and previews update the source instead of replacing it.</p>
          </li>
          <li>
            <span>03</span>
            <strong>Persistence tells the truth</strong>
            <p>Disk, download, memory, conflict, and error states are explicit in the UI contract.</p>
          </li>
          <li>
            <span>04</span>
            <strong>AI is staged and policy-gated</strong>
            <p>Assistive changes can be reviewed before they touch the durable Markdown.</p>
          </li>
        </ol>
      </section>
      <section className="landing-principles" aria-label="Framework guarantees">
        <div>
          <h2>Markdown source</h2>
          <p>Files stay portable, inspectable, and editable outside the app.</p>
        </div>
        <div>
          <h2>Derived rich views</h2>
          <p>Source, rich, rendered, and AI surfaces never replace the durable document.</p>
        </div>
        <div>
          <h2>Truthful persistence</h2>
          <p>Save state names disk, memory, download, conflict, or error honestly.</p>
        </div>
      </section>
      <Footer />
    </main>
  );
}

function Footer() {
  return (
    <footer className="landing-footer">
      <div className="landing-footer-brand-block">
        <a className="landing-footer-brand" href="/">
          <BrandMark />
          <span>Momentarise Markdown Editor</span>
        </a>
        <p>Build editor products where Markdown remains portable, rich views are derived, and persistence tells the truth.</p>
      </div>
      <nav aria-label="Footer">
        <section>
          <h2>Start</h2>
          <a href="/docs">Docs</a>
          <a href="/docs/quickstart/react">React quickstart</a>
        </section>
        <section>
          <h2>Concepts</h2>
          <a href="/docs/concepts/document-model">Document model</a>
          <a href="/docs/concepts/import-export">Import and export</a>
        </section>
        <section>
          <h2>Agents</h2>
          <a href="/docs/concepts/agentic-experience">Agentic Experience</a>
          <a href="/docs/packages/md-cli">CLI</a>
        </section>
        <section>
          <h2>Reference</h2>
          <a href="/docs/packages/md-core">Core contracts</a>
          <a href="/docs/roadmap">Roadmap</a>
        </section>
      </nav>
    </footer>
  );
}
