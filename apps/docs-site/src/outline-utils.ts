export interface SerializableSourceRange {
  readonly start: {
    readonly offset: number;
  };
}

export interface SerializableOutlineItem {
  readonly children: readonly SerializableOutlineItem[];
  readonly depth: number;
  readonly slug: string;
  readonly sourceRange: SerializableSourceRange;
  readonly text: string;
}

export function flattenOutline(outline: readonly SerializableOutlineItem[]): readonly SerializableOutlineItem[] {
  const items: SerializableOutlineItem[] = [];
  for (const item of outline) {
    items.push(item, ...flattenOutline(item.children));
  }
  return items;
}

export function sectionMarkdownForSlug(
  source: string,
  outline: readonly SerializableOutlineItem[],
  sectionSlug: string | undefined
): string {
  const headings = [...flattenOutline(outline)].sort(
    (a, b) => a.sourceRange.start.offset - b.sourceRange.start.offset
  );
  const selected = headings.find((heading) => heading.slug === sectionSlug) ?? headings[0];
  if (!selected) {
    return source;
  }
  const nextPeerOrAncestor = headings.find(
    (heading) =>
      heading.sourceRange.start.offset > selected.sourceRange.start.offset && heading.depth <= selected.depth
  );
  const endOffset = nextPeerOrAncestor?.sourceRange.start.offset ?? source.length;
  const section = source.slice(selected.sourceRange.start.offset, endOffset).trimEnd();
  return `${section}\n`;
}
