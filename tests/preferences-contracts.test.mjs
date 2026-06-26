const editor = await import("../packages/md-editor/dist/index.js");

for (const exportName of [
  "DEFAULT_EDITOR_BEHAVIOR_PREFERENCES",
  "DEFAULT_HOST_CAPABILITIES",
  "DEFAULT_PREFERENCE_SCHEMA",
  "extractDocumentPreferences",
  "resolvePreferences"
]) {
  assert(exportName in editor, `Missing md-editor preference export: ${exportName}`);
}

const schema = editor.DEFAULT_PREFERENCE_SCHEMA;
const schemaKeys = new Set(schema.map((definition) => definition.key));
for (const key of [
  "toolbar.mode",
  "toolbar.style",
  "slash.enabled",
  "slash.groups",
  "palette.enabled",
  "palette.hotkey",
  "blocks.dragHandle",
  "blocks.plusButton",
  "ai.entryPoints",
  "modeSwitcher.style",
  "status.disclosure",
  "folding.ui",
  "codeBlock.lineNumbers",
  "codeBlock.languagePicker",
  "layout.density",
  "layout.viewportClass",
  "layout.readableLineWidth",
  "keymap.profile",
  "keymap.delegateToHost",
  "keymap.bindings",
  "editor.fontScale",
  "save.autosaveDelayMs",
  "stats.enabled"
]) {
  assert(schemaKeys.has(key), `Default preference schema missing required key: ${key}`);
}

const resolved = editor.resolvePreferences({
  schema,
  layers: {
    document: {
      "layout.readableLineWidth": 760,
      "toolbar.mode": "floating"
    },
    host: {
      "toolbar.mode": "sticky",
      "toolbar.style": "solid"
    },
    user: {
      "toolbar.mode": "inline",
      "toolbar.style": "compact",
      "stats.enabled": true
    },
    workspace: {
      "toolbar.mode": "floating"
    }
  },
  userVisible: ["toolbar.mode", "stats.enabled"]
});

assert(resolved.preferences["toolbar.mode"].value === "inline", "user layer must win over lower layers.");
assert(resolved.preferences["toolbar.mode"].source === "user", "resolved source must report the winning layer.");
assert(resolved.preferences["toolbar.style"].value === "solid", "non-user-visible user writes must be ignored.");
assert(resolved.preferences["toolbar.style"].source === "host", "ignored user writes must preserve lower visible source.");
assert(resolved.preferences["toolbar.style"].userVisible === false, "absent userVisible keys must not be exposed.");
assert(resolved.preferences["stats.enabled"].value === true, "visible user preference must apply.");
assert(
  resolved.preferences["layout.readableLineWidth"].value === 760,
  "document allowlisted preference must apply."
);
assert(
  !resolved.preferences["toolbar.mode"].rejections.some((rejection) => rejection.source === "user"),
  "valid visible user write should not be rejected."
);
assert(
  resolved.preferences["toolbar.mode"].rejections.some((rejection) => rejection.code === "not-document-allowlisted"),
  "non-allowlisted document preference must be rejected."
);
assert(
  resolved.preferences["toolbar.style"].rejections.some((rejection) => rejection.code === "not-user-visible"),
  "non-visible user write must produce rejection metadata."
);
assert(
  resolved.preferences["toolbar.mode"].layerValues.framework === "sticky",
  "framework defaults must be recorded separately."
);

const locked = editor.resolvePreferences({
  schema,
  layers: {
    host: {
      "toolbar.mode": "sticky"
    },
    user: {
      "toolbar.mode": "inline"
    }
  },
  locks: {
    "toolbar.mode": {
      lockedBy: "workspace",
      reason: "Workspace standardizes toolbar placement",
      value: "hidden"
    }
  },
  userVisible: ["toolbar.mode"]
});

assert(locked.preferences["toolbar.mode"].value === "hidden", "lock value must override every layer.");
assert(locked.preferences["toolbar.mode"].locked === true, "locked preference must report locked true.");
assert(
  locked.preferences["toolbar.mode"].lockReason === "Workspace standardizes toolbar placement",
  "lock reason must be surfaced."
);
assert(locked.preferences["toolbar.mode"].source === "workspace", "lock source must use lockedBy.");
assert(
  locked.preferences["toolbar.mode"].rejections.some((rejection) => rejection.code === "locked"),
  "user writes to a locked preference must be rejected with metadata."
);
assert(
  locked.rejections.some((rejection) => rejection.key === "toolbar.mode" && rejection.overridable === false),
  "aggregate rejections must mirror policy-style non-overridable metadata without using md-policy types."
);

const extracted = editor.extractDocumentPreferences({
  mme: {
    "layout.readableLineWidth": 840,
    "stats.enabled": true,
    "toolbar.mode": "hidden",
    nested: {
      "stats.enabled": false
    }
  }
});
assert(extracted.preferences["layout.readableLineWidth"] === 840, "document extraction must allow readable width.");
assert(extracted.preferences["stats.enabled"] === true, "document extraction must allow stats.enabled.");
assert(
  !("toolbar.mode" in extracted.preferences),
  "document extraction must ignore non-allowlisted preference keys."
);
assert(
  extracted.diagnostics.some((diagnostic) => diagnostic.key === "toolbar.mode" && diagnostic.code === "not-document-allowlisted"),
  "ignored document preferences must produce diagnostics."
);
assert(
  extracted.diagnostics.some((diagnostic) => diagnostic.key === "nested" && diagnostic.code === "not-document-allowlisted"),
  "unexpected document preference objects must produce diagnostics."
);

const invalid = editor.resolvePreferences({
  schema,
  layers: {
    user: {
      "editor.fontScale": 9,
      "keymap.bindings": {
        "format.bold": "Mod-b"
      },
      "keymap.profile": "vim"
    }
  },
  userVisible: ["editor.fontScale", "keymap.bindings", "keymap.profile"]
});
assert(invalid.preferences["editor.fontScale"].value !== 9, "invalid numeric value must not apply.");
assert(
  invalid.rejections.some((rejection) => rejection.key === "editor.fontScale" && rejection.code === "invalid-value"),
  "invalid numeric value must produce rejection metadata."
);
assert(
  invalid.preferences["keymap.bindings"].value["format.bold"] === "Mod-b",
  "record-valued keymap bindings must be supported."
);
assert(
  invalid.preferences["keymap.profile"].value !== "vim",
  "invalid enum values must not apply."
);

assert(
  editor.DEFAULT_HOST_CAPABILITIES.viewportClass === "desktop",
  "default host capabilities must declare a desktop viewport."
);
const capabilities = {
  ...editor.DEFAULT_HOST_CAPABILITIES,
  aiProviderPresent: true,
  fileSystemAccess: true,
  offline: true,
  touchDevice: true,
  viewportClass: "tablet"
};
assert(capabilities.aiProviderPresent === true, "host capabilities must be facts supplied by the host.");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
