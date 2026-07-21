# Rich footnote editing

Intro uses one simple note[^simple] twice[^simple] and keeps a complex note[^complex].

Neighbor paragraph stays byte-exact.

[^simple]: Simple **definition** with `inline code` and a [relative link](./target.md).

[^complex]: Complex definition starts here.
    Continued definition line stays source-only.

[^multi]: First definition paragraph stays source-only.

    Second definition paragraph stays source-only.

[^unsafe]: Inline HTML stays inert and editable <span onclick="boom()">label</span>.

[^duplicate]: First duplicate definition stays source-only.

[^duplicate]: Second duplicate definition stays source-only.

[^malformed] Missing colon stays source-only.

Final paragraph stays byte-exact.
