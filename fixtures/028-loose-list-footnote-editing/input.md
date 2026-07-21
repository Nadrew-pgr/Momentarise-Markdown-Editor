# Loose-list footnote editing

Before uses loose bullets[^loose-bullets], loose tasks[^loose-task], and loose ordered nesting[^loose-ordered].

Neighbor <x-unknown keep="exact">syntax</x-unknown> stays byte-exact.

[^loose-bullets]: Loose bullet guidance starts here.

    - First item paragraph stays.

      Edit second paragraph in first item.

    - Keep sibling first paragraph.

      Keep sibling second paragraph.

    Closing bullet paragraph stays byte-exact.

[^loose-task]: Loose checklist starts here.

    - [ ] Task first paragraph.

      Edit task second paragraph.

    - [x] Keep completed sibling.

      Keep completed sibling detail.

[^loose-ordered]: Ordered hierarchy starts at three.

    3. Parent first paragraph.

       Edit parent second paragraph.

       7. Edit nested seventh item.
       8. Keep nested eighth item.

    4. Keep outer fourth item.

[^multiple-nested]: Multiple nested lists stay source-only.

    - Parent with two nested children.
      - Nested bullet child.
      1. Nested ordered child.

[^quoted-child]: Quoted child stays source-only.

    - Parent before quote.

      > Nested quote block.

[^code-child]: Code child stays source-only.

    - Parent before code.

          const unsafe = true;

[^raw-child]: Raw child is editable inert source.

    - Parent before raw HTML.

      <section data-raw="true">Preserve me.</section>

[^table-child]: Table child stays source-only.

    - Parent before table.

      | Column | Value |
      | --- | --- |
      | Alpha | 1 |

[^callout-child]: Callout child stays source-only.

    - Parent before callout.

      > [!NOTE]
      > Preserve callout source.

> [^nested-container]: Container definition stays source-only.
>
>     - Nested container item.

Final paragraph stays byte-exact.
