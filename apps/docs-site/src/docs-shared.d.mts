export interface PublicDocsMetadata {
  readonly description?: string;
  readonly llms?: "exclude" | "include";
  readonly navOrder?: number;
  readonly navSection?: string;
  readonly title?: string;
}

export interface PublicDocsPageLike {
  readonly metadata: PublicDocsMetadata;
  readonly path: string;
}

export function parsePublicDocsFrontmatter(source: string): {
  readonly body: string;
  readonly metadata: PublicDocsMetadata;
};
export function comparePublicDocsPages(a: PublicDocsPageLike, b: PublicDocsPageLike): number;
export function sectionFromPath(path: string): string;
export function titleFromPath(path: string): string;
export function sanitizeLlmsLineField(value: unknown, maxLength?: number): string;
export function assertSafePublicMarkdownPath(path: string): void;
export function validateAbsoluteUrl(url: string): string;
