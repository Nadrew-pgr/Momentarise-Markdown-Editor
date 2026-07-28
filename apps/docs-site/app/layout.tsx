import "@momentarise/md-theme/tokens.css";
import "../src/styles.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SITE_DESCRIPTION, SITE_NAME, SITE_ORIGIN } from "../src/site-metadata";

export const metadata: Metadata = {
  applicationName: SITE_NAME,
  description: SITE_DESCRIPTION,
  keywords: [
    "Markdown editor framework",
    "Markdown rich text editor",
    "Markdown source preservation",
    "TypeScript editor",
    "headless Markdown editor"
  ],
  metadataBase: new URL(SITE_ORIGIN),
  openGraph: {
    description: SITE_DESCRIPTION,
    siteName: SITE_NAME,
    title: SITE_NAME,
    type: "website",
    url: SITE_ORIGIN
  },
  robots: {
    follow: true,
    index: true
  },
  title: {
    default: `${SITE_NAME} Docs`,
    template: `%s | ${SITE_NAME}`
  }
};

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html data-mme-scheme="light" lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
