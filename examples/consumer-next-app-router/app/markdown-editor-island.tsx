"use client";

import dynamic from "next/dynamic";

const MarkdownEditorClient = dynamic(
  () => import("./markdown-editor-client").then((module) => module.MarkdownEditorClient),
  {
    loading: () => null,
    ssr: false
  }
);

export function MarkdownEditorIsland() {
  return <MarkdownEditorClient />;
}
