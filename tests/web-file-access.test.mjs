import {
  canUseFileSystemAccess,
  createImportedCopyDocument,
  createWritableFileSaveTarget,
  openWritableMarkdownFile
} from "../packages/md-adapter-web/dist/index.js";
import { createSaveEngine, hashMarkdownContent, persistenceTargetLabel } from "../packages/md-save/dist/index.js";

const initialContent = "# Local File\n\nInitial body.\n";
const editedContent = "# Local File\n\nEdited body.\n";
const externalContent = "# Local File\n\nExternal body.\n";
const crlfContent = "# CRLF File\r\n\r\nInitial body.\r\n";
const normalizedCrlfContent = "# CRLF File\n\nInitial body.\n";
const editedCrlfContent = "# CRLF File\n\nEdited body.\n";
const editedCrlfDiskContent = "# CRLF File\r\n\r\nEdited body.\r\n";

if (canUseFileSystemAccess({}) !== false) {
  throw new Error("Host without showOpenFilePicker must not report File System Access support.");
}

const writableHost = createMockPickerHost({
  content: initialContent,
  name: "local-note.md"
});
if (canUseFileSystemAccess(writableHost) !== true) {
  throw new Error("Host with showOpenFilePicker must report File System Access support.");
}

const opened = await openWritableMarkdownFile(writableHost);
if (opened.mode !== "writable-file") {
  throw new Error(`Expected writable-file mode, got ${opened.mode}.`);
}
if (opened.content !== initialContent) {
  throw new Error("Writable open must read Markdown content from the file handle.");
}
if (opened.fileName !== "local-note.md") {
  throw new Error(`Unexpected opened filename: ${opened.fileName}`);
}
if (opened.target.persistenceTarget !== "disk") {
  throw new Error(`Writable opened target must be disk, got ${opened.target.persistenceTarget}.`);
}

const diskEngine = createSaveEngine({
  content: opened.content,
  now: date("2026-05-30T01:00:00.000Z"),
  target: opened.target
});
diskEngine.updateContent(editedContent, {
  now: date("2026-05-30T01:00:01.000Z")
});
const diskResult = await diskEngine.flush({
  now: date("2026-05-30T01:00:02.000Z"),
  reason: "manual"
});
if (diskResult.status !== "saved") {
  throw new Error(`Expected writable file flush to save, got ${diskResult.status}.`);
}
if (writableHost.readDiskContent() !== editedContent) {
  throw new Error("Writable file flush must write edited content back to the original handle.");
}
assertState(diskEngine.getState(), {
  currentHash: hashMarkdownContent(editedContent),
  lastSavedHash: hashMarkdownContent(editedContent),
  status: "saved",
  target: "disk"
});
assertIncludes(persistenceTargetLabel(diskEngine.getState()), "disk saved", "disk persistence label");

const crlfHost = createMockPickerHost({
  content: crlfContent,
  name: "crlf-note.md"
});
const crlfOpened = await openWritableMarkdownFile(crlfHost);
if (crlfOpened.content !== normalizedCrlfContent) {
  throw new Error("Writable open must normalize CRLF content for the editor without marking it dirty.");
}
const crlfEngine = createSaveEngine({
  content: crlfOpened.content,
  now: date("2026-05-30T01:00:10.000Z"),
  target: crlfOpened.target
});
if (crlfEngine.getState().status !== "saved" || crlfEngine.shouldAutosave(date("2026-05-30T01:00:12.000Z"))) {
  throw new Error("CRLF file open must remain clean and must not schedule autosave before user edits.");
}
const crlfNoop = await crlfEngine.flush({
  now: date("2026-05-30T01:00:13.000Z"),
  reason: "manual"
});
if (crlfNoop.status !== "noop") {
  throw new Error(`Expected CRLF no-op save to be noop, got ${crlfNoop.status}.`);
}
if (crlfHost.readDiskContent() !== crlfContent) {
  throw new Error("CRLF no-op save must not rewrite line endings.");
}
crlfEngine.updateContent(editedCrlfContent, {
  now: date("2026-05-30T01:00:14.000Z")
});
const crlfSaved = await crlfEngine.flush({
  now: date("2026-05-30T01:00:15.000Z"),
  reason: "manual"
});
if (crlfSaved.status !== "saved") {
  throw new Error(`Expected edited CRLF file to save, got ${crlfSaved.status}.`);
}
if (crlfHost.readDiskContent() !== editedCrlfDiskContent) {
  throw new Error("Edited CRLF file must preserve CRLF line endings on disk.");
}

const conflictHost = createMockPickerHost({
  content: initialContent,
  name: "conflict-note.md"
});
const conflictOpened = await openWritableMarkdownFile(conflictHost);
const conflictEngine = createSaveEngine({
  content: conflictOpened.content,
  now: date("2026-05-30T01:01:00.000Z"),
  target: conflictOpened.target
});
conflictEngine.updateContent(editedContent, {
  now: date("2026-05-30T01:01:01.000Z")
});
conflictHost.simulateExternalChange(externalContent);
const conflictResult = await conflictEngine.flush({
  now: date("2026-05-30T01:01:02.000Z"),
  reason: "manual"
});
if (conflictResult.status !== "conflict") {
  throw new Error(`Expected writable target conflict, got ${conflictResult.status}.`);
}
if (conflictHost.readDiskContent() !== externalContent) {
  throw new Error("Writable target conflict must not overwrite external content.");
}
assertState(conflictEngine.getState(), {
  status: "conflict",
  target: "conflict"
});

