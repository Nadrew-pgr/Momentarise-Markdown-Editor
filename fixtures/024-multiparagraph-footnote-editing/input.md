# Multi-paragraph footnote editing

Before uses a detailed note[^detail] twice[^detail].

Neighbor <x-unknown keep="exact">syntax</x-unknown> stays byte-exact.

[^detail]: First **paragraph** keeps `inline code`.

    Second paragraph has a [relative link](./target.md).
    Its continuation line stays indented.

    Third paragraph stays byte-exact.

[^nested-block]: Nested content stays source-only.

    - list item stays source-only
    - second item stays source-only

> [^nested-container]: Container definition stays source-only.

[^unsafe]: Inline-HTML paragraph starts here.

    Raw HTML <span onclick="boom()">stays inert and editable</span>.

Final paragraph stays byte-exact.
