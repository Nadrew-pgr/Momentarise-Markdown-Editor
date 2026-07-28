import type { MetadataRoute } from "next";
import { allDocsPages, hrefForPage } from "../src/docs-data";
import { absoluteSiteUrl } from "../src/site-metadata";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      changeFrequency: "weekly",
      priority: 1,
      url: absoluteSiteUrl("/")
    },
    ...allDocsPages().map((page) => ({
      changeFrequency: "weekly" as const,
      priority: page.route ? 0.7 : 0.9,
      url: absoluteSiteUrl(hrefForPage(page))
    }))
  ];
}
