import type { MetadataRoute } from "next";
import { SITE_ORIGIN, absoluteSiteUrl } from "../src/site-metadata";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    host: SITE_ORIGIN,
    rules: {
      allow: "/",
      userAgent: "*"
    },
    sitemap: absoluteSiteUrl("/sitemap.xml")
  };
}
