# Fenced-code footnote editing

Before uses top-level code[^code-top], ordered code[^code-list], and task code[^code-task].

Neighbor <x-unknown keep="exact">syntax</x-unknown> stays byte-exact.

[^code-top]: Top-level code starts here.

    ````ts title="demo"
    const keep = "exact";
    ```inner
    const editTop = true;
    ````

    Closing top-level paragraph stays byte-exact.

[^code-list]: Ordered code starts here.

    3. Ordered item before code.

       ```js title="list"
       const editList = 1;
       ```

    4. Keep ordered sibling.

[^code-task]: Checklist code starts here.

    - [ ] Task item before code.

      ~~~bash title=`task`
      echo "edit task"
      <script>window.__MME_CODE_RAN__ = true;</script>
      ~~~

    - [x] Keep completed task sibling.

[^indented-code]: Indented code stays source-only.

        const indented = true;

[^quote-code]: Quote-contained code stays source-only.

    > Quote before fenced code.
    >
    > ```js
    > const quoted = true;
    > ```

[^mixed-containers]: Code plus nested list stays source-only.

    - Item before two containers.

      ```js
      const firstContainer = true;
      ```

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
>     ```js
>     const nestedContainer = true;
>     ```

Final paragraph stays byte-exact.
