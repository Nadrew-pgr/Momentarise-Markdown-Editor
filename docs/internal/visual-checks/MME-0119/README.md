# MME-0119 — Toolbar overlay anchoring

`npm run visual -- --only mme-0119`

| Artifact | What it proves |
| --- | --- |
| `more-menu-390-scroll-0.png`, `-50.png`, `-100.png` | The More menu fully inside a 390px viewport with the toolbar scrolled to the start, the middle and the end. The middle and end frames are the ones that matter: the defect displaced the menu by exactly the toolbar's `scrollLeft`, so a check at offset 0 passed against the broken build. |
| `more-menu-768-scroll-*.png` | The same sweep at tablet width. |
| `measurements.json` | Every measured rect with the `scrollLeft` it was taken at, the toolbar's scroll range, and the list of ancestors carrying a containing-block property — which must be empty. |

The gate additionally hit-tests every menu item with `document.elementFromPoint`. A rect inside the viewport says nothing about whether something is painted on top of it — review found the demo topbar (z-index 50) and the packaged debug inspector (z-index 65) covering three of eighteen commands at 390 while the geometric check passed. The overlay layer now carries `--mme-z-portal`.

The gate asserts, per offset: the menu renders inside `[data-mme-overlay-layer]`, no ancestor establishes a containing block for fixed positioning (`transform`, `filter`, `backdrop-filter`, `perspective`, `contain`, `will-change`), and the rect is inside the viewport on all four sides.

At 768 the toolbar does not scroll (`scrollRange: 0`), so those three samples are the same state: 768 proves structure and layering, not the sweep. At 390 the gate requires the toolbar to have actually scrolled across the sweep. Without that, every measurement would be the offset-0 case the defect survived, and the gate would pass while proving nothing.

The structural half of the contract — that overlays are portalled out of every containing block, and that the portalled node is cleaned up — runs on every push as `npm run test:overlay-containing-block`.
