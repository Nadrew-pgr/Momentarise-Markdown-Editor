import type { Metadata } from "next";
import { getDefaultPage, hrefForPage } from "../../src/docs-data";
import { DocsPageView } from "../../src/DocsPageView";

export function generateMetadata(): Metadata {
  const page = getDefaultPage();
  return {
    alternates: {
      canonical: hrefForPage(page)
    },
    description: page.description,
    openGraph: {
      description: page.description,
      title: page.title,
      type: "article",
      url: hrefForPage(page)
    },
    title: page.title
  };
}

export default function DocsHomePage() {
  return <DocsPageView page={getDefaultPage()} />;
}
