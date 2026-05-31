# MME-0014 Visual Checks

Artifacts in this folder prove hierarchical rich-mode folding and the toggle-block distinction:

- `folding-h1-h6-loaded.png` shows the nested H1-H6 demo document loaded in Rich mode with heading fold affordances.
- `folding-hover-affordance.png` shows the fold control as a subtle left-margin hover affordance instead of a persistent toolbar/debug strip.
- `folding-h3-collapsed.png` shows an H3 fold hiding H4/H5/H6 descendants while sibling/higher headings remain visible.
- `folding-nested-parent-collapsed.png` shows an H2 parent fold hiding an already-folded child heading and its descendants.
- `folding-nested-child-still-collapsed.png` shows that reopening the H2 parent preserves the child H3 fold state.
- `folding-h1-collapsed.png` shows an H1 fold hiding all descendant sections until the next H1.
- `toggle-block-explicit-details.png` shows that `<details><summary>...</summary></details>` appears only after an explicit toggle-block command, not after heading folding.

Sidecar/session location: the demo stores fold state in runtime `foldStates: readonly FoldState[]`, using `@momentarise/md-core`'s `FoldState` contract. The rich package receives fold state as input and returns visibility/decorations data; it does not serialize folds into Markdown. Host adapters should persist or restore this under `SidecarState.folds` when they support session sidecars.
