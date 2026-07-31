import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  description: "Momentarise Markdown Editor mounted from the published npm alpha packages.",
  title: "MME Next.js App Router Example"
};

export default function RootLayout(props: { readonly children: ReactNode }) {
  return (
    <html lang="en">
      <body>{props.children}</body>
    </html>
  );
}
