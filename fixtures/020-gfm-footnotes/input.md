# Footnotes and endnotes

Intro paragraph with a first note[^first], a repeated note[^first], and a missing note[^missing].

The next paragraph stays editable while footnotes remain anchored below.

[^first]: First footnote definition with **bold text**, `inline code`, and a [relative link](./target.md).
    Continued definition line that must keep its indentation.

[^second]: Second definition with unsafe HTML <a href="javascript:alert(1)" onclick="boom()">unsafe label</a> and safe text.

[^first]: Duplicate definition should stay visible as preserved source.

[^malformed] Missing colon should stay preserved as unusual syntax.

Final paragraph after footnotes.
