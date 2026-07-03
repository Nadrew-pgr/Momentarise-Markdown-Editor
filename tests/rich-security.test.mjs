import { JSDOM } from "jsdom";
import { DOMParser, DOMSerializer } from "prosemirror-model";

const rich = await import("../packages/md-rich-prosemirror/dist/index.js");

const markdownState = rich.createRichMarkdownState(
  [
    "[safe](https://example.com) [relative](/docs) [mail](mailto:team@example.com) [bad](javascript:alert(1)) [vb](vbscript:msgbox(1)) [data](data:text/html,evil)",
    "",
    "![safe image](https://example.com/image.png) ![inline image](data:image/png;base64,abc) ![bad image](javascript:alert(1)) ![bad data](data:text/html,evil)",
    ""
  ].join("\n")
);
const markdownHtml = serializeDoc(markdownState.schema, markdownState.editorState.doc);
assert(!/javascript:/i.test(markdownHtml), `rich Markdown bridge must strip javascript URLs from live DOM:\n${markdownHtml}`);
assert(!/vbscript:/i.test(markdownHtml), `rich Markdown bridge must strip vbscript URLs from live DOM:\n${markdownHtml}`);
assert(!/data:text/i.test(markdownHtml), `rich Markdown bridge must strip non-image data URLs from live DOM:\n${markdownHtml}`);
assert(markdownHtml.includes("https://example.com"), "rich Markdown bridge must keep safe http(s) URLs.");
assert(markdownHtml.includes("/docs"), "rich Markdown bridge must keep relative URLs.");
assert(markdownHtml.includes("mailto:team@example.com"), "rich Markdown bridge must keep mailto URLs.");
assert(markdownHtml.includes("data:image/png;base64,abc"), "rich Markdown bridge must keep data:image URLs for image src only.");
assert(markdownHtml.includes("bad"), "unsafe link text must remain visible.");

const pasteTransform = rich
  .createMomentariseRichPlugins()
  .map((plugin) => plugin.props.transformPastedHTML)
  .find((transform) => typeof transform === "function");
assert(pasteTransform, "rich ProseMirror plugins must include transformPastedHTML paste sanitization.");
const pasted = pasteTransform(
  '<p onclick="steal()">Keep <img src="javascript:alert(1)" onerror="steal()" alt="x"></p><script>alert(1)</script>'
);
assert(!/<script/i.test(pasted), `paste sanitizer must remove script tags:\n${pasted}`);
assert(!/\son[a-z]+\s*=/i.test(pasted), `paste sanitizer must remove event handler attributes:\n${pasted}`);
assert(!/javascript:/i.test(pasted), `paste sanitizer must strip unsafe URL attributes:\n${pasted}`);
assert(pasted.includes("Keep"), "paste sanitizer must preserve safe pasted text.");

const originalDomParser = globalThis.DOMParser;
try {
  globalThis.DOMParser = undefined;
  const fallbackPasted = pasteTransform(
    '<p onmouseover=steal()>Fallback <a href=javascript:alert(1)>bad</a><a href=javascript&#58;alert(1)>encoded</a><img src=jav&#x61;script:alert(1) alt=x><img src=data:image/png;base64,abc alt=ok></p>'
  );
  assert(!/\son[a-z]+\s*=/i.test(fallbackPasted), `DOM-less paste fallback must remove unquoted event handlers:\n${fallbackPasted}`);
  const fallbackDom = new JSDOM(`<main>${fallbackPasted}</main>`);
  assert(
    ![...fallbackDom.window.document.querySelectorAll("a, img")].some((element) => /javascript:/i.test(String(element.getAttribute("href") ?? element.getAttribute("src") ?? ""))),
    `DOM-less paste fallback must strip literal and encoded unsafe URLs:\n${fallbackPasted}`
  );
  assert(fallbackPasted.includes("Fallback"), "DOM-less paste fallback must preserve safe text.");
  assert(fallbackPasted.includes("data:image/png;base64,abc"), "DOM-less paste fallback must keep data:image URLs.");
} finally {
  globalThis.DOMParser = originalDomParser;
}

const dom = new JSDOM(
  '<main><p><a href="javascript:alert(1)" onclick="steal()">Bad</a><a href="mailto:team@example.com">Mail</a><img src="data:text/html,evil" alt="bad"><img src="data:image/png;base64,abc" alt="ok"></p></main>'
);
installDomGlobals(dom.window);
const schema = rich.createMomentariseRichSchema();
const parsedDoc = DOMParser.fromSchema(schema).parse(dom.window.document.querySelector("main"));
const parsedHtml = serializeDoc(schema, parsedDoc);
assert(!/javascript:/i.test(parsedHtml), `parseDOM must strip javascript hrefs:\n${parsedHtml}`);
assert(!/onclick/i.test(parsedHtml), `parseDOM must not preserve event handlers:\n${parsedHtml}`);
assert(!/data:text/i.test(parsedHtml), `parseDOM must strip non-image data URLs:\n${parsedHtml}`);
assert(parsedHtml.includes("Bad"), "parseDOM must preserve unsafe anchor text.");
assert(parsedHtml.includes("mailto:team@example.com"), "parseDOM must keep safe mailto URLs.");
assert(parsedHtml.includes("data:image/png;base64,abc"), "parseDOM must keep data:image URLs for images.");

function serializeDoc(schema, doc) {
  const dom = new JSDOM("<main></main>");
  installDomGlobals(dom.window);
  const fragment = DOMSerializer.fromSchema(schema).serializeFragment(doc.content, {
    document: dom.window.document
  });
  const container = dom.window.document.querySelector("main");
  container.append(fragment);
  return container.innerHTML;
}

function installDomGlobals(window) {
  globalThis.Element = window.Element;
  globalThis.HTMLElement = window.HTMLElement;
  globalThis.HTMLAnchorElement = window.HTMLAnchorElement;
  globalThis.HTMLImageElement = window.HTMLImageElement;
  globalThis.HTMLOListElement = window.HTMLOListElement;
  globalThis.DOMParser = window.DOMParser;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
