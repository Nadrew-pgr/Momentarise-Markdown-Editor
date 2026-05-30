import {
  createDefaultPolicyResolver,
  resolveDocumentPolicy
} from "../packages/md-policy/dist/index.js";

const resolver = createDefaultPolicyResolver();

const envDecision = resolver.resolve({
  capability: "read",
  subject: {
    documentPath: ".env"
  }
});

if (envDecision.allowed !== false || !envDecision.reason?.includes("hard deny")) {
  throw new Error(".env reads must be hard-denied with a reason.");
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
if (shareDecision?.allowed !== false || !shareDecision.reason?.includes("frontmatter")) {
  throw new Error("Frontmatter policy must be able to deny share before AI/rich integrations.");
}

const auditRecord = resolver.audit({
  capability: "read",
  decision: envDecision,
  subject: {
    documentPath: ".env"
  }
});

if (!auditRecord.reason || auditRecord.allowed !== false || auditRecord.capability !== "read") {
  throw new Error("Policy baseline must produce audit records with denial reasons.");
}
