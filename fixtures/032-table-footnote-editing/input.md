# Table footnote editing

Before uses a top-level table[^table-top], ordered table[^table-list], task table[^table-task], wide table[^table-wide], and existing fence[^fenced-existing].

Neighbor <x-unknown keep="exact">syntax</x-unknown> stays byte-exact.

[^table-top]: Top-level table starts here.

    | Setting | Value |
    | :--- | ---: |
    | edit top | draft |
    | escaped \| pipe | **bold stays** |

    Closing top-level paragraph stays byte-exact.

[^table-list]: Ordered table starts here.

    3. Ordered item before table.

       | Key | State |
       | :--- | :---: |
       | edit list | ready |
       | keep list | exact |

       Ordered item after table stays exact.

    4. Keep ordered sibling.

[^table-task]: Checklist table starts here.

    - [ ] Task item before table.

      | Action | Status |
      | --- | ---: |
      | edit task | pending |
      | keep task | exact |

      Task item after table stays exact.

    - [x] Keep completed task sibling.

[^table-wide]: Wide table proves horizontal reachability.

    | Alpha | Bravo | Charlie | Delta | Echo | Foxtrot | Golf | Hotel |
    | --- | --- | --- | --- | --- | --- | --- | --- |
    | one | two | three | four | five | six | seven | eight |

[^fenced-existing]: Existing fenced code remains supported.

    ```js
    const fenced = true;
    ```

[^quote-table]: Quote-contained table stays source-only.

    > Quote before table.
    >
    > | Column | Value |
    > | --- | --- |
    > | quote | exact |

[^mixed-containers]: Table plus nested list stays source-only.

    - Item before two containers.

      | Column | Value |
      | --- | --- |
      | first container | exact |

      - Second container rejects the whole definition.

[^unsafe-cell]: Unsafe table cell stays source-only.

    | Column | Value |
    | --- | --- |
    | unsafe | <script>window.__MME_TABLE_FOOTNOTE_RAN__ = true;</script> |

[^callout-child]: Callout child stays source-only.

    > [!NOTE] Preserve callout
    > Preserve callout body.

[^raw-child]: Unsafe raw HTML stays source-only.

    <section onclick="boom()">Preserve raw source.</section>

> [^nested-container]: Container definition stays source-only.
>
>     | Column | Value |
>     | --- | --- |
>     | nested | exact |

Final paragraph stays byte-exact.
