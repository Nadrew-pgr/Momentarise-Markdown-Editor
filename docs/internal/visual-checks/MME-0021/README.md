# MME-0021 visual checks

- `list-todo-rich-loaded.png`: rich mode loaded with sibling bullet/todo and ordered items.
- `list-todo-keyboard-checked.png`: focusing the todo checkbox and pressing Space toggles it checked.
- `list-todo-after-tab.png`: `Tab` nests the todo item under the previous list item.
- `list-todo-after-shift-tab.png`: `Shift+Tab` outdents the nested todo item back to a sibling.
- `list-enter-caret-before-heading.png`: after `Enter` before a following heading, typed text lands in the new bullet item rather than the heading.
- `list-nested-empty-exit.png`: an empty nested bullet exits to the parent list level and preserves the nested sibling content.
- `list-parent-empty-backspace.png`: `Backspace` on an empty parent-level item after a nested list removes the empty item and leaves the caret at the nested child.
- `list-deep-grandchild-delete.png`: deleting the only grandchild bullet removes the child list without leaving an empty paragraph in the parent child item.
