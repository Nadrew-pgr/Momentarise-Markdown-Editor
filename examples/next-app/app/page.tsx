import { MarkdownEditorClient } from "./markdown-editor-client";

export default function Page() {
  return (
    <main>
      <h1>Momentarise Markdown Editor</h1>
      <p>Published npm alpha packages, mounted in a Next.js App Router client component.</p>
      <MarkdownEditorClient />
    </main>
  );
}
