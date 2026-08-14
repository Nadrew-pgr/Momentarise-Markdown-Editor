# MME-0090 — Frontmatter Properties panel

Gate: `npm run visual:mme-0090` (`scripts/visual-check-mme0090.mjs`), registered in
`scripts/visual-gates.mjs` in the `demo` group, so it runs on every `npm run visual`.

Dev server: `npm run dev -w @momentarise/md-demo -- --host 127.0.0.1 --port 5174`
(the `md-demo` entry in `.claude/launch.json`). URL: `http://127.0.0.1:5174/`.

Widths: 1280x900 and 390x844 (the 390 leg runs with `hasTouch`/`isMobile`, so the
coarse-pointer touch floor applies). Schemes: dark and light.

## What each artifact proves

| Artifact | Proves |
| --- | --- |
| `properties-{dark,light}-{1280,390}.png` | The panel paints above the document title, inside the note's own scroller, with one row per property, the six type glyphs, chips for the list, and the three read-only rows showing raw source plus an `Edit in Source` route. |
| `type-menu-{dark,light}-{1280,390}.png` | The clickable type icon opens a menu offering exactly the six benchmark types, and it fits inside the viewport at 390. |
| `properties-source-{dark,light}-{1280,390}.png` | The `source` display state shows the block's own bytes, and replaces the rows rather than sitting beside them. |
| `measurements.json` | Panel/heading geometry, the rendered row inventory, the bytes written by each interaction, and the created-block markdown, per width. |

## What the gate asserts (beyond the screenshots)

Every interaction is driven through real pointer and keyboard events and checked
in **bytes** — `getMarkdown()` before and after — so a control that renders and
writes the wrong Markdown fails here:

- the panel sits above the first block (`panel.bottom <= firstBlock.top`);
- the rendered rows match the fixture's ten properties, and the six editable
  scalar types render `text`, `number`, `checkbox`, `date`, `datetime-local`
  inputs (the list renders chips);
- read-only rows offer no input, show their raw value, and carry the reason;
- typing a new title changes only the `title:` line — every other line of the
  fixture survives verbatim, and the bytes below the block are identical;
- the type menu's `text` option turns `priority: 3` into `priority: "3"`, and
  nothing else moves;
- `Edit in Source` switches to Source mode with the offending property selected,
  and changes zero bytes;
- `Ctrl+;` adds a property before the closing delimiter, and `Ctrl+⌫` on the
  focused row deletes it — the document returns **byte-identical** to the fixture;
- the three display states switch without touching the file;
- typing `---` at the start of a document with no frontmatter creates exactly
  `---\ntitle: \n---\n\n` above the untouched body, the panel appears, and a body
  edit afterwards still writes byte-exactly (the stale-offset defect the rebase
  exists for, proven through the input-rule path and not only the API);
- the checkbox, the date input, both chip interactions, rename, the per-row
  delete, and a refused duplicate rename are all driven in the browser, and the
  refusal is asserted to appear **on its own row** with `aria-invalid`, not only
  in the page notice strip that is off-screen at 390;
- the panel renders in **Live Preview** as well as Rich, which the criteria name
  together;
- no control is painted over, clipped out of the viewport, or (at 390) below the
  44px touch floor;
- `pageerror` is empty for the whole run.

## Defects this gate found that jsdom did not

1. **Temporal dead zone on load.** `let propertiesSurface` was declared beside its
   own render function; `renderEditorMode()` runs during module evaluation and
   reaches `renderPropertiesSurface()`, so the whole demo threw
   `Cannot access 'propertiesSurface' before initialization` on first paint while
   every unit assertion stayed green. The declaration moved up with the other
   surface handles.
2. **The panel never came back after opening a file.** Opening a document
   destroys and recreates the session, and the panel tears itself down on the
   session's `destroy` event — but the handle was never cleared, so the next
   render called `setState` on a component whose root was already detached.
   Measured: the host was visible with zero children. It is now cleared in
   `mountReferenceSurfaceComponents()` with the other surfaces.
3. **The panel was unreachable at 390.** As a sibling of `.rich-editor-host` — the
   scroller — the panel was pinned chrome: with the ten-property fixture the last
   rows sat at `y=1552` in an 844px viewport and `elementFromPoint` returned
   nothing for `Edit in Source`. The panel now lives *inside* the scroller, above
   the ProseMirror element, so it scrolls with the note.
4. **Seventeen controls under the touch floor.** At 390 every key, value and chip
   input painted 28px tall, including a 16px checkbox. The packaged coarse-pointer
   floor now covers them.

## A claim in an earlier draft of this file that was wrong

An earlier version of this README said the 390 rows were "two lines, ~90px
apart" and called that the accessibility contract. The UX reviewer measured it
and it was neither: the delete button auto-placed onto a *third* grid row (a
fourth for read-only properties), so a property occupied ~150px and the note's
title was pushed to y=1877. Roughly 50-60px per property was auto-placement
overflow, not the touch floor. The button is now pinned to the first grid row,
and the header stacks instead of centring its label between two wrapped control
rows. Recorded because a build-log/README claim written from reasoning rather
than measurement is the defect class `AGENT.md` names under "Verify build-log
claims against the repository".

## Known occlusion, owned by MME-0091

At 390 the demo's floating `TECHNICAL DIAGNOSTICS` chip is `position: fixed` in
the bottom-right corner and paints over whichever panel row sits under it — a
`property-remove` button in this run, which a writer could not then tap. That
chip is demo chrome, and MME-0091 ("Diagnostics chip moves into the status
popover; it never overlaps document content") owns removing it. The gate names
that one painter explicitly and records it in `measurements.json`; anything else
that ever paints over this panel still fails.

## Environment limit worth knowing

Headless Chrome does not render `<input type="date">` as a segmented picker
here, so the browser date leg asserts the panel's own contract — the committed
value reaches that property's bytes and nothing else moves — rather than pinning
a typed string to an ISO result, which would measure the browser instead of this
code. The value-to-YAML mapping is pinned in the unit suite.
