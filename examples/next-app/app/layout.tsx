import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  description: "Momentarise Markdown Editor mounted from the published npm alpha packages.",
  title: "MME Next.js App Router Example"
};

export default function RootLayout(props: { readonly children: ReactNode }) {
  return (
    // data-mme-scheme pins the editor to dark (matching the reference demo).
    // Omit it to follow the visitor's prefers-color-scheme instead.
    <html lang="en" data-mme-scheme="dark">
      <body>{props.children}</body>
    </html>
  );
}
