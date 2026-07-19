# MME-0043 visual proof

- `live-preview-typed-constructs.png` proves the demo stays in `Live Preview` mode while typed Markdown prefixes render as rich heading and task constructs without switching through Source/Rich, with Source/Rich/Live Preview labels visible and rich toolbar/block handles hidden.
- `rich-mode-same-document.png` proves the same document in Rich mode keeps the rich toolbar/block handles visible and has no Live Preview banner, so Live Preview is not only a renamed Rich button.
- `live-preview-external-conflict.png` proves a dirty Live Preview buffer detects an external writable-file change as a conflict and keeps the local edit visible.
- `html-artifact-no-live-preview.png` proves standalone HTML artifacts expose Source/Preview controls only, with no Rich or Live Preview controls.
