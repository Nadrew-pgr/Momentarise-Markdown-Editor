import type {
  DocumentAccessPolicy,
  FrontmatterRecord,
  PolicyCapability,
  PolicyDecision,
  PolicyDecisionSeverity,
  PolicySource
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

export type PolicyRuleEffect = "allow" | "warn" | "deny";

export interface PolicyRule {
  readonly id: string;
  readonly effect: PolicyRuleEffect;
  readonly capabilities?: readonly PolicyCapability[];
  readonly pathPattern?: RegExp | string;
  readonly reason: string;
  readonly source?: PolicySource;
  readonly overridable?: boolean;
  readonly requiresUserConfirmation?: boolean;
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

export interface CreatePolicyResolverOptions {
  readonly rules?: readonly PolicyRule[];
  readonly hardDenyRules?: readonly PolicyRule[];
}

export const policyPackage: PolicyContract = {
  dependsOnCore: true,
  packageName: "@momentarise/md-policy"
};

export const defaultHardDenyRules: readonly PolicyRule[] = [
  {
    capabilities: ["exists", "metadata", "read", "index", "write", "execute", "share", "export"],
    effect: "deny",
    id: "baseline-env-hard-deny",
    overridable: false,
    pathPattern: /(^|\/)\.env(?:\.|$|\/)/i,
    reason: "hard deny: env-like files are protected by baseline document policy",
    source: "hard-deny"
  },
  {
    capabilities: ["exists", "metadata", "read", "index", "write", "execute", "share", "export"],
    effect: "deny",
    id: "baseline-secret-path-hard-deny",
    overridable: false,
    pathPattern: /(^|\/)(?:secrets?|tokens?|keys?)(?:\.|$|\/)/i,
    reason: "hard deny: secret/token/key paths are protected by baseline document policy",
    source: "hard-deny"
  },
  {
    capabilities: ["exists", "metadata", "read", "index", "write", "execute", "share", "export"],
    effect: "deny",
    id: "baseline-private-path-hard-deny",
    overridable: false,
    pathPattern: /(^|\/)(?:identity|banking|private)(?:\.|$|\/)/i,
    reason: "hard deny: private identity or banking paths are protected by baseline document policy",
    source: "hard-deny"
  }
];

export const defaultFrameworkPolicyRules: readonly PolicyRule[] = [
  {
    capabilities: ["index", "share", "export"],
    effect: "warn",
    id: "baseline-gitignore-sensitive-warning",
    overridable: true,
    pathPattern: /(^|\/)\.gitignore$/i,
    reason: "repo-control file: host should confirm before indexing, sharing, or exporting",
    requiresUserConfirmation: true,
    source: "framework-default"
  }
];

export function createDefaultPolicyResolver(): PolicyResolver {
  return createPolicyResolver({
    hardDenyRules: defaultHardDenyRules,
    rules: defaultFrameworkPolicyRules
  });
}

export function createPolicyResolver(options: CreatePolicyResolverOptions = {}): PolicyResolver {
  const hardDenyRules = options.hardDenyRules ?? defaultHardDenyRules;
  const rules = options.rules ?? [];

  return {
    audit({ capability, decision, now, subject }) {
      const record: PolicyAuditRecord = {
        allowed: decision.allowed,
        capability,
        documentPath: subject.documentPath,
        timestamp: (now ?? new Date()).toISOString()
      };
      return withDecisionMetadata(record, decision);
    },
    resolve(request) {
      const hardDenyDecision = decisionFromRules(hardDenyRules, request);
      if (hardDenyDecision) {
        return hardDenyDecision;
      }

      const frontmatterDecision = decisionFromFrontmatter(request.subject.frontmatter, request.capability);
      if (frontmatterDecision) {
        return frontmatterDecision;
      }

      const ruleDecision = decisionFromRules(rules, request);
      if (ruleDecision) {
        return ruleDecision;
      }

      return {
        allowed: true,
        capability: request.capability,
        reason: "default allow: no policy deny or warning rule matched",
        severity: "info",
        source: "framework-default"
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
      reason: `frontmatter policy denies ${capability}`,
      severity: "blocker",
      source: "document"
    };
  }
  if (value === true) {
    return {
      allowed: true,
      capability,
      reason: `frontmatter policy allows ${capability}`,
      severity: "info",
      source: "document"
    };
  }
  return null;
}

function decisionFromRules(
  rules: readonly PolicyRule[],
  request: PolicyResolveRequest
): PolicyDecision | null {
  for (const rule of rules) {
    if (!ruleMatches(rule, request)) {
      continue;
    }
    return decisionFromRule(rule, request.capability);
  }
  return null;
}

function ruleMatches(rule: PolicyRule, request: PolicyResolveRequest): boolean {
  if (rule.capabilities && !rule.capabilities.includes(request.capability)) {
    return false;
  }

  const path = normalizeDocumentPath(request.subject.documentPath);
  if (!rule.pathPattern) {
    return true;
  }

  if (typeof rule.pathPattern === "string") {
    return path === normalizeDocumentPath(rule.pathPattern);
  }

  return rule.pathPattern.test(path);
}

function decisionFromRule(rule: PolicyRule, capability: PolicyCapability): PolicyDecision {
  const severity = severityFromEffect(rule.effect);
  const overridable = rule.effect === "deny" ? (rule.overridable ?? false) : rule.overridable;
  const requiresUserConfirmation =
    rule.effect === "warn" ? (rule.requiresUserConfirmation ?? true) : rule.requiresUserConfirmation;
  const metadata: PolicyDecision = {
    allowed: rule.effect !== "deny",
    capability,
    reason: rule.reason,
    ruleId: rule.id,
    severity,
    source: rule.source ?? (rule.effect === "deny" ? "host" : "app-default"),
    ...(typeof overridable === "boolean" ? { overridable } : {}),
    ...(typeof requiresUserConfirmation === "boolean" ? { requiresUserConfirmation } : {})
  };

  return withDecisionMetadata(
    {
      allowed: rule.effect !== "deny",
      capability,
      reason: rule.reason
    },
    metadata
  );
}

function severityFromEffect(effect: PolicyRuleEffect): PolicyDecisionSeverity {
  if (effect === "warn") {
    return "warning";
  }
  if (effect === "deny") {
    return "blocker";
  }
  return "info";
}

function withDecisionMetadata<T extends PolicyDecision>(base: T, metadata: PolicyDecision): T {
  return {
    ...base,
    ...(metadata.reason ? { reason: metadata.reason } : {}),
    ...(metadata.source ? { source: metadata.source } : {}),
    ...(metadata.severity ? { severity: metadata.severity } : {}),
    ...(typeof metadata.overridable === "boolean" ? { overridable: metadata.overridable } : {}),
    ...(typeof metadata.requiresUserConfirmation === "boolean"
      ? { requiresUserConfirmation: metadata.requiresUserConfirmation }
      : {}),
    ...(metadata.ruleId ? { ruleId: metadata.ruleId } : {})
  };
}

function normalizeDocumentPath(documentPath: string | null): string {
  return (documentPath ?? "").replace(/\\/g, "/");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export type {
  DocumentAccessPolicy,
  PolicyCapability,
  PolicyDecision,
  PolicyDecisionSeverity,
  PolicySource
} from "@momentarise/md-core";
