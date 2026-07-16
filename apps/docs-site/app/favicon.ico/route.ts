export const dynamic = "force-static";

const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#f8fafc"/><path d="M7 23V9l9 5.4L25 9v14l-9-5.4L7 23Z" fill="none" stroke="#0f172a" stroke-width="2.6" stroke-linejoin="round"/><path d="M16 14.5v3.6" stroke="#2563eb" stroke-width="2.6" stroke-linecap="round"/></svg>`;

export function GET(): Response {
  return new Response(icon, {
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Type": "image/svg+xml; charset=utf-8"
    }
  });
}
