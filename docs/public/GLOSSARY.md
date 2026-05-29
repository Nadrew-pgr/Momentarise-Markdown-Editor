# Glossary

## Fixture

A fixture is a representative test file used to prove the framework does not corrupt Markdown.

Examples: a note with frontmatter, a GFM table, a code fence, a callout, a wikilink, inline HTML, Mermaid, LaTeX, unknown syntax, or a sanitized real vault sample.

Fixtures are the safety net. Without them, a rich UI can silently destroy user documents.

## Round-trip

Round-trip means parsing a Markdown document into the framework model and serializing it back to Markdown.

The framework must prove that known syntax is handled and unknown syntax is preserved.

## Opaque node

An opaque node is source text the framework does not understand yet but must preserve.

It prevents unsupported syntax from being deleted or normalized silently.

## Source range

A source range points to the location of a node in the original Markdown text.

It is required for preserving untouched regions and for editing only the intended part of the file.

## Folding UI

Folding UI is an interface state, like collapsing a heading or code block in an editor. It must not change the Markdown source.

## Toggle block

A toggle block is real document content. It is only created when the user explicitly inserts a collapsible block. Recommended portable output is `<details><summary>...</summary>...</details>`.

## Real file persistence

A save operation writes to an actual persistence target: disk, download, memory, backend, or host storage. The UI must say which target was used.

## BYOK

Bring Your Own Key. The user provides their own AI provider key for writing assistance. Keys must not be logged.
