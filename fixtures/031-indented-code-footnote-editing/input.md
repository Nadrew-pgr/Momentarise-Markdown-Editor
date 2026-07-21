# Indented-code footnote editing

Before uses top-level code[^indent-top], ordered code[^indent-list], task code[^indent-task], and an existing fence[^fenced-existing].

Neighbor <x-unknown keep="exact">syntax</x-unknown> stays byte-exact.

[^indent-top]: Top-level indented code starts here.

        const keep = "exact";
        const editTop = true;
            const nestedIndent = true;

        const afterBlank = true;

    Closing top-level paragraph stays byte-exact.

[^indent-list]: Ordered indented code starts here.

    3. Ordered item before code.

           const editList = 1;
           const keepList = 2;

    4. Keep ordered sibling.

[^indent-task]: Checklist indented code starts here.

    - [ ] Task item before code.

          echo "edit task"
          <script>window.__MME_INDENTED_CODE_RAN__ = true;</script>

    - [x] Keep completed task sibling.

[^fenced-existing]: Existing fenced code remains supported.

    ```js
    const fenced = true;
    ```

[^quote-code]: Quote-contained code stays source-only.

    > Quote before indented code.
    >
    >     const quoted = true;

[^mixed-containers]: Indented code plus nested list stays source-only.

    - Item before two containers.

          const firstContainer = true;

      - Second container rejects the whole definition.

[^table-child]: Table child stays source-only.

    | Column | Value |
    | --- | --- |
    | Alpha | 1 |

[^callout-child]: Callout child stays source-only.

    > [!NOTE] Preserve callout
    > Preserve callout body.

[^raw-child]: Unsafe raw HTML stays source-only.

    <section onclick="boom()">Preserve raw source.</section>

> [^nested-container]: Container definition stays source-only.
>
>         const nestedContainer = true;

Final paragraph stays byte-exact.
