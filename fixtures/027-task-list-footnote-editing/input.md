# Task-list footnote editing

Before uses flat tasks[^task-flat], mixed tasks[^task-nested], and ordered tasks[^task-ordered].

Neighbor <x-unknown keep="exact">syntax</x-unknown> stays byte-exact.

[^task-flat]: Release checklist starts here.

    - [x] Keep completed task
    - [ ] Edit unchecked task

    Closing flat paragraph stays byte-exact.

[^task-nested]: Mixed hierarchy starts here.

    - Standard parent
      - [ ] Edit deepest task
        - Standard grandchild
      - [x] Keep checked nested sibling
    - [x] Keep checked outer task

[^task-ordered]: Ordered tasks start at three.

    3. [x] Keep ordered checked task
    4. [ ] Edit ordered unchecked task

[^loose-task]: Loose task stays source-only.

    - [ ] First task paragraph

      Second paragraph in the same task item

[^multiple-task]: Multiple nested children stay source-only.

    - [ ] Parent task
      - [ ] Nested task child
      1. Standard ordered child

[^quoted-task]: Nested quote stays source-only.

    - [ ] Parent before quote
      > Nested quote block

[^unsafe-task]: Unsafe task stays source-only.

    - [ ] Raw <span onclick="boom()">HTML</span>

> [^nested-container]: Container task definition stays source-only.
>
>     - [ ] Nested container task

Final paragraph stays byte-exact.
