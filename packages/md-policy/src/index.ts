import type {
  DocumentAccessPolicy,
  FrontmatterRecord,
  PolicyCapability,
  PolicyDecision
} from "@momentarise/md-core";

export interface PolicyContract {
  readonly packageName: "@momentarise/md-policy";
  readonly dependsOnCore: true;
}

export interface PolicySubjectInput {
  readonly documentPath: string | null;
  readonly frontmatter?: FrontmatterRecord;
}

export interface PolicyResolveRequest {
  readonly capability: PolicyCapability;
  readonly subject: PolicySubjectInput;
}

export interface PolicyAuditRecord extends PolicyDecision {
  readonly documentPath: string | null;
  readonly timestamp: string;
}

export interface PolicyResolver {
  resolve(request: PolicyResolveRequest): PolicyDecision;
  audit(request: {
    readonly capability: PolicyCapability;
    readonly decision: PolicyDecision;
    readonly subject: PolicySubjectInput;
    readonly now?: Date;
  }): PolicyAuditRecord;
}

export interface ResolveDocumentPolicyOptions {
  readonly capabilities: readonly PolicyCapability[];
  readonly subject: PolicySubjectInput;
  readonly resolver?: PolicyResolver;
}

export const policyPackage: PolicyContract = {
  dependsOnCore: true,
  packageName: "@momentarise/md-policy"
};

const hardDenyPathPatterns = [
  /(^|\/)\.env(?:\.|$|\/)/i,
  /(^|\/)(?:secrets?|tokens?|keys?)(?:\.|$|\/)/i,
  /(^|\/)(?:identity|banking|private)(?:\.|$|\/)/i
];

export function createDefaultPolicyResolver(): PolicyResolver {
  return {
    audit({ capability, decision, now, subject }) {
      const record: PolicyAuditRecord = {
        allowed: decision.allowed,
        capability,
        documentPath: subject.documentPath,
        timestamp: (now ?? new Date()).toISOString()
      };
      if (decision.reason) {
        return {
          ...record,
          reason: decision.reason
        };
      }
      return record;
    },
    resolve(request) {
      const path = request.subject.documentPath ?? "";
      if (hardDenyPathPatterns.some((pattern) => pattern.test(path))) {
        return {
          allowed: false,
          capability: request.capability,
          reason: `hard deny: ${path || "unknown path"} is protected by baseline document policy`
        };
      }

      const frontmatterDecision = decisionFromFrontmatter(request.subject.frontmatter, request.capability);
      if (frontmatterDecision) {
        return frontmatterDecision;
      }

      return {
        allowed: true,
        capability: request.capability,
        reason: "default allow: no baseline deny rule matched"
      };
    }
  };
}

export function resolveDocumentPolicy(options: ResolveDocumentPolicyOptions): DocumentAccessPolicy {
  const resolver = options.resolver ?? createDefaultPolicyResolver();
  return {
    decisions: options.capabilities.map((capability) =>
      resolver.resolve({
        capability,
        subject: options.subject
      })
    )
  };
}

function decisionFromFrontmatter(
  frontmatter: FrontmatterRecord | undefined,
  capability: PolicyCapability
): PolicyDecision | null {
  const policy = frontmatter?.policy;
  if (!isRecord(policy)) {
    return null;
  }

  const value = policy[capability];
  if (value === false) {
    return {
      allowed: false,
      capability,
      reason: `frontmatter policy denies ${capability}`
    };
  }
  if (value === true) {
    return {
      allowed: true,
      capability,
      reason: `frontmatter policy allows ${capability}`
    };
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export type {
  DocumentAccessPolicy,
  PolicyCapability,
  PolicyDecision
} from "@momentarise/md-core";
