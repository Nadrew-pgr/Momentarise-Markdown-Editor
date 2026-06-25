import type {
  DocumentDialect,
  DocumentHash,
  DocumentPath,
  DocumentSnapshot,
  NodeId,
  OpaqueNode,
  PolicyCapability,
  PolicyDecisionSeverity,
  PolicySource,
  SourceRange
} from "@momentarise/md-core";
import { nodeId } from "@momentarise/md-core";
import type { MarkdownFormatContract } from "@momentarise/md-format";
import type { PolicyContract } from "@momentarise/md-policy";
import type { AiWritingContract } from "@momentarise/md-ai";
import type { MarkdownEditorContract } from "@momentarise/md-editor";
import type { HtmlPreviewContract } from "@momentarise/md-preview-html";
import type { MomentariseRichProseMirrorContract } from "@momentarise/md-rich-prosemirror";
import type { SaveEngineContract } from "@momentarise/md-save";
import type { MomentariseSourceCodeMirrorContract } from "@momentarise/md-source-codemirror";
import type {
  ComponentClassOverrides,
  IconName,
  IconSet,
  MmeScheme,
  MmeTheme,
  ThemeContract
} from "@momentarise/md-theme";
import type { WebAdapterContract } from "@momentarise/md-adapter-web";
import type { CliContract } from "@momentarise/md-cli";

const range: SourceRange = {
  start: { line: 1, column: 1, offset: 0 },
  end: { line: 1, column: 12, offset: 11 }
};

const opaqueNode: OpaqueNode = {
  id: nodeId("node-opaque-1"),
  kind: "opaque",
  type: "opaque",
  raw: "%% unsupported custom markdown %%\n",
  sourceRange: range,
  preservation: "preserve-raw"
};

const brandedNodeId: NodeId = nodeId("node-branded-1");
// @ts-expect-error NodeId must be intentionally branded before it crosses public contracts.
const rawNodeId: NodeId = "node-raw-1";

const snapshot: DocumentSnapshot = {
  content: "---\ntitle: Contract\n---\n# Heading\n",
  hash: "sha256:abc123" as DocumentHash,
  path: "notes/contract.md" as DocumentPath,
  dialect: "gfm" as DocumentDialect,
  frontmatter: {
    title: "Contract"
  }
};

const allCapabilities = [
  "exists",
  "metadata",
  "read",
  "index",
  "write",
  "execute",
  "share",
  "export"
] as const satisfies readonly PolicyCapability[];

type ExpectedPolicyCapability = (typeof allCapabilities)[number];
type MissingPolicyCapability = Exclude<ExpectedPolicyCapability, PolicyCapability>;
type UnexpectedPolicyCapability = Exclude<PolicyCapability, ExpectedPolicyCapability>;
type AssertNever<T extends never> = T;

type _PolicyCapabilityHasNoMissingValues = AssertNever<MissingPolicyCapability>;
type _PolicyCapabilityHasNoUnexpectedValues = AssertNever<UnexpectedPolicyCapability>;

const allPolicySources = [
  "framework-default",
  "app-default",
  "workspace",
  "folder",
  "database",
  "document",
  "user",
  "host",
  "hard-deny"
] as const satisfies readonly PolicySource[];

const allPolicySeverities = ["info", "warning", "blocker"] as const satisfies readonly PolicyDecisionSeverity[];

void allPolicySources;
void allPolicySeverities;

const formatContract: MarkdownFormatContract = {
  packageName: "@momentarise/md-format",
  dependsOnCore: true
};

const webAdapterContract: WebAdapterContract = {
  packageName: "@momentarise/md-adapter-web",
  dependsOnCore: true,
  host: "web"
};

const saveEngineContract: SaveEngineContract = {
  packageName: "@momentarise/md-save",
  dependsOnCore: true
};

const policyContract: PolicyContract = {
  packageName: "@momentarise/md-policy",
  dependsOnCore: true
};

const aiWritingContract: AiWritingContract = {
  dependsOnCore: true,
  packageName: "@momentarise/md-ai",
  policyCapability: "share"
};

const markdownEditorContract: MarkdownEditorContract = {
  dependsOnCore: true,
  headless: true,
  packageName: "@momentarise/md-editor"
};

const htmlPreviewContract: HtmlPreviewContract = {
  packageName: "@momentarise/md-preview-html",
  dependsOnCore: true,
  previewKind: "html"
};

const richProseMirrorContract: MomentariseRichProseMirrorContract = {
  packageName: "@momentarise/md-rich-prosemirror",
  richMode: "prosemirror"
};

const sourceCodeMirrorContract: MomentariseSourceCodeMirrorContract = {
  packageName: "@momentarise/md-source-codemirror",
  sourceMode: "codemirror6"
};

const themeContract: ThemeContract = {
  packageName: "@momentarise/md-theme",
  contract: "theme"
};

const hostTheme: MmeTheme = {
  colors: {
    accent: "#ff00aa"
  },
  shape: {
    radiusMd: "10px"
  },
  spacing: {
    density: "1.1"
  },
  typography: {
    fontScale: "1.08"
  }
};

const scheme: MmeScheme = "dark";
const iconName: IconName = "save";
const iconSet: IconSet = {
  render(name) {
    return `<svg data-icon="${name}" viewBox="0 0 16 16" aria-hidden="true"></svg>`;
  }
};
const classOverrides: ComponentClassOverrides = {
  toolbar: "host-toolbar"
};

const cliContract: CliContract = {
  packageName: "@momentarise/md-cli",
  dependsOnCore: true,
  commandName: "mme"
};

void opaqueNode;
void brandedNodeId;
void rawNodeId;
void snapshot;
void formatContract;
void saveEngineContract;
void policyContract;
void aiWritingContract;
void markdownEditorContract;
void htmlPreviewContract;
void richProseMirrorContract;
void sourceCodeMirrorContract;
void themeContract;
void hostTheme;
void scheme;
void iconName;
void iconSet;
void classOverrides;
void webAdapterContract;
void cliContract;
