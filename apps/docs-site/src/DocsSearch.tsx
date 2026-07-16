"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export interface DocsSearchPage {
  readonly description: string;
  readonly href: string;
  readonly path: string;
  readonly section?: string;
  readonly title: string;
}

export function DocsSearch({ pages }: { readonly pages: readonly DocsSearchPage[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const results = useMemo(() => searchPages(pages, query), [pages, query]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="docs-search">
      <button className="docs-search-trigger" data-testid="docs-search-trigger" type="button" onClick={() => setOpen(true)}>
        <span>Search...</span>
        <kbd>⌘K</kbd>
      </button>
      {open ? (
        <div aria-modal="true" className="docs-search-overlay" data-testid="docs-search-overlay" role="dialog">
          <button aria-label="Close search" className="docs-search-backdrop" type="button" onClick={() => setOpen(false)} />
          <div className="docs-search-panel">
            <input
              ref={inputRef}
              aria-label="Search documentation"
              placeholder="Search docs..."
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <div className="docs-search-results">
              {results.map((page) => (
                <a href={page.href} key={page.path} onClick={() => setOpen(false)}>
                  <strong>{page.title}</strong>
                  <span>{page.section ?? sectionFromPath(page.path)}</span>
                  {page.description ? <p>{page.description}</p> : null}
                </a>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function searchPages(pages: readonly DocsSearchPage[], query: string): readonly DocsSearchPage[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return pages.slice(0, 8);
  }
  return pages
    .filter((page) => `${page.title} ${page.description} ${page.path} ${page.section ?? ""}`.toLowerCase().includes(normalized))
    .slice(0, 8);
}

function sectionFromPath(path: string): string {
  const [section = "Docs"] = path.split("/");
  return section.replace(/[-_]/g, " ");
}
