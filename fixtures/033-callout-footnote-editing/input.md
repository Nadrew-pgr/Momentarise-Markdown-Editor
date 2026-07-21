# Callout footnote editing

Before uses a top callout[^callout-top], ordered callout[^callout-list], and task callout[^callout-task].

Neighbor <x-unknown keep="exact">syntax</x-unknown> stays byte-exact.

[^callout-top]: Top-level guidance starts here.

    > [!NOTE] Release note
    > Edit top callout body.
    >
    > Keep top callout **detail**.

    Closing top-level paragraph stays byte-exact.

[^callout-list]: Ordered guidance starts here.

    3. Ordered item before callout.

       > [!WARNING]- Release warning
       > Edit list callout body.
       >
       > Keep list callout detail.

    4. Keep ordered sibling.

[^callout-task]: Checklist guidance starts here.

    - [ ] Task item before callout.

      > [!TIP]+ Release tip
      > Edit task callout body.

    - [x] Keep completed task sibling.

[^quote-existing]: Existing plain quote remains semantic.

    > Keep existing plain quote.

[^marker-only]: Callout without a body stays source-only.

    > [!NOTE] Marker only

[^malformed-type]: Malformed type stays source-only.

    > [!bad type] Invalid type
    > Preserve malformed type body.

[^malformed-fold]: Malformed fold marker stays source-only.

    > [!NOTE]? Invalid fold
    > Preserve malformed fold body.

[^nested-callout]: Nested callout stays source-only.

    > [!NOTE] Outer callout
    > Preserve outer body.
    >
    > > [!TIP] Nested callout
    > > Preserve nested body.

[^list-body]: Callout containing a list stays source-only.

    > [!NOTE] List body
    > Preserve paragraph before list.
    >
    > - Preserve nested list item.

[^unsafe-body]: Unsafe body stays source-only.

    > [!CAUTION] Unsafe body
    > Raw <span onclick="boom()">HTML</span> stays inert.

[^mixed-containers]: Callout plus nested list stays source-only.

    - Item before two containers.

      > [!NOTE] First container
      > Preserve first container body.

      - Second container rejects the whole definition.

[^duplicate]: First duplicate callout stays source-only.

    > [!NOTE] First duplicate
    > Preserve first duplicate body.

[^duplicate]: Second duplicate callout stays source-only.

    > [!NOTE] Second duplicate
    > Preserve second duplicate body.

> [^nested-container]: Container definition stays source-only.
>
>     > [!NOTE] Nested container callout
>     > Preserve nested container body.

Final paragraph stays byte-exact.
