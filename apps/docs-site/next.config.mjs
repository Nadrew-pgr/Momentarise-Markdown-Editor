/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  poweredByHeader: false,
  transpilePackages: [
    "@momentarise/md-editor",
    "@momentarise/md-render-html",
    "@momentarise/md-save",
    "@momentarise/md-source-codemirror",
    "@momentarise/md-theme"
  ]
};

export default nextConfig;
