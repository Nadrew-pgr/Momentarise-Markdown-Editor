# Code Fence Fixture

```ts
type SaveTarget = "disk" | "memory" | "download";

export function labelTarget(target: SaveTarget): string {
  return `target:${target}`;
}
```

The language info string is important for rendering and editing.
