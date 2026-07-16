export function parsePublicDocsFrontmatter(source) {
  if (!source.startsWith("---\n")) {
    return { body: source, metadata: {} };
  }
  const closeIndex = source.indexOf("\n---\n", 4);
  if (closeIndex === -1) {
    return { body: source, metadata: {} };
  }
  const raw = source.slice(4, closeIndex);
  const entries = new Map();
  let currentArrayKey = null;
  for (const line of raw.split("\n")) {
    if (!line.trim()) {
      continue;
    }
    const arrayItem = /^\s+-\s+(.+)$/.exec(line);
    if (arrayItem && currentArrayKey) {
      const items = entries.get(currentArrayKey);
      entries.set(currentArrayKey, [...(Array.isArray(items) ? items : []), stripQuotes(arrayItem[1] ?? "")]);
      continue;
    }
    const match = /^([A-Za-z_][A-Za-z0-9_]*)\s*:/.exec(line);
    if (!match) {
      currentArrayKey = null;
      continue;
    }
    const key = match[1];
    const value = line.slice(match[0].length).trim();
    currentArrayKey = value ? null : key;
    entries.set(key, value ? stripQuotes(value) : []);
  }
  const navOrderValue = entries.get("nav_order");
  const navOrder = typeof navOrderValue === "string" ? Number.parseInt(navOrderValue, 10) : undefined;
  const llmsValue = entries.get("llms");
  return {
    body: source.slice(closeIndex + "\n---\n".length),
    metadata: {
      ...(typeof entries.get("title") === "string" ? { title: entries.get("title") } : {}),
      ...(typeof entries.get("description") === "string" ? { description: entries.get("description") } : {}),
      ...(typeof entries.get("nav_section") === "string" ? { navSection: entries.get("nav_section") } : {}),
      ...(Number.isFinite(navOrder) ? { navOrder } : {}),
      ...(llmsValue === "include" || llmsValue === "exclude" ? { llms: llmsValue } : {})
    }
  };
}

export function comparePublicDocsPages(a, b) {
  const aSection = a.metadata.navSection ?? sectionFromPath(a.path);
  const bSection = b.metadata.navSection ?? sectionFromPath(b.path);
  const sectionCompare = sectionWeight(aSection) - sectionWeight(bSection) || aSection.localeCompare(bSection);
  if (sectionCompare !== 0) {
    return sectionCompare;
  }
  const orderCompare = (a.metadata.navOrder ?? Number.MAX_SAFE_INTEGER) - (b.metadata.navOrder ?? Number.MAX_SAFE_INTEGER);
  if (orderCompare !== 0) {
    return orderCompare;
  }
  return a.path.localeCompare(b.path);
}

export function sectionFromPath(path) {
  if (path === "index.md") {
    return "Start";
  }
  const [firstSegment] = path.split("/");
  if (firstSegment === "quickstart") {
    return "Getting Started";
  }
  if (firstSegment === "concepts") {
    return "Foundations";
  }
  if (firstSegment === "packages") {
    return "Reference";
  }
  return "Reference";
}

export function titleFromPath(path) {
  return path
    .replace(/\.md$/, "")
    .split("/")
    .at(-1)
    .split("-")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

export function sanitizeLlmsLineField(value, maxLength = 220) {
  const compact = String(value).replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
  return compact.slice(0, maxLength).replace(/[\\[\]]/g, "\\$&");
}

export function assertSafePublicMarkdownPath(path) {
  if (!path.endsWith(".md") || path.includes("..") || path.includes("\\") || path.startsWith("/")) {
    throw new Error(`Unsafe public Markdown path: ${JSON.stringify(path)}`);
  }
}

export function validateAbsoluteUrl(url) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`Unsafe docs URL protocol: ${url}`);
  }
  return parsed.toString();
}

function sectionWeight(section) {
  const weights = new Map([
    ["Start", 0],
    ["Getting Started", 1],
    ["Foundations", 2],
    ["Features", 3],
    ["Styling", 4],
    ["Reference", 5]
  ]);
  return weights.get(section) ?? 10;
}

function stripQuotes(value) {
  return String(value).replace(/^["']|["']$/g, "").trim();
}
