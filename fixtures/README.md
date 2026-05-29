# Fixture Corpus

This corpus provides repeatable Markdown files for parser, serializer, policy, source-mode, manual QA, and future rich-mode tests.

Each fixture directory contains:

- `input.md`: the real Markdown document used by tests and manual checks.
- `expectations.md`: preservation, normalization, opaque/source-only, render, and policy notes.

Fixtures are intentionally synthetic and sanitized. They must not contain private user data, working credentials, valid API keys, real identity documents, or real financial details.

## Fixtures

1. `001-simple-markdown`: basic headings, paragraphs, emphasis, and links.
2. `002-yaml-frontmatter`: YAML frontmatter and body content.
3. `003-gfm-task-list`: GitHub Flavored Markdown task list.
4. `004-gfm-table`: GFM table alignment and inline formatting.
5. `005-code-fence-language`: fenced code block with language info.
6. `006-blockquote`: nested blockquotes and attribution.
7. `007-obsidian-callout`: Obsidian-style callout syntax.
8. `008-wikilink`: Obsidian-style wikilinks and aliases.
9. `009-link-image`: Markdown links and images.
10. `010-html-inline-block`: inline and block HTML in Markdown.
11. `011-mermaid-fence`: Mermaid diagram fenced block.
12. `012-latex-inline-block`: inline and display LaTeX.
13. `013-unknown-custom-syntax`: unknown directives and templating.
14. `014-mixed-real-world`: mixed realistic document with many constructs.
15. `015-sanitized-vault-sample`: sanitized vault-like notes and backlinks.
16. `016-policy-sensitive`: safe placeholder document for access-policy behavior.
17. `017-long-heading-document`: many headings for folding and navigation tests.
18. `018-nested-lists-todos`: nested lists and task lists.

## Use

Automated checks should load fixtures from disk, not from in-memory mock strings. Manual checks should open `input.md` files where a host supports real local files.
