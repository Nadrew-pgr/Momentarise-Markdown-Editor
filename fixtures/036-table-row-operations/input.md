# Table row operations

Before root table stays byte-exact.

| Name | Status |
| :--- | ---: |
| alpha | draft |
| beta | **ready** |

Between root and footnotes stays byte-exact[^direct][^ordered][^task][^wide].

Neighbor <x-unknown keep="exact">syntax</x-unknown> stays byte-exact.

[^direct]: Direct table starts here.

    | Item | Value |
    | :--- | ---: |
    | direct one | exact |
    | direct two | **marked** |

    Direct closing paragraph stays exact.

[^ordered]: Ordered table starts here.

    3. Ordered item before table.

       | Key | State |
       | :--- | :---: |
       | ordered one | ready |
       | ordered two | exact |

       Ordered item after table stays exact.

    4. Ordered sibling stays exact.

[^task]: Task table starts here.

    - [ ] Task item before table.

      | Action | Status |
      | --- | ---: |
      | task one | pending |
      | task two | exact |

      Task item after table stays exact.

    - [x] Completed sibling stays exact.

[^wide]: Wide table proves horizontal reachability.

    | Alpha | Bravo | Charlie | Delta | Echo | Foxtrot | Golf | Hotel |
    | --- | --- | --- | --- | --- | --- | --- | --- |
    | one | two | three | four | five | six | seven | eight |

[^quote-table]: Quote-contained table stays source-only.

    > | Column | Value |
    > | --- | --- |
    > | quote | exact |

[^malformed-table]: Malformed table stays source-only.

    | broken | table-like |
    | missing delimiter |

Final paragraph stays byte-exact.
