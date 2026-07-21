# Multiline footnote editing

Before uses a long note[^long] twice[^long].

Neighbor <x-unknown keep="exact">syntax</x-unknown> stays byte-exact.

[^long]: First **definition** line stays.
    Second definition line has `inline code`.
    Third definition line has a [relative link](./target.md).

[^multi]: First paragraph stays source-only.

    Second paragraph stays source-only.

> [^nested]: Nested definition stays source-only.

[^unsafe]: Inline-HTML continuation starts here.
    Raw HTML <span onclick="boom()">stays inert and editable</span>.

Final paragraph stays byte-exact.
