export const SITE_ORIGIN = "https://momentarise.dev";
export const DOCS_ORIGIN = `${SITE_ORIGIN}/docs`;
export const REPOSITORY_URL = "https://github.com/Nadrew-pgr/Momentarise-Markdown-Editor";
export const FRAMEWORK_LICENSE_URL = "https://www.mozilla.org/MPL/2.0/";
export const SITE_NAME = "Momentarise Markdown Editor";
export const SITE_DESCRIPTION = "Markdown-native framework for portable, preservation-first document editors.";

export function absoluteSiteUrl(path: string): string {
  return new URL(path, `${SITE_ORIGIN}/`).toString();
}
