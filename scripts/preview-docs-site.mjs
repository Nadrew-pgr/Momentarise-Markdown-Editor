import { createServer } from "node:http";
import { createReadStream, existsSync } from "node:fs";
import { realpath, stat } from "node:fs/promises";
import { dirname, extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outRoot = join(repoRoot, "apps/docs-site/out");
const host = process.env.HOST ?? "127.0.0.1";
const port = Number.parseInt(process.env.PORT ?? "4178", 10);
const realOutRoot = await realpath(outRoot);

const server = createServer(async (request, response) => {
  try {
    const file = await resolveRequestPath(request.url ?? "/");
    if (!file) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }
    response.writeHead(200, { "content-type": contentTypeFor(file) });
    createReadStream(file).pipe(response);
  } catch {
    response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    response.end("Static preview failed");
  }
});

server.on("error", (error) => {
  console.error(`Docs static preview failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});

server.listen(port, host, () => {
  console.log(`Docs static preview: http://${host}:${port}/`);
});

async function resolveRequestPath(rawUrl) {
  const url = new URL(rawUrl, `http://${host}:${port}`);
  const decodedPath = safeDecodePath(url.pathname);
  const requestPath = normalizeRequestPath(decodedPath);
  const candidates = requestPath
    ? extname(requestPath)
      ? [requestPath]
      : [`${requestPath}.html`, join(requestPath, "index.html")]
    : ["index.html"];
  candidates.push("404.html");
  for (const candidate of candidates) {
    const resolved = resolve(outRoot, candidate);
    if (!(await isInsideOutRoot(resolved))) {
      continue;
    }
    if (existsSync(resolved) && (await stat(resolved)).isFile()) {
      return resolved;
    }
  }
  return null;
}

function normalizeRequestPath(pathname) {
  if (pathname === "/") {
    return "";
  }
  return pathname.replace(/^\/+/, "").replace(/\/+$/, "");
}

async function isInsideOutRoot(path) {
  const realPath = await realpath(path).catch(() => null);
  if (!realPath) {
    return false;
  }
  const normalizedRoot = normalize(realOutRoot);
  const normalizedPath = normalize(realPath);
  return normalizedPath === normalizedRoot || normalizedPath.startsWith(`${normalizedRoot}${sep}`);
}

function safeDecodePath(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return "/";
  }
}

function contentTypeFor(path) {
  switch (extname(path)) {
    case ".css":
      return "text/css; charset=utf-8";
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".md":
      return "text/markdown; charset=utf-8";
    case ".txt":
      return "text/plain; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".woff":
      return "font/woff";
    case ".woff2":
      return "font/woff2";
    case ".xml":
      return "application/xml; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}
