# Editor UX Benchmark — How World-Class Editors Actually Behave

Date: 2026-07-31. Requested by Andrew after using the demo: "interactions are not natural, must-haves are missing, code-editor interactions are not enough." This report is the research basis for the next UX issues. Sources: BlockNote documentation (formatting toolbar, suggestion menus, side menu, blocks) and repository README, Notion keyboard/markdown reference, Obsidian edit-and-read documentation, plus the 2026-07-30/31 hands-on tours of the MME demo. Status: research record — issues derived from it are added separately in `ISSUES.md`.

## The core finding

Notion, BlockNote, and Obsidian converge on a small set of **interaction contracts**. An editor feels "natural" when all of them hold simultaneously; each one MME violates is felt immediately as "this is janky", even if the user cannot name it. MME currently violates most of them. None of this is exotic: BlockNote is open source (MIT core) and implements every contract below on top of the same ProseMirror foundation MME uses — it is the direct implementation reference (interaction patterns, not styling, and never copied code).

## The interaction contracts

### 1. Rich is the product; modes are a utility

- Notion: there are no modes at all — the rich surface is the editor.
- Obsidian: **Live Preview is the default**; Source mode is a preference toggled by `Cmd+E` or a small icon — not a primary header control.
- MME today: opens in **Source** mode, with a three-button segmented control (`Source | Rich | Live Preview`) as one of the most prominent header elements. In the React binding, Live Preview was inert until MME-0101 removed it.
- Contract: **default mode = rich**. Mode switching becomes one subtle icon toggle (+ `Cmd+E`), host-configurable. Live Preview is not offered anywhere until it reaches Obsidian-grade parity. (Note: `md-surface` already has a `modeCycleButton` single-toggle variant — the demo simply doesn't use it; Andrew remembers this toggle and it is the better pattern.)

### 2. One hovered block owns the affordances

- BlockNote: the side menu (`+` and `⠿` drag handle) appears **only for the block under the pointer**, left-aligned to it, and disappears when the pointer leaves. Clicking `⠿` opens a block menu (delete, colors, turn-into…). Clicking `+` inserts and opens the slash menu.
- MME today: handles render statically for some blocks, misaligned, absent for others; the heading fold arrow overlaps the heading text (Andrew-reported).
- Contract: hover-scoped, animated (≤150ms) side affordances for every top-level block; fold arrows live in a reserved gutter that never overlaps content.

### 3. Focus is invisible; selection is visible

- Benchmark editors never outline the whole editor. The caret plus per-element selection states carry all focus information. Block selection is a first-class state: `Esc` selects the current block, arrow keys navigate between selected blocks, `Shift+Arrow` extends, `Cmd+A` escalates inline → block → all, `Cmd+D` duplicates, `Backspace` deletes selection.
- MME today: focusing anything draws a bright blue outline around the entire editor (Andrew: "toute la zone d'écriture en surbrillance"); there is no block-selection state at all.
- Contract: kill the editor-level outline (keep `:focus-visible` per control), and implement the block-selection state machine above.

### 4. Formatting lives in the selection, not in a persistent toolbar

- Notion has **no persistent formatting toolbar** — formatting appears when text is selected (bubble with turn-into dropdown, bold/italic/strike/code/link, color) and in the slash menu. BlockNote identical: its "Formatting Toolbar" *is* the selection toolbar, appearing on highlight, positioned above/below the selection, hidden for blocks without inline content.
- MME today: a persistent icon toolbar sits in the header in rich mode, while the selection bubble offers only 4 actions and mispositions.
- Contract: **no persistent toolbar by default** (host opt-in for Google-Docs-style products). The selection bubble becomes the formatting surface: turn-into dropdown, B/I/S/code, link (`Cmd+K`), and AI entry, correctly anchored, hidden while typing.

### 5. Markdown-as-you-type input rules are the muscle memory

Notion's exact set (all convert live, at line start unless inline): `#`→`######` headings; `-`/`*`/`+`+space bullets; `1.` numbered; `[]` todo; `>` quote/toggle; `---` divider; ``` fence with language typing; inline `**bold**`, `*italic*`, `` `code` ``, `~strike~`. Obsidian additionally keeps the syntax visible when the caret is inside it (Live Preview reveal rule). Also standard: smart pairing of `` ` ``, quotes and brackets in code contexts, and paste-URL-on-selection creates a link.
- MME today: partial input rules; Andrew reports auto-pairing existed and regressed; no `/callout` etc. for framed blocks.
- Contract: implement the full Notion input-rule table (it maps 1:1 to Markdown — MME's home turf, this should be its *strongest* area), restore pairing, and add paste-URL-to-link.

### 6. Every block type is insertable, and framed blocks have real UX

- BlockNote defaults: paragraph, H1-3 (toggleable), quote, bullet/numbered/check/toggle lists, code block **with language picker**, table, image/video/audio/file with captions.
- Code block UX benchmark: hovering shows a copy button and a language dropdown at the block's own corner; `/` never triggers inside; Enter inserts newlines; at the end, ArrowDown/clicking below exits. Nothing is permanently pinned elsewhere on screen.
- MME today: selecting a code block pins a `LANGUAGE / META` editing bar at the top of the content area, far from the block (Andrew: "pas intuitif du tout, et ultra moche"); `/` triggers inside code; callouts can be preserved/edited but **cannot be inserted** from the slash menu (Andrew: "pas encore de callout"); no toggle blocks in rich; media insertion exists but scattered.
- Contract: per-block corner controls (copy + language on code, type/title on callout), full slash coverage of every supported block including callout, and no globally-pinned block editors.

### 7. Placeholders, drag-and-drop, and motion are baseline, not polish

- BlockNote's README sells exactly three things as the out-of-the-box feel: "helpful placeholders", "smooth animations", "drag and drop blocks". Notion: empty focused line shows "Write, press '/' for commands"; empty headings show "Heading 1".
- MME today: no placeholders, no drag-and-drop, no motion (overlays pop with zero transition).
- Contract: placeholder on empty focused blocks; drag handle actually drags with a drop-line indicator and 150ms settle animation; all overlays enter/exit with the MME-0102 motion tokens.

### 8. The chrome never fights the document

- Notion/Obsidian header: document identity + a few quiet icons. Save state is implicit or a subtle indicator — never three stacked chips.
- MME today: `filename chip + CLEAN badge + Save button` collide at top-right; a `TECHNICAL DIAGNOSTICS` chip floats over content.
- Contract: already specified in MME-0091 (single status affordance + popover); this report adds: the persistent toolbar removal (contract 4) and mode-control demotion (contract 1) land in the same redesign.

## The Markdown-native contracts (Obsidian / Typora) — MME's actual differentiator

The first eight contracts make MME feel as good as a Notion clone. These four make it feel like *MME* — they are only possible because Markdown is the real source, which is the product thesis. Notion cannot offer them; BlockNote does not. This is where MME wins, not where it catches up.

### 9. Syntax reveal at the caret

- Typora (the canonical implementation): formatted text renders in place; **when the caret enters a formatted element, its Markdown syntax reappears for editing; when the caret leaves, it re-hides**. Inline styles render the moment you finish typing them; block syntax (`###`, `- [x]`) renders once the block is complete/Enter is pressed. No preview pane, no mode switcher in daily use.
- Obsidian Live Preview: same reveal rule — "when your cursor enters formatted content, the underlying syntax becomes visible for editing."
- MME today: rich mode hides Markdown entirely (Notion-style); Live Preview mode exists but is far from parity and currently offered as a dead-end third mode.
- Contract: **syntax reveal becomes the long-term identity of MME's default editing surface** — rich rendering with caret-local Markdown reveal. This absorbs the old "Live Preview parity" backlog item: not a third mode, but a property of the main surface (host-configurable: `reveal: always | never | caret`). Sequencing: land contracts 1-8 first; then this as its own flagship issue.

### 10. Wikilinks, autocomplete, and embeds

- Obsidian: typing `[[` opens note autocomplete; `![[` embeds; `[[note#heading]]` links headings. Links render in Live Preview, syntax revealed at caret.
- MME today: wikilinks are preserved (never corrupted) but there is no editing affordance — no autocomplete, no host hook to resolve link targets.
- Contract: a host-pluggable link-autocomplete contract (`[[` trigger → host supplies candidates), reusing the suggestion-menu machinery from the slash menu. The backlog's "link editing popover and docs-page link autocomplete" item is this contract.

### 11. Properties are a typed panel, not raw YAML (verified spec for MME-0090)

- Obsidian: properties render as a row-per-property panel at the top of the note; six value types (text, list, number, checkbox, date, datetime) with type-appropriate inputs; display modes **visible / hidden / source** (user setting); `Cmd/Ctrl+;` adds a property, `Cmd+Backspace` deletes the focused one, typing `---` at file start creates the block; storage stays plain YAML.
- MME-0090 already specifies the preservation-safe version of exactly this. This research adds the concrete interaction details above (type icons, display-mode setting, hotkeys) as the benchmark for its acceptance.

### 12. Command palette, universal hotkeys, folding and outline

- Obsidian: every command lives in a `Cmd+P` palette and can be given a hotkey; heading/list folding sits in a quiet gutter; an outline view mirrors the heading tree.
- MME today: a command palette exists in `md-surface` and folding shipped early — but neither is benchmarked; folding arrows currently overlap headings (contract 2), and the palette's coverage/latency is unaudited.
- Contract: palette lists every editor command with its shortcut; folding matches Obsidian's gutter quietness; outline stays a host-composable surface (already in `md-editor`).

## Completeness note

Andrew's reported complaints are explicitly **not exhaustive**, and neither is any single tour. The completeness mechanism is therefore not a longer complaint list but: (1) the behavioral parity checklist (every contract above verified in-browser per block), and (2) a dedicated **full-surface audit issue** — walk every surface of the demo against this report, log every deviation as a checklist row, before the UX blocks are declared done.

## Gap table — Andrew's reports + tour findings, mapped

| Symptom (Andrew / tour) | Contract | Covered by | Status |
| --- | --- | --- | --- |
| Opens in Source; 3-button mode row; LP useless | 1 | MME-0091 (extend: default rich, cycle toggle, hide LP) | extend |
| All block handles visible at once; misaligned | 2 | MME-0087 | covered |
| Fold arrow overlaps heading text | 2 | MME-0087 (add explicit criterion) | extend |
| Whole editor highlighted on caret placement | 3 | MME-0086 | covered |
| No block selection / Esc / Cmd+D model | 3 | **NEW issue needed** | new |
| Toolbar "ultra merdique", should not exist by default | 4 | MME-0091 + MME-0089 (extend: persistent toolbar off by default) | extend |
| Bubble toolbar weak (4 buttons, mispositioned) | 4 | MME-0089 | covered |
| Auto-pairing regressed; input rules incomplete | 5 | **NEW issue needed** | new |
| Code block: pinned LANGUAGE/META bar, ugly, unintuitive | 6 | MME-0086 (anchoring) + **NEW** (corner controls: copy + language picker) | extend/new |
| `/` triggers inside code | 6 | MME-0088 | covered |
| No callout insertion; no toggle blocks | 6 | **NEW issue needed** | new |
| No placeholders | 7 | MME-0087 | covered |
| No drag-and-drop | 7 | **NEW issue needed** | new |
| No motion anywhere | 7 | MME-0102 tokens + apply in C/D issues | covered |
| Header chips collide; diagnostics chip floats | 8 | MME-0091 | covered |

## Recommendation

1. Derive six new issues — block selection model; input rules + pairing; framed-block insertion + code-block corner UX; drag-and-drop; caret syntax reveal (contract 9, flagship, after contracts 1-8 land); wikilink autocomplete contract (contract 10) — plus a full-surface audit issue (completeness note), and extend MME-0087/0089/0090/0091 with the criteria marked "extend" above and the MME-0090 benchmark details from contract 11.
2. Add a **behavioral parity checklist** to the UX blocks' exit gate: a table of every interaction in this report, each marked `same as benchmark / better / intentionally different (reason)` — verified in the browser, not on paper. "No overlap, 44px targets" acceptance produced correctness; this checklist is what produces "natural".
3. Sequencing stays: MME-0102 (foundation) → C/D (now parity-driven) → the new issues join blocks C/D rather than trailing them.
4. BlockNote's repository (TypeCellOS/BlockNote, MIT core) is the standing implementation reference for contracts 2, 4, 6, 7 — builder agents should read its side-menu/formatting-toolbar/suggestion-menu package sources when implementing, imitating behavior and never copying code or styling.

## Sources

- BlockNote docs: formatting toolbar, suggestion menus, side menu, default blocks (blocknotejs.org/docs)
- BlockNote repository README — TypeCellOS/BlockNote (github.com)
- Notion keyboard shortcuts & markdown reference (notion.com/help/keyboard-shortcuts)
- Obsidian editing modes (obsidian.md/help/edit-and-read) and Properties (obsidian.md/help/properties)
- Typora live-preview model (typora.io; support.typora.io Quick Start; markdownguide.org/tools/typora)
- MME demo hands-on tours, 2026-07-30 and 2026-07-31 (this repository, build log entries)
