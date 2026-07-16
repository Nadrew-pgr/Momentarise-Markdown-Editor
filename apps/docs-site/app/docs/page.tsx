import type { Metadata } from "next";
import { getDefaultPage } from "../../src/docs-data";
import { DocsPageView } from "../../src/DocsPageView";

export function generateMetadata(): Metadata {
  const page = getDefaultPage();
  return {
    description: page.description,
    title: page.title
  };
}

export default function DocsHomePage() {
  return <DocsPageView page={getDefaultPage()} />;
}
