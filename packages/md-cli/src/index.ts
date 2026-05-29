import type { DocumentDialect, DocumentPath } from "@momentarise/md-core";

export interface CliContract {
  readonly packageName: "@momentarise/md-cli";
  readonly dependsOnCore: true;
  readonly commandName: "mme";
}

export type CliCommandName =
  | "init"
  | "check"
  | "test:fixtures"
  | "inspect"
  | "format"
  | "create-fixture";

export interface CliCommandContext {
  readonly cwd: DocumentPath;
  readonly defaultDialect: DocumentDialect;
}

export interface CliCommandDefinition {
  readonly name: CliCommandName;
  readonly mutatesFiles: boolean;
}

export type { DocumentDialect, DocumentPath } from "@momentarise/md-core";
