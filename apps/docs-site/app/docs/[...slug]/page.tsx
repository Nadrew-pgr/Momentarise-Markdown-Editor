import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { allDocsPages, getPageByRouteSegments } from "../../../src/docs-data";
import { DocsPageView } from "../../../src/DocsPageView";

interface PageProps {
  readonly params: Promise<{
    readonly slug: readonly string[];
  }>;
}

export function generateStaticParams() {
  return allDocsPages()
    .filter((page) => page.routeSegments.length > 0)
    .map((page) => ({
      slug: page.routeSegments
    }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const page = getPageByRouteSegments(resolvedParams.slug);
  if (!page) {
    return {};
  }
  return {
    description: page.description,
    title: page.title
  };
}

export default async function DocsPage({ params }: PageProps) {
  const resolvedParams = await params;
  const page = getPageByRouteSegments(resolvedParams.slug);
  if (!page) {
    notFound();
  }
  return <DocsPageView page={page} />;
}
