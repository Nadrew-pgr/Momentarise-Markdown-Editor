import {
  createPolicyResolver,
  createDefaultPolicyResolver,
  resolveDocumentPolicy
} from "../packages/md-policy/dist/index.js";
import { existsSync, readFileSync } from "node:fs";

const envFixturePath = "fixtures/016-policy-sensitive/.env";
const gitignoreFixturePath = "fixtures/016-policy-sensitive/.gitignore";

if (!existsSync(envFixturePath) || !readFileSync(envFixturePath, "utf8").includes("REDACTED_DO_NOT_USE")) {
  throw new Error("Policy tests must use a real sanitized .env fixture file.");
}

if (!existsSync(gitignoreFixturePath)) {
  throw new Error("Policy tests must use a real .gitignore repo-control fixture file.");
}

const resolver = createDefaultPolicyResolver();

const envDecision = resolver.resolve({
  capability: "read",
  subject: {
    documentPath: envFixturePath
  }
});

if (
  envDecision.allowed !== false ||
  !envDecision.reason?.includes("hard deny") ||
  envDecision.severity !== "blocker" ||
  envDecision.source !== "hard-deny" ||
  envDecision.overridable !== false
) {
  throw new Error(".env reads must be hard-denied by the conservative default resolver.");
}

const markdownRead = resolver.resolve({
  capability: "read",
  subject: {
    documentPath: "notes/project.md"
  }
});

if (markdownRead.allowed !== true) {
  throw new Error("Ordinary Markdown read should be allowed by the default baseline policy.");
}

const gitignoreRead = resolver.resolve({
  capability: "read",
  subject: {
    documentPath: gitignoreFixturePath
  }
});

if (gitignoreRead.allowed !== true || gitignoreRead.severity === "blocker") {
  throw new Error(".gitignore should not be blanket hard-denied by the baseline policy.");
}

const gitignoreShare = resolver.resolve({
  capability: "share",
  subject: {
    documentPath: gitignoreFixturePath
  }
});

if (
  gitignoreShare.allowed !== true ||
  gitignoreShare.severity !== "warning" ||
  gitignoreShare.requiresUserConfirmation !== true ||
  gitignoreShare.source !== "framework-default"
) {
  throw new Error(".gitignore sharing should be allowed only with a policy warning by default.");
}

const shareDenied = resolveDocumentPolicy({
  capabilities: ["read", "share"],
  subject: {
    documentPath: "notes/team.md",
    frontmatter: {
      policy: {
        share: false
      }
    }
  }
});

const shareDecision = shareDenied.decisions.find((decision) => decision.capability === "share");
if (
  shareDecision?.allowed !== false ||
  !shareDecision.reason?.includes("frontmatter") ||
  shareDecision.source !== "document"
) {
  throw new Error("Frontmatter policy must be able to deny share before AI/rich integrations.");
}

const hostResolver = createPolicyResolver({
  hardDenyRules: [],
  rules: [
    {
      capabilities: ["read", "share", "export", "index"],
      effect: "warn",
      id: "momentarise-user-confirm-env",
      overridable: true,
      pathPattern: /(^|\/)\.env(?:\.|$|\/)/i,
      reason: "Momentarise host policy asks the user before touching env-like files",
      requiresUserConfirmation: true,
      source: "user"
    },
    {
      capabilities: ["share"],
      effect: "deny",
      id: "workspace-share-deny",
      pathPattern: /^workspace\/restricted\//,
      reason: "Workspace policy denies sharing restricted files",
      source: "workspace"
    }
  ]
});

const envWarning = hostResolver.resolve({
  capability: "read",
  subject: {
    documentPath: ".env.local"
  }
});

if (
  envWarning.allowed !== true ||
  envWarning.severity !== "warning" ||
  envWarning.source !== "user" ||
  envWarning.overridable !== true ||
  envWarning.requiresUserConfirmation !== true
) {
  throw new Error("Host policy should be able to allow risky files with warning/confirmation metadata.");
}

const workspaceShareDenied = hostResolver.resolve({
  capability: "share",
  subject: {
    documentPath: "workspace/restricted/launch.md"
  }
});

if (
  workspaceShareDenied.allowed !== false ||
  workspaceShareDenied.source !== "workspace" ||
  workspaceShareDenied.severity !== "blocker"
) {
  throw new Error("Host/workspace policy should be able to block actions without UI assumptions.");
}

const auditRecord = resolver.audit({
  capability: "read",
  decision: envDecision,
  subject: {
    documentPath: envFixturePath
  }
});

if (
  !auditRecord.reason ||
  auditRecord.allowed !== false ||
  auditRecord.capability !== "read" ||
  auditRecord.source !== "hard-deny" ||
  auditRecord.severity !== "blocker"
) {
  throw new Error("Policy baseline must produce audit records with denial reasons.");
}
