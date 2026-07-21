# Raw HTML footnote editing

Before uses top HTML[^html-top], ordered HTML[^html-list], and task HTML[^html-task].

Neighbor <x-unknown keep="exact">syntax</x-unknown> stays byte-exact.

[^html-top]: Top-level HTML starts here.

    <aside data-kind="note">
      <!-- keep exact comment -->
      <p>Edit top HTML source.</p>
    </aside>

    Closing top-level paragraph stays byte-exact.

[^html-list]: Ordered HTML starts here.

    3. Ordered item before HTML.

       <section data-state='draft'>
         <p>Edit list HTML source.</p>
       </section>

       Ordered item after HTML stays exact.

    4. Keep ordered sibling.

[^html-task]: Task HTML starts here.

    - [ ] Task item before HTML.

      <div onclick="globalThis.__MME_HTML_RAN__ = true">
        <script>globalThis.__MME_HTML_RAN__ = true</script>
        <x-status data-edit="task">Edit task HTML source.</x-status>
      </div>

      Task item after HTML stays exact.

    - [x] Keep completed task sibling.

[^inline-html]: Inline HTML stays inert and editable.

    Preserve <kbd>Edit inline HTML</kbd> inside a paragraph.

[^paragraph-html]: Single-line HTML element stays inert and editable.

    <button onclick="globalThis.__MME_HTML_RAN__ = true">Edit button HTML</button>

[^malformed-html]: Malformed block HTML stays source-only.

    <main>
      <p>Edit malformed HTML.

[^quote-html]: Quote-contained HTML stays source-only.

    > Quote before raw HTML.
    >
    > <section>Edit quote HTML.</section>

[^mixed-containers]: Raw HTML plus nested list stays source-only.

    - Item before two containers.

      <section>Edit mixed HTML.</section>

      - Second container rejects the whole definition.

[^multiple-html]: Multiple raw HTML containers stay source-only.

    - Item before two HTML containers.

      <section>Edit first HTML container.</section>

      <aside>Edit second HTML container.</aside>

[^duplicate]: First duplicate HTML stays source-only.

    <section>Edit first duplicate HTML.</section>

[^duplicate]: Second duplicate HTML stays source-only.

    <section>Edit second duplicate HTML.</section>

> [^nested-container]: Container definition stays source-only.
>
>     <section>Edit nested-container HTML.</section>

Final paragraph stays byte-exact.
