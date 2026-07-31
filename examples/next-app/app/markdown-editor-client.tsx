"use client";

import { useMemo } from "react";
import { useMarkdownEditor, type MarkdownEditorReactOptions } from "@momentarise/md-react";
import { createMemorySaveTarget } from "@momentarise/md-save";

const initialContent = "# Momentarise Markdown Editor\n\nEdit this real Markdown document.\n\n- Source and Rich modes come from the same session.\n- Nothing here is written to disk: this is a memory-only save target.\n";

export function MarkdownEditorClient() {
  const options = useMemo<MarkdownEditorReactOptions>(
    () => ({
      content: initialContent,
      scheduler: {
        schedule(callback, delayMs) {
          const id = window.setTimeout(() => void callback(), delayMs);
          return () => window.clearTimeout(id);
        }
      },
      target: createMemorySaveTarget({ initialContent })
    }),
    []
  );

  const { containerRef, state } = useMarkdownEditor(options);

  return (
    <>
      <div className="mme-example-editor" ref={containerRef} />
      <p data-testid="mme-example-status" style={{ fontSize: "0.85rem", marginTop: "1rem" }}>
        mode: <strong>{state.mode}</strong> · save status: <strong>{state.saveState.status}</strong> · target:{" "}
        <strong>{state.saveState.target}</strong>
      </p>
    </>
  );
}
