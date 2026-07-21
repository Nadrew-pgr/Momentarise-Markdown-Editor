# Inline HTML footnote editing

Before uses top HTML[^inline-top], detail HTML[^inline-multi], list HTML[^inline-list], task HTML[^inline-task], quoted HTML[^inline-quote], callout HTML[^inline-callout], and hostile HTML[^inline-hostile].

Neighbor <x-unknown keep="exact">syntax</x-unknown> stays byte-exact.

[^inline-top]: Top source uses <kbd data-key="cmd">Edit key token</kbd> after.

[^inline-multi]: First paragraph stays byte-exact.

    Second paragraph keeps <!-- Edit comment token --> after.

[^inline-list]: Ordered inline source starts here.

    3. Item <span data-state='draft'>Edit list inline</span>.
    4. Keep ordered sibling.

[^inline-task]: Task inline source starts here.

    - [ ] Task <x-status data-state="pending">Edit task inline</x-status>.
    - [x] Keep completed sibling.

[^inline-quote]: Quote inline source starts here.

    > Quote <mark>Edit quote inline</mark>.

[^inline-callout]: Callout inline source starts here.

    > [!NOTE] Inline source
    > Callout <i>Edit callout inline</i>.

[^inline-hostile]: Hostile source stays literal <script>globalThis.__MME_INLINE_HTML_RAN__ = true</script> and <img src="javascript:alert(1)" onerror="globalThis.__MME_INLINE_HTML_RAN__ = true" style="display:none">.

[^wrapped-strong]: **Wrapped <kbd>Edit strong-wrapped inline</kbd> source stays source-only.**

[^wrapped-emphasis]: *Wrapped <kbd>Edit emphasis-wrapped inline</kbd> source stays source-only.*

[^wrapped-strike]: ~~Wrapped <kbd>Edit strike-wrapped inline</kbd> source stays source-only.~~

[^wrapped-link]: [Linked <kbd>Edit link-wrapped inline</kbd> source](./target.md) stays source-only.

[^multiline-html]: Multiline inline HTML stays source-only.

    Before <!-- Edit multiline
    comment token --> after.

[^table-html]: Table-cell inline HTML stays source-only.

    | Key | Value |
    | --- | --- |
    | unsafe | <kbd>Edit table inline</kbd> |

[^block-compatible]: Existing block HTML remains semantic.

    <section data-kind="block">Edit compatible block HTML.</section>

[^duplicate]: First duplicate <kbd>Edit first duplicate inline</kbd> stays source-only.

[^duplicate]: Second duplicate <kbd>Edit second duplicate inline</kbd> stays source-only.

> [^nested-container]: Container definition stays source-only.
>
>     Nested <kbd>Edit nested-container inline</kbd> source.

Final paragraph stays byte-exact.
