# Blockquote footnote editing

Before uses quoted guidance[^quote-top], an ordered quote[^quote-list], and a task quote[^quote-task].

Neighbor <x-unknown keep="exact">syntax</x-unknown> stays byte-exact.

[^quote-top]: Top-level guidance starts here.

    > First quoted paragraph keeps **bold source**.
    >
    > Edit second quoted paragraph.

    Closing top-level paragraph stays byte-exact.

[^quote-list]: Ordered guidance starts here.

    3. Ordered item first paragraph.

       > First ordered-item quote.
       >
       > Edit ordered-item second quote.

    4. Keep ordered sibling.

[^quote-task]: Checklist guidance starts here.

    - [ ] Task item first paragraph.

      > Edit task-item first quote.
      >
      > Keep task-item second quote.

    - [x] Keep completed task sibling.

[^nested-quote]: Nested quote stays source-only.

    > Outer quote paragraph.
    >
    > > Nested quote paragraph.

[^callout]: Callout stays source-only.

    > [!NOTE] Preserve callout title
    > Preserve callout body.

[^quote-list-child]: Quote containing a list stays source-only.

    > Quote paragraph.
    >
    > - Nested quote list item.

[^quote-code-child]: Quote containing code stays source-only.

    > Quote paragraph before code.
    >
    >     const preserve = true;

[^quote-table-child]: Quote containing a table stays source-only.

    > Quote paragraph before table.
    >
    > | Column | Value |
    > | --- | --- |
    > | Alpha | 1 |

[^quote-raw-child]: Quote containing raw HTML stays source-only.

    > Quote paragraph before raw HTML.
    >
    > <section data-raw="true">Preserve me.</section>

[^mixed-containers]: Quote plus nested list stays source-only.

    - Item before two containers.

      > Safe quote alone would be representable.

      - Second container must reject the whole definition.

> [^nested-container]: Container definition stays source-only.
>
>     > Nested container quote.

Final paragraph stays byte-exact.
