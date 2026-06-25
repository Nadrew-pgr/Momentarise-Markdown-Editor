import { hashMarkdownContent, type DocumentPath } from "@momentarise/md-core";
import { createMarkdownAstParser, serializeMomentariseDocument } from "@momentarise/md-format";
import { createMemorySaveTarget } from "@momentarise/md-save";
import { createDefaultPolicyResolver } from "@momentarise/md-policy";
import { createAiWritingSession, createMockAiProvider } from "@momentarise/md-ai";
import { createMarkdownEditorSession } from "@momentarise/md-editor";
import { createSandboxedHtmlPreview } from "@momentarise/md-preview-html";
import { createMomentariseRichSchema, proseMirrorDocToMomentariseNodes } from "@momentarise/md-rich-prosemirror";
import { createMomentariseSourceExtensions } from "@momentarise/md-source-codemirror";
import { createImportedCopyDocument } from "@momentarise/md-adapter-web";

const markdown = "# Consumer smoke\n\nPortable **Markdown** stays the source.\n";
const parser = createMarkdownAstParser();
const parseResult = parser.parse(markdown, {
  dialect: "momentarise-enhanced",
  path: "consumer-smoke.md" as DocumentPath
});
const serialized = serializeMomentariseDocument(parseResult);
const target = createMemorySaveTarget({ initialContent: serialized.content });
const session = createMarkdownEditorSession({
  aiProvider: createMockAiProvider(),
  content: serialized.content,
  scheduler: {
    schedule(callback) {
      callback();
      return () => undefined;
    }
  },
  target
});

session.setMode("rich");
session.setContent(`${session.getContent()}\nA consumer can import the headless package.\n`, "host");

const policy = createDefaultPolicyResolver().resolve({
  capability: "share",
  subject: {
    documentPath: "consumer-smoke.md"
  }
});
const aiSession = createAiWritingSession({
  apiKey: "memory-only-key",
  provider: createMockAiProvider()
});
const htmlPreview = createSandboxedHtmlPreview({
  fileName: "artifact.html",
  html: "<article><h1>Safe preview</h1></article>"
});
const richSchema = createMomentariseRichSchema();
const richNodes = proseMirrorDocToMomentariseNodes(
  richSchema.nodes.doc!.create(null, [richSchema.nodes.paragraph!.create()])
);
const sourceExtensions = createMomentariseSourceExtensions({ includeDefaultTheme: false });
const imported = createImportedCopyDocument({
  content: markdown,
  fileName: "consumer-smoke.md"
});

document.querySelector<HTMLDivElement>("#app")!.textContent = [
  parseResult.snapshot.hash,
  hashMarkdownContent(serialized.content),
  String(policy.allowed),
  aiSession.providerName,
  htmlPreview.kind,
  String(richNodes.length),
  String(sourceExtensions.length),
  imported.mode,
  target.persistenceTarget
].join(" | ");
