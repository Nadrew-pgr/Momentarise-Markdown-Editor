# MME-0015 Visual Checks

Artifacts in this folder prove HTML source loading and sandboxed preview behavior. The visual harness loads the fixture through the real hidden HTML file input, not only through a test-only document loader.

- `html-source-opened.png` shows an imported `.html` artifact opened in source mode with HTML-specific status.
- `html-sandbox-preview.png` shows the same artifact rendered in the sandbox preview with sandbox/scripts-disabled UI labeling.
- `html-preview-responsive-frame.png` shows a responsive HTML artifact rendered through a mobile-width preview frame. The content must see the iframe width as its viewport; the demo must not zoom the artifact content to fake responsiveness.

Script blocking is proven by `scripts/visual-check-mme0015.mjs`, not by pixels alone. The visual harness loads a hostile HTML fixture that would append visible `SCRIPT RAN` text and set `window.top.__MME_HTML_PREVIEW_SCRIPT_RAN__` if scripts executed, then asserts the flag remains false after preview.

Human review required: yes, because MME-0015 is the HTML preview security/UI gate.
