# List-block footnote editing

Before uses steps[^steps] and ordered guidance[^ordered].

Neighbor <x-unknown keep="exact">syntax</x-unknown> stays byte-exact.

[^steps]: Follow these steps.

    - Keep **bold source**
    - Edit this list item
    - Preserve `inline code`

    Closing paragraph stays byte-exact.

[^ordered]: Ordered instructions begin.

    3. Third-numbered item
    4. Fourth-numbered item

[^nested-list]: Nested list stays source-only.

    - Parent item
        - Child item stays source-only

[^task-list]: Tasks stay source-only.

    - [ ] Unchecked task
    - [x] Checked task

[^loose-item]: Loose item stays source-only.

    - First item paragraph

      Second paragraph in the same item

[^quoted]: Quote stays source-only.

    > Quoted definition block.

[^unsafe-list]: Unsafe list stays source-only.

    - Raw <span onclick="boom()">HTML</span>

> [^nested-container]: Container stays source-only.

Final paragraph stays byte-exact.
