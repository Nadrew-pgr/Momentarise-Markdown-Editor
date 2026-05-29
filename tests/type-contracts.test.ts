import type {
  DocumentDialect,
  DocumentHash,
  DocumentPath,
  DocumentSnapshot,
  OpaqueNode,
  PolicyCapability,
  SourceRange
} from "@momentarise/md-core";
import type { MarkdownFormatContract } from "@momentarise/md-format";
import type { SaveEngineContract } from "@momentarise/md-save";
import type { WebAdapterContract } from "@momentarise/md-adapter-web";
import type { CliContract } from "@momentarise/md-cli";

const range: SourceRange = {
  start: { line: 1, column: 1, offset: 0 },
  end: { line: 1, column: 12, offset: 11 }
};

const opaqueNode: OpaqueNode = {
  id: "node-opaque-1",
  kind: "opaque",
  type: "opaque",
  raw: "%% unsupported custom markdown %%\n",
  sourceRange: range,
  preservation: "preserve-raw"
};

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

const cliContract: CliContract = {
  packageName: "@momentarise/md-cli",
  dependsOnCore: true,
  commandName: "mme"
};

void opaqueNode;
void snapshot;
void formatContract;
void saveEngineContract;
void webAdapterContract;
void cliContract;
