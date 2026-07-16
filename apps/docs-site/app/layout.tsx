import "@momentarise/md-theme/tokens.css";
import "../src/styles.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  description: "Markdown-native framework for portable, preservation-first document editors.",
  title: {
    default: "Momentarise Markdown Editor Docs",
    template: "%s | Momentarise Markdown Editor"
  }
};

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html data-mme-scheme="light" lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
