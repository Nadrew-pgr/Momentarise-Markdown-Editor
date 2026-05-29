import type { DocumentSnapshot, EditorMode, SaveState, SidecarState } from "@momentarise/md-core";

export interface WebAdapterContract {
  readonly packageName: "@momentarise/md-adapter-web";
  readonly dependsOnCore: true;
  readonly host: "web";
}

export interface WebDocumentSession {
  readonly snapshot: DocumentSnapshot;
  readonly mode: EditorMode;
  readonly saveState: SaveState;
  readonly sidecar: SidecarState;
}

export interface WebAdapterHost {
  open(snapshot: DocumentSnapshot): WebDocumentSession;
}

export type {
  DocumentSnapshot,
  EditorMode,
  PersistenceTarget,
  SaveState,
  SaveStatus,
  SidecarState
} from "@momentarise/md-core";