const imported = createImportedCopyDocument({
  content: initialContent,
  fileName: "fallback-upload.md"
});
if (imported.mode !== "imported-copy") {
  throw new Error(`Expected imported-copy mode, got ${imported.mode}.`);
}
if (imported.target.persistenceTarget !== "download-required") {
  throw new Error(`Imported copy target must require download, got ${imported.target.persistenceTarget}.`);
}
const importedEngine = createSaveEngine({
  content: imported.content,
  now: date("2026-05-30T01:02:00.000Z"),
  target: imported.target
});
importedEngine.updateContent(editedContent, {
  now: date("2026-05-30T01:02:01.000Z")
});
const importedResult = await importedEngine.flush({
  now: date("2026-05-30T01:02:02.000Z"),
  reason: "manual"
});
if (importedResult.status !== "blocked") {
  throw new Error(`Expected imported copy save to be blocked, got ${importedResult.status}.`);
}
assertState(importedEngine.getState(), {
  status: "dirty",
  target: "download-required"
});
assertIncludes(
  persistenceTargetLabel(importedEngine.getState()),
  "download required",
  "imported copy persistence label"
);

const importedCrlf = createImportedCopyDocument({
  content: crlfContent,
  fileName: "fallback-crlf.md"
});
if (importedCrlf.content !== normalizedCrlfContent) {
  throw new Error("Imported CRLF copy must normalize content for the editor.");
}
const importedCrlfEngine = createSaveEngine({
  content: importedCrlf.content,
  now: date("2026-05-30T01:02:10.000Z"),
  target: importedCrlf.target
});
if (importedCrlfEngine.getState().status !== "saved") {
  throw new Error("Imported CRLF copy must open clean before user edits.");
}

const directTargetHost = createMockPickerHost({
  content: initialContent,
  name: "direct-target.md"
});
const directTarget = createWritableFileSaveTarget({
  handle: directTargetHost.handle,
  targetLabel: "disk://direct-target.md"
});
if (directTarget.persistenceTarget !== "disk") {
  throw new Error("Direct writable target must expose disk persistence.");
}

const permissionDeniedHost = createMockPickerHost({
  content: initialContent,
  failCreateWritable: true,
  name: "permission-denied.md"
});
const permissionDeniedOpened = await openWritableMarkdownFile(permissionDeniedHost);
const permissionDeniedEngine = createSaveEngine({
  content: permissionDeniedOpened.content,
  now: date("2026-05-30T01:03:00.000Z"),
  target: permissionDeniedOpened.target
});
permissionDeniedEngine.updateContent(editedContent, {
  now: date("2026-05-30T01:03:01.000Z")
});
const permissionDeniedResult = await permissionDeniedEngine.flush({
  now: date("2026-05-30T01:03:02.000Z"),
  reason: "manual"
});
if (permissionDeniedResult.status !== "error") {
  throw new Error(`Expected createWritable failure to return error, got ${permissionDeniedResult.status}.`);
}
assertState(permissionDeniedEngine.getState(), {
  status: "error",
  target: "error"
});
assertIncludes(
  permissionDeniedEngine.getState().errorMessage,
  "Permission denied",
  "permission-denied error message"
);
if (!permissionDeniedEngine.shouldBlockClose()) {
  throw new Error("Save error with unsaved content must block close.");
}

const writableRaceHost = createMockPickerHost({
  content: initialContent,
  mutateOnCreateWritable: externalContent,
  name: "race-note.md"
});
const writableRaceOpened = await openWritableMarkdownFile(writableRaceHost);
const writableRaceEngine = createSaveEngine({
  content: writableRaceOpened.content,
  now: date("2026-05-30T01:04:00.000Z"),
  target: writableRaceOpened.target
});
writableRaceEngine.updateContent(editedContent, {
  now: date("2026-05-30T01:04:01.000Z")
});
const writableRaceResult = await writableRaceEngine.flush({
  now: date("2026-05-30T01:04:02.000Z"),
  reason: "manual"
});
if (writableRaceResult.status !== "conflict") {
  throw new Error(`Expected writable setup race to return conflict, got ${writableRaceResult.status}.`);
}
if (writableRaceHost.readDiskContent() !== externalContent) {
  throw new Error("Writable setup race must not overwrite external content.");
}

function assertIncludes(value, expected, label) {
  if (!String(value).includes(expected)) {
    throw new Error(`Expected ${label} to include ${JSON.stringify(expected)}, got ${JSON.stringify(value)}.`);
  }
}

function assertState(actual, expected) {
  for (const [key, value] of Object.entries(expected)) {
    if (actual[key] !== value) {
      throw new Error(`Expected state ${key}=${String(value)}, got ${String(actual[key])}.`);
    }
  }
}

function createMockPickerHost({ content, failCreateWritable = false, mutateOnCreateWritable, name }) {
  let diskContent = content;
  const handle = {
    kind: "file",
    name,
    async createWritable() {
      if (failCreateWritable) {
        throw new Error("Permission denied while creating writable stream.");
      }
      if (mutateOnCreateWritable) {
        diskContent = mutateOnCreateWritable;
      }
      let nextContent = "";
      return {
        async close() {
          diskContent = nextContent;
        },
        async write(value) {
          nextContent = String(value);
        }
      };
    },
    async getFile() {
      return {
        name,
        async text() {
          return diskContent;
        }
      };
    }
  };
  return {
    handle,
    readDiskContent() {
      return diskContent;
    },
    showOpenFilePickerOptions: [],
    async showOpenFilePicker(options) {
      this.showOpenFilePickerOptions.push(options);
      return [handle];
    },
    simulateExternalChange(nextContent) {
      diskContent = nextContent;
    }
  };
}

function date(value) {
  return new Date(value);
}
