import type { AiWritingAction } from "@momentarise/md-ai";

export type ReferenceToolbarMode = "sticky" | "floating" | "inline" | "hidden";
export type ReferenceToolbarStyle = "glass" | "solid" | "compact";
export type ReferenceCommandGroup = "blocks" | "marks" | "lists" | "insert" | "ai" | "status";
export type ReferenceAiEntryPoint = "slash" | "toolbar" | "selection" | "command-palette" | "contextual-toolbar";
export type ReferenceTechnicalStatusDisclosure = "discreet" | "popover" | "debug-panel" | "hidden";
export type ReferenceModeControl = "compact-tabs" | "single-toggle" | "host-provided";

export interface ReferenceEditorPreferences {
  readonly aiEntryPoints: readonly ReferenceAiEntryPoint[];
  readonly modeControl: ReferenceModeControl;
  readonly optionalStats: boolean;
  readonly technicalStatusDisclosure: ReferenceTechnicalStatusDisclosure;
  readonly toolbarMode: ReferenceToolbarMode;
  readonly toolbarStyle: ReferenceToolbarStyle;
  readonly visibleCommandGroups: readonly ReferenceCommandGroup[];
}

export type ReferenceEditorPreferenceInput = Partial<ReferenceEditorPreferences>;

export type ReferenceAiActionId =
  | "continue"
  | "draft"
  | "rewrite"
  | "improve"
  | "shorten"
  | "expand"
  | "summarize"
  | "tone"
  | "explain"
  | "translate"
  | "checklist"
  | "table";

export interface ReferenceAiAction {
  readonly demoAction: AiWritingAction;
  readonly entryPoints: readonly ReferenceAiEntryPoint[];
  readonly id: ReferenceAiActionId;
  readonly label: string;
  readonly prompt: string;
}

export const REFERENCE_AI_ACTIONS: readonly ReferenceAiAction[] = [
  {
    demoAction: "complete",
    entryPoints: ["slash", "toolbar", "command-palette"],
    id: "continue",
    label: "Continue writing",
    prompt: "Continue this Markdown section in the same voice."
  },
  {
    demoAction: "insert-block",
    entryPoints: ["slash", "toolbar", "command-palette"],
    id: "draft",
    label: "Draft section",
    prompt: "Draft a useful Markdown section for this document."
  },
  {
    demoAction: "rewrite",
    entryPoints: ["toolbar", "selection"],
    id: "rewrite",
    label: "Rewrite selection",
    prompt: "Rewrite the selected text clearly."
  },
  {
    demoAction: "improve",
    entryPoints: ["toolbar", "selection"],
    id: "improve",
    label: "Improve writing",
    prompt: "Improve clarity, structure, and precision."
  },
  {
    demoAction: "rewrite",
    entryPoints: ["selection"],
    id: "shorten",
    label: "Shorten",
    prompt: "Shorten the selected text without losing the important meaning."
  },
  {
    demoAction: "rewrite",
    entryPoints: ["selection"],
    id: "expand",
    label: "Expand",
    prompt: "Expand the selected idea with useful detail."
  },
  {
    demoAction: "summarize",
    entryPoints: ["slash", "toolbar", "selection", "command-palette"],
    id: "summarize",
    label: "Summarize",
    prompt: "Summarize the current document or selection."
  },
  {
    demoAction: "rewrite",
    entryPoints: ["selection"],
    id: "tone",
    label: "Adjust tone",
    prompt: "Rewrite with a calmer, more professional tone."
  },
  {
    demoAction: "summarize",
    entryPoints: ["selection", "command-palette"],
    id: "explain",
    label: "Explain",
    prompt: "Explain the selected passage simply."
  },
  {
    demoAction: "rewrite",
    entryPoints: ["selection"],
    id: "translate",
    label: "Translate",
    prompt: "Translate the selected text while preserving Markdown structure."
  },
  {
    demoAction: "insert-block",
    entryPoints: ["slash", "toolbar"],
    id: "checklist",
    label: "Make checklist",
    prompt: "Turn the relevant ideas into a Markdown checklist."
  },
  {
    demoAction: "insert-block",
    entryPoints: ["slash", "toolbar"],
    id: "table",
    label: "Make table",
    prompt: "Create a compact Markdown table from the relevant information."
  }
];

export const DEFAULT_REFERENCE_EDITOR_PREFERENCES: ReferenceEditorPreferences = {
  aiEntryPoints: ["slash", "toolbar", "selection", "command-palette"],
  modeControl: "compact-tabs",
  optionalStats: false,
  technicalStatusDisclosure: "discreet",
  toolbarMode: "sticky",
  toolbarStyle: "glass",
  visibleCommandGroups: ["blocks", "marks", "lists", "insert", "ai", "status"]
};

export function resolveReferenceEditorPreferences(
  hostPreferences: ReferenceEditorPreferenceInput = {}
): ReferenceEditorPreferences {
  return {
    aiEntryPoints: hostPreferences.aiEntryPoints ?? DEFAULT_REFERENCE_EDITOR_PREFERENCES.aiEntryPoints,
    modeControl: hostPreferences.modeControl ?? DEFAULT_REFERENCE_EDITOR_PREFERENCES.modeControl,
    optionalStats: hostPreferences.optionalStats ?? DEFAULT_REFERENCE_EDITOR_PREFERENCES.optionalStats,
    technicalStatusDisclosure:
      hostPreferences.technicalStatusDisclosure ?? DEFAULT_REFERENCE_EDITOR_PREFERENCES.technicalStatusDisclosure,
    toolbarMode: hostPreferences.toolbarMode ?? DEFAULT_REFERENCE_EDITOR_PREFERENCES.toolbarMode,
    toolbarStyle: hostPreferences.toolbarStyle ?? DEFAULT_REFERENCE_EDITOR_PREFERENCES.toolbarStyle,
    visibleCommandGroups:
      hostPreferences.visibleCommandGroups ?? DEFAULT_REFERENCE_EDITOR_PREFERENCES.visibleCommandGroups
  };
}

export function referenceAiActionsForEntryPoint(
  preferences: ReferenceEditorPreferences,
  entryPoint: ReferenceAiEntryPoint
): readonly ReferenceAiAction[] {
  if (!preferences.aiEntryPoints.includes(entryPoint)) {
    return [];
  }
  return REFERENCE_AI_ACTIONS.filter((action) => action.entryPoints.includes(entryPoint));
}
