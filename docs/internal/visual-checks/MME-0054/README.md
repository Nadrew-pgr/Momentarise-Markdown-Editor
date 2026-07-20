# MME-0054 Visual Check

Automated runtime verification against the local reference editor at 1360 x 860 and 390 x 844.

- `asset-upload-visible.png`: visible Insert image action with idle status hidden.
- `asset-upload-inserted.png`: safe provider result inserted as normal Markdown and save state marked dirty.
- `asset-upload-denied.png`: policy denial shown without document or save-hash mutation.
- `asset-upload-mobile.png`: compact mobile wrapping with the denial state visible.

The same run also verifies:

- real `ClipboardEvent` and `DragEvent` image insertion, including a MIME-less image filename;
- rich-cursor insertion before preserved GFM table syntax;
- safe failure for an unmappable rich block selection instead of appending at document end;
- stale upload rejection after document replacement and same-session external content application;
- unavailable, failed, pending, unsafe-provider, and explicit policy-denied no-mutation paths.

Final product/wording review remains queued in `docs/internal/BACKLOG.md`.
