import type { AiWritingAction } from "@momentarise/md-ai";
import {
  DEFAULT_HOST_CAPABILITIES,
  DEFAULT_PREFERENCE_SCHEMA,
  resolvePreferences,
  type HostCapabilities,
  type PreferenceLock,
  type PreferenceValue
} from "@momentarise/md-editor";

export type ReferenceToolbarMode = "sticky" | "floating" | "inline" | "hidden";
export type ReferenceToolbarStyle = "glass" | "solid" | "compact";
export type ReferenceCommandGroup = "blocks" | "marks" | "lists" | "insert" | "ai" | "status";
export type ReferenceAiEntryPoint = "slash" | "toolbar" | "selection" | "command-palette" | "contextual-toolbar";
export type ReferenceTechnicalStatusDisclosure = "discreet" | "popover" | "debug-panel" | "hidden";
export type ReferenceModeControl = "compact-tabs" | "single-toggle" | "host-provided";
export type ReferenceLayoutDensity = "compact" | "comfortable" | "spacious";
export type ReferenceKeymapProfile = "default" | "delegate" | "minimal";

export interface ReferenceEditorPreferences {
  readonly aiEntryPoints: readonly ReferenceAiEntryPoint[];
  readonly capabilities: HostCapabilities;
  readonly editorFontScale: number;
  readonly keymapDelegateToHost: boolean;
  readonly keymapProfile: ReferenceKeymapProfile;
  readonly layoutDensity: ReferenceLayoutDensity;
  readonly modeControl: ReferenceModeControl;
  readonly optionalStats: boolean;
  readonly readableLineWidth: number;
  readonly technicalStatusDisclosure: ReferenceTechnicalStatusDisclosure;
  readonly toolbarMode: ReferenceToolbarMode;
  readonly toolbarStyle: ReferenceToolbarStyle;
  readonly visibleCommandGroups: readonly ReferenceCommandGroup[];
}

export interface ReferenceEditorPreferenceInput extends Partial<Omit<ReferenceEditorPreferences, "capabilities">> {
  readonly capabilities?: Partial<HostCapabilities>;
  readonly locks?: Readonly<Record<string, PreferenceLock>>;
  readonly userPreferences?: Partial<Omit<ReferenceEditorPreferences, "capabilities">>;
  readonly userVisible?: readonly string[];
}

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
  capabilities: DEFAULT_HOST_CAPABILITIES,
  editorFontScale: 1,
  keymapDelegateToHost: false,
  keymapProfile: "default",
  layoutDensity: "comfortable",
  modeControl: "compact-tabs",
  optionalStats: false,
  readableLineWidth: 880,
  technicalStatusDisclosure: "discreet",
  toolbarMode: "sticky",
  toolbarStyle: "glass",
  visibleCommandGroups: ["blocks", "marks", "lists", "insert", "ai", "status"]
};

export function resolveReferenceEditorPreferences(
  hostPreferences: ReferenceEditorPreferenceInput = {}
): ReferenceEditorPreferences {
  const resolved = resolvePreferences({
    schema: DEFAULT_PREFERENCE_SCHEMA,
    layers: {
      host: referenceInputToPreferenceLayer(hostPreferences),
      user: referenceInputToPreferenceLayer(hostPreferences.userPreferences ?? {})
    },
    ...(hostPreferences.locks ? { locks: hostPreferences.locks } : {}),
    userVisible: hostPreferences.userVisible ?? [
      "ai.entryPoints",
      "editor.fontScale",
      "keymap.delegateToHost",
      "keymap.profile",
      "layout.density",
      "layout.readableLineWidth",
      "modeSwitcher.style",
      "status.disclosure",
      "stats.enabled",
      "toolbar.mode",
      "toolbar.style"
    ]
  });
  const value = (key: string): PreferenceValue => {
    const preference = resolved.preferences[key];
    if (!preference) {
      throw new Error(`Missing resolved reference preference: ${key}`);
    }
    return preference.value;
  };
  return {
    aiEntryPoints: value("ai.entryPoints") as readonly ReferenceAiEntryPoint[],
    capabilities: {
      ...DEFAULT_REFERENCE_EDITOR_PREFERENCES.capabilities,
      ...hostPreferences.capabilities
    },
    editorFontScale: value("editor.fontScale") as number,
    keymapDelegateToHost: value("keymap.delegateToHost") as boolean,
    keymapProfile: value("keymap.profile") as ReferenceKeymapProfile,
    layoutDensity: value("layout.density") as ReferenceLayoutDensity,
    modeControl: value("modeSwitcher.style") as ReferenceModeControl,
    optionalStats: value("stats.enabled") as boolean,
    readableLineWidth: value("layout.readableLineWidth") as number,
    technicalStatusDisclosure: value("status.disclosure") as ReferenceTechnicalStatusDisclosure,
    toolbarMode: value("toolbar.mode") as ReferenceToolbarMode,
    toolbarStyle: value("toolbar.style") as ReferenceToolbarStyle,
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

function referenceInputToPreferenceLayer(
  preferences: Partial<Omit<ReferenceEditorPreferences, "capabilities">>
): Readonly<Record<string, PreferenceValue>> {
  const layer: Record<string, PreferenceValue> = {};
  if (preferences.aiEntryPoints) {
    layer["ai.entryPoints"] = preferences.aiEntryPoints;
  }
  if (preferences.editorFontScale !== undefined) {
    layer["editor.fontScale"] = preferences.editorFontScale;
  }
  if (preferences.keymapDelegateToHost !== undefined) {
    layer["keymap.delegateToHost"] = preferences.keymapDelegateToHost;
  }
  if (preferences.keymapProfile) {
    layer["keymap.profile"] = preferences.keymapProfile;
  }
  if (preferences.layoutDensity) {
    layer["layout.density"] = preferences.layoutDensity;
  }
  if (preferences.modeControl) {
    layer["modeSwitcher.style"] = preferences.modeControl;
  }
  if (preferences.optionalStats !== undefined) {
    layer["stats.enabled"] = preferences.optionalStats;
  }
  if (preferences.readableLineWidth !== undefined) {
    layer["layout.readableLineWidth"] = preferences.readableLineWidth;
  }
  if (preferences.technicalStatusDisclosure) {
    layer["status.disclosure"] = preferences.technicalStatusDisclosure;
  }
  if (preferences.toolbarMode) {
    layer["toolbar.mode"] = preferences.toolbarMode;
  }
  if (preferences.toolbarStyle) {
    layer["toolbar.style"] = preferences.toolbarStyle;
  }
  return layer;
}
