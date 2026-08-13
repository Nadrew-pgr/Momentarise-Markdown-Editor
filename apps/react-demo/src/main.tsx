/**
 * MME-0125 — the workspace-backed React host.
 *
 * This app exists to be *measured*, not to be a second demo. `apps/md-demo` is
 * the reference bench and `examples/next-app` is the adoption proof (a pure
 * registry install, whose whole purpose is catching workspace-versus-registry
 * drift). Neither could catch what attempt 1 shipped: appending a permanent
 * bubble host made the rich host never `:empty`, so a default React consumer in
 * source mode got a transparent div swallowing every click meant for CodeMirror
 * — and every React test is jsdom, which has no layout, so the suite reported
 * "all checks passed" straight through it.
 *
 * So: the smallest possible host that mounts the binding from the workspace
 * packages and gets rendered by a real browser. Everything below exists because
 * `scripts/visual-check-mme0125.mjs` needs it; nothing here is product.
 *
 * It uses `useMarkdownEditor` rather than `<MarkdownEditor>` for one reason: the
 * hook returns the session, and the gate has to drive modes before a rich view
 * (and therefore any rich callback) exists.
 */

import { createMemorySaveTarget } from "@momentarise/md-save";
import { useMarkdownEditor, type MarkdownEditorReactOptions, type ReactRichViewHandle } from "@momentarise/md-react";
import { createRoot } from "react-dom/client";
import { StrictMode, useMemo, useState, type ReactElement } from "react";
import "./styles.css";

/*
 * Long enough that the editor host really scrolls at 1280x900. The bubble's
 * coordinate space is only wrong on a scrolled document, so a short fixture
 * would let that defect through exactly as jsdom did.
 */
const FIXTURE = [
  "# Momentarise React host",
  "",
  "This document is mounted through @momentarise/md-react from the workspace build.",
  "",
  "- Write Markdown",
  "- Continue lists",
  "- [ ] Continue todos",
  "",
  "> Quoted guidance for the writer",
  "",
  "```ts",
  'const canonical = "Markdown";',
  "```",
  "",
  ...Array.from(
    { length: 40 },
    (unused, index) => `Filler paragraph ${index + 1} exists so the editor host really scrolls.\n`
  )
].join("\n");

export interface ReactHostTestSurface {
  getContent(): string;
  getMode(): string;
  /** Null until rich mode has mounted; the gate waits on it. */
  getRichHandle(): ReactRichViewHandle | null;
  setBubbleEnabled(enabled: boolean): void;
  setMode(mode: "rich" | "source"): void;
}

declare global {
  interface Window {
    /** Read by `scripts/visual-check-mme0125.mjs`. Test surface, not product API. */
    __MME_REACT_HOST__?: ReactHostTestSurface;
  }
}

/*
 * One mutable record, written by whichever component owns each piece, and
 * published once. Two components each assigning `window.__MME_REACT_HOST__` in
 * an effect made the surface depend on effect ordering, which is precisely the
 * kind of thing that makes a gate flaky for reasons unrelated to the product.
 */
const testSurface: {
  richHandle: ReactRichViewHandle | null;
  session: { getContent(): string; getMode(): string; setMode(mode: "rich" | "source"): void } | null;
  setBubbleEnabled: (enabled: boolean) => void;
} = {
  richHandle: null,
  session: null,
  setBubbleEnabled: () => {}
};

window.__MME_REACT_HOST__ = {
  getContent: () => testSurface.session?.getContent() ?? "",
  getMode: () => testSurface.session?.getMode() ?? "source",
  getRichHandle: () => testSurface.richHandle,
  setBubbleEnabled: (enabled) => testSurface.setBubbleEnabled(enabled),
  setMode: (mode) => testSurface.session?.setMode(mode)
};

/**
 * The editor, remounted whenever the opt-out flips.
 *
 * `useMarkdownEditor` deliberately does not react to option changes — it holds
 * the session in a ref and mounts once, which is the MME-0081 StrictMode
 * contract. So proving that opting out mounts *nothing* (rather than something
 * hidden) requires a real remount, which is what the `key` in `Host` provides.
 */
function Editor({ bubbleEnabled }: { readonly bubbleEnabled: boolean }): ReactElement {
  const options = useMemo<MarkdownEditorReactOptions>(
    () => ({
      content: FIXTURE,
      // A real host supplies its own scheduler; the default autosave timer would
      // make the gate's measurements depend on wall-clock timing.
      scheduler: { schedule: () => () => {} },
      target: createMemorySaveTarget({ initialContent: FIXTURE }),
      onRichViewReady(handle: ReactRichViewHandle | null) {
        testSurface.richHandle = handle;
      },
      ...(bubbleEnabled ? {} : { surfacePreferences: { selectionBubble: false } })
    }),
    [bubbleEnabled]
  );

  const { containerRef, session } = useMarkdownEditor(options);
  testSurface.session = session;

  return <div className="react-host-shell" data-bubble-enabled={String(bubbleEnabled)} ref={containerRef} />;
}

function Host(): ReactElement {
  const [bubbleEnabled, setBubbleEnabled] = useState(true);
  testSurface.setBubbleEnabled = setBubbleEnabled;
  return <Editor bubbleEnabled={bubbleEnabled} key={String(bubbleEnabled)} />;
}

const container = document.getElementById("root");
if (!container) {
  throw new Error("react-demo: #root is missing from index.html");
}
createRoot(container).render(
  <StrictMode>
    <Host />
  </StrictMode>
);
