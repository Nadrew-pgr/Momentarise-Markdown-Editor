# Nested-list footnote editing

Before uses nested bullets[^nested-bullets] and nested ordered steps[^nested-ordered].

Neighbor <x-unknown keep="exact">syntax</x-unknown> stays byte-exact.

[^nested-bullets]: Bullet hierarchy starts here.

    - Parent bullet
      - Child bullet
        - Edit deepest bullet
        - Keep deep bullet sibling
      - Keep child bullet sibling
    - Keep outer bullet sibling

    Closing bullet paragraph stays byte-exact.

[^nested-ordered]: Ordered hierarchy starts here.

    3. Outer third
       1. Child first
          1. Edit deepest ordered item
          2. Keep deep ordered sibling
       2. Keep child ordered sibling
    4. Keep outer fourth

[^task-nested]: Nested tasks stay source-only.

    - Parent task group
      - [ ] Unchecked nested task

[^loose-nested]: Loose nested ordered start stays source-only.

    3. Parent ordered item

       7. Loose child seventh
       8. Loose child eighth

[^multiple-nested]: Multiple nested children stay source-only.

    - Parent with two nested children
      - Nested bullet child
      1. Nested ordered child

[^quoted-nested]: Nested quote stays source-only.

    - Parent before quote
      > Nested quote block

[^unsafe-nested]: Nested inline HTML stays inert and editable.

    - Parent before unsafe child
      - Raw <span onclick="boom()">HTML</span>

> [^nested-container]: Container definition stays source-only.

Final paragraph stays byte-exact.
