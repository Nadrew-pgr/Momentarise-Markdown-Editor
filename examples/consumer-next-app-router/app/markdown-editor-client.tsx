"use client";

import { useMemo } from "react";
import { MarkdownEditor, type MarkdownEditorReactOptions } from "@momentarise/md-react";
import { createMemorySaveTarget } from "@momentarise/md-save";

const initialContent = "# Next App Router consumer\n\nReact binding mounts only on the client.\n";

export function MarkdownEditorClient() {
  const options = useMemo<MarkdownEditorReactOptions>(() => ({
    content: initialContent,
    scheduler: {
      schedule(callback, delayMs) {
        const id = window.setTimeout(() => void callback(), delayMs);
        return () => window.clearTimeout(id);
      }
    },
    target: createMemorySaveTarget({ initialContent })
  }), []);

  return <MarkdownEditor className="next-consumer-editor" options={options} />;
}
