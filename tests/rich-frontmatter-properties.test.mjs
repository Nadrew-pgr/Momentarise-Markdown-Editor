/*
 * MME-0090 — the frontmatter Properties panel, and the positional YAML engine
 * underneath it.
 *
 * The panel is the visible half; the engine is the half that can corrupt a
 * user's file. Every assertion below therefore checks *bytes*, not shape: an
 * edit must splice the value's own bytes and leave every other byte of the
 * document — key order, the comment line, the anchor, the block scalar, the
 * list indentation, the body, the line endings — byte-identical.
 *
 * Parse-and-redump is the failure this suite exists to prevent. A YAML library
 * round-trip would pass a "the values are still correct" test while silently
 * reordering keys, dropping the comment, expanding the anchor, and renormalising
 * every quote in the block. That is exactly the "full-document normalization
 * presented as preservation" that AGENT.md forbids.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const format = await import("../packages/md-format/dist/index.js");

const FIXTURE_PATH = "fixtures/041-frontmatter-properties/input.md";
const fixture = readFileSync(FIXTURE_PATH, "utf8");

const NO_FRONTMATTER = "# Plain Document\n\nNo YAML block here.\n";

/** Every byte of `source` outside `span` must be present, unchanged, in `next`. */
function assertOnlySpanChanged(source, next, span, label) {
  assert.equal(next.slice(0, span.from), source.slice(0, span.from), `${label}: bytes before the edit changed`);
  const tailFrom = next.length - (source.length - span.to);
  assert.equal(next.slice(tailFrom), source.slice(span.to), `${label}: bytes after the edit changed`);
}

/* ---------------------------------------------------------------- the model */

const model = format.readFrontmatterBlock(fixture);
assert.ok(model, "readFrontmatterBlock must find the fixture's frontmatter block");
assert.equal(
  fixture.slice(model.blockRange.from, model.blockRange.to),
  model.raw,
  "blockRange must slice exactly the raw block out of the document"
);
assert.ok(model.raw.startsWith("---\n"), "the block starts at the opening delimiter");
assert.ok(model.raw.endsWith("---\n"), "the block ends after the closing delimiter's line ending");
assert.equal(model.blockRange.from, 0, "frontmatter is only frontmatter at offset 0");
assert.equal(model.lineEnding, "\n", "the fixture is an LF document");
assert.equal(model.listIndent, "  ", "the fixture's list items are indented two spaces");

const expectedEntries = [
  { editable: true, key: "title", type: "text", value: "Properties Fixture" },
  { editable: true, key: "priority", type: "number", value: 3 },
  { editable: true, key: "published", type: "checkbox", value: true },
  { editable: true, key: "created", type: "date", value: "2026-08-14" },
  { editable: true, key: "reviewed", type: "datetime", value: "2026-08-14T09:30:00" },
  { editable: true, key: "tags", type: "list", value: ["markdown", "preservation"] },
  { editable: true, key: "quoted", type: "text", value: "A value: with a colon" },
  { editable: false, key: "nested", reason: "nested-map" },
  { editable: false, key: "summary", reason: "block-scalar" },
  { editable: false, key: "anchored", reason: "anchor-or-tag" }
];

assert.equal(
  model.entries.length,
  expectedEntries.length,
  `expected ${expectedEntries.length} properties, got ${model.entries.map((entry) => entry.key).join(", ")}`
);

model.entries.forEach((entry, index) => {
  const expected = expectedEntries[index];
  assert.equal(entry.key, expected.key, `property ${index} key`);
  assert.equal(entry.index, index, `property ${expected.key} must carry its own positional index`);
  assert.equal(entry.editable, expected.editable, `property ${expected.key} editability`);
  assert.equal(
    fixture.slice(entry.keyRange.from, entry.keyRange.to),
    expected.key,
    `property ${expected.key}: keyRange must slice the key's own bytes`
  );
  if (expected.editable) {
    assert.equal(entry.type, expected.type, `property ${expected.key} type`);
    assert.deepEqual(entry.value, expected.value, `property ${expected.key} value`);
    assert.equal(entry.reason, null, `an editable property has no read-only reason`);
  } else {
    assert.equal(entry.reason, expected.reason, `property ${expected.key} read-only reason`);
  }
});

// The comment line is not a property, and nothing may address it.
assert.ok(
  !model.entries.some((entry) => entry.key.startsWith("#")),
  "a YAML comment must never be modelled as a property"
);

// entryRange is what deletion splices out: whole lines, terminator included.
const tagsEntry = model.entries[5];
assert.equal(
  fixture.slice(tagsEntry.entryRange.from, tagsEntry.entryRange.to),
  "tags:\n  - markdown\n  - preservation\n",
  "a list property's entryRange must span its key line and every item line"
);
assert.equal(
  fixture.slice(tagsEntry.valueRange.from, tagsEntry.valueRange.to),
  "\n  - markdown\n  - preservation",
  "a list property's valueRange must start after the colon and stop at the last item"
);

/*
 * Read-only entries carry ranges too: the panel renders their raw value from
 * `valueRange`, and `removeFrontmatterProperty` splices their `entryRange`. A
 * range that swallows the line terminator shows a stray newline in the row and
 * eats the following line on delete.
 */
assert.equal(
  fixture.slice(model.entries[7].valueRange.from, model.entries[7].valueRange.to),
  "\n  owner: docs-team\n  stage: draft",
  "a nested map's valueRange stops at the last line's end, not at its terminator"
);
assert.equal(
  fixture.slice(model.entries[8].valueRange.from, model.entries[8].valueRange.to),
  " |\n  A block scalar the panel must never rewrite,\n  because it cannot be spliced safely.",
  "a block scalar's valueRange spans the indicator and every folded line"
);
assert.equal(
  fixture.slice(model.entries[9].valueRange.from, model.entries[9].valueRange.to),
  " &shared reusable",
  "an anchored value's valueRange is its own line only"
);

assert.equal(format.readFrontmatterBlock(NO_FRONTMATTER), null, "a document with no YAML block has no model");
assert.equal(
  format.readFrontmatterBlock("Text first.\n\n---\ntitle: Not frontmatter\n---\n"),
  null,
  "a --- block that is not at offset 0 is a thematic break, not frontmatter"
);

/* ------------------------------------------------- bounded scalar value edit */

const retitled = format.setFrontmatterPropertyValue(fixture, 0, "Renamed Fixture");
assert.equal(retitled.refusal, null, "editing a plain text value must not refuse");
assert.equal(
  fixture.slice(retitled.splice.from, retitled.splice.to),
  " Properties Fixture",
  "the splice must own the value's bytes and nothing else"
);
assert.equal(retitled.splice.replacement, " Renamed Fixture", "the replacement is the new value, unquoted");
assertOnlySpanChanged(fixture, retitled.content, retitled.splice, "title edit");
assert.ok(retitled.content.includes("title: Renamed Fixture\n"), "the new title is written");
for (const survivor of [
  "# Reviewers keep this note in the block; the panel must never touch it.\n",
  "nested:\n  owner: docs-team\n  stage: draft\n",
  "summary: |\n  A block scalar the panel must never rewrite,\n",
  "anchored: &shared reusable\n",
  "  - markdown\n  - preservation\n",
  'quoted: "A value: with a colon"\n',
  "Body bytes that must survive every property edit.\n"
]) {
  assert.ok(retitled.content.includes(survivor), `a value edit must preserve: ${JSON.stringify(survivor)}`);
}

/* --------------------------------------------------- quoting conventions */

const requoted = format.setFrontmatterPropertyValue(fixture, 6, "Another: colon value");
assert.equal(
  requoted.splice.replacement,
  ' "Another: colon value"',
  "a value that was double-quoted stays double-quoted"
);

const needsQuoting = format.setFrontmatterPropertyValue(fixture, 0, "Colons: are ambiguous");
assert.equal(
  needsQuoting.splice.replacement,
  ' "Colons: are ambiguous"',
  "an unquoted value gains quotes when the new text would not parse back as text"
);

const staysBare = format.setFrontmatterPropertyValue(fixture, 0, "Simple title");
assert.equal(staysBare.splice.replacement, " Simple title", "an unquoted value that needs no quoting stays bare");

const textThatLooksLikeANumber = format.setFrontmatterPropertyValue(fixture, 0, "42");
assert.equal(
  textThatLooksLikeANumber.splice.replacement,
  ' "42"',
  "a text value that would parse back as a number must be quoted, or the type silently changes"
);

const escaped = format.setFrontmatterPropertyValue(fixture, 6, 'He said "no"');
assert.equal(
  escaped.splice.replacement,
  ' "He said \\"no\\""',
  "double quotes inside a double-quoted value are escaped"
);

/* ------------------------------------------------------- typed value edits */

const renumbered = format.setFrontmatterPropertyValue(fixture, 1, 7);
assert.equal(renumbered.splice.replacement, " 7", "a number is written bare");
assertOnlySpanChanged(fixture, renumbered.content, renumbered.splice, "number edit");

const unpublished = format.setFrontmatterPropertyValue(fixture, 2, false);
assert.equal(unpublished.splice.replacement, " false", "a checkbox is written as a YAML boolean");

const redated = format.setFrontmatterPropertyValue(fixture, 3, "2026-09-01");
assert.equal(redated.splice.replacement, " 2026-09-01", "a date is written bare, not quoted");

const retimed = format.setFrontmatterPropertyValue(fixture, 4, "2026-09-01T18:45:00");
assert.equal(retimed.splice.replacement, " 2026-09-01T18:45:00", "a date & time is written bare");

/* --------------------------------------------------------------- list edits */

const retagged = format.setFrontmatterPropertyValue(fixture, 5, ["markdown", "preservation", "properties"]);
assert.equal(
  retagged.splice.replacement,
  "\n  - markdown\n  - preservation\n  - properties",
  "a list rewrite reuses the block's own item indentation and dash style"
);
assertOnlySpanChanged(fixture, retagged.content, retagged.splice, "list edit");
assert.ok(
  retagged.content.includes("  - properties\nquoted:"),
  "the new item lands inside the list, before the next property"
);

const emptiedList = format.setFrontmatterPropertyValue(fixture, 5, []);
assert.equal(emptiedList.splice.replacement, " []", "an emptied list collapses to a flow sequence rather than a dangling key");

/* -------------------------------------------------- complex values refuse */

for (const [index, key, reason] of [
  [7, "nested", "nested-map"],
  [8, "summary", "block-scalar"],
  [9, "anchored", "anchor-or-tag"]
]) {
  const refused = format.setFrontmatterPropertyValue(fixture, index, "rewritten");
  assert.equal(refused.content, fixture, `${key}: a refused edit must not change one byte`);
  assert.equal(refused.splice, null, `${key}: a refused edit produces no splice`);
  assert.equal(refused.refusal?.code, "complex-value", `${key}: refusal code`);
  assert.ok(
    refused.refusal.message.includes(key),
    `${key}: the refusal message must name the property so the panel can explain it`
  );
  assert.equal(
    format.setFrontmatterPropertyType(fixture, index, "text").refusal?.code,
    "complex-value",
    `${key}: changing the type of a complex value is refused too`
  );

  const reasonEntry = model.entries[index];
  assert.equal(reasonEntry.reason, reason, `${key}: the model explains why it is read-only`);
}

assert.equal(
  format.setFrontmatterPropertyValue(fixture, 99, "x").refusal?.code,
  "unknown-property",
  "an out-of-range index is refused, not silently applied to a neighbour"
);
assert.equal(
  format.setFrontmatterPropertyValue(NO_FRONTMATTER, 0, "x").refusal?.code,
  "no-frontmatter",
  "editing a property of a document with no block is refused"
);

/* ------------------------------------------------------------ type changes */

const priorityAsText = format.setFrontmatterPropertyType(fixture, 1, "text");
assert.equal(priorityAsText.splice.replacement, ' "3"', "number -> text quotes the value so it stays text");

const titleAsList = format.setFrontmatterPropertyType(fixture, 0, "list");
assert.equal(
  titleAsList.splice.replacement,
  "\n  - Properties Fixture",
  "text -> list converts the scalar into a one-item block sequence"
);
assertOnlySpanChanged(fixture, titleAsList.content, titleAsList.splice, "type change to list");

const tagsAsText = format.setFrontmatterPropertyType(fixture, 5, "text");
assert.equal(
  tagsAsText.splice.replacement,
  " markdown, preservation",
  "list -> text joins the items rather than losing them"
);

const publishedAsText = format.setFrontmatterPropertyType(fixture, 2, "text");
assert.equal(publishedAsText.splice.replacement, ' "true"', "checkbox -> text must quote, or it stays a boolean");

const reviewedAsDate = format.setFrontmatterPropertyType(fixture, 4, "date");
assert.equal(
  reviewedAsDate.splice.replacement,
  " 2026-08-14",
  "date & time -> date keeps the whole calendar date, not a truncated one"
);
assert.equal(
  format.setFrontmatterPropertyType(fixture, 3, "datetime").splice.replacement,
  " 2026-08-14T00:00:00",
  "date -> date & time keeps the date and adds midnight"
);
assert.equal(
  format.setFrontmatterPropertyType(fixture, 0, "date").splice.replacement,
  " ",
  "text that is not a date becomes an empty date rather than an invented one"
);

/* ------------------------------------------------------------------ rename */

const renamed = format.renameFrontmatterProperty(fixture, 0, "headline");
assert.equal(
  fixture.slice(renamed.splice.from, renamed.splice.to),
  "title",
  "renaming splices the key's bytes only, never the value's"
);
assert.equal(renamed.splice.replacement, "headline");
assertOnlySpanChanged(fixture, renamed.content, renamed.splice, "rename");
assert.ok(renamed.content.includes("headline: Properties Fixture\n"), "the value survives a rename verbatim");
assert.equal(
  format.renameFrontmatterProperty(fixture, 0, "priority").refusal?.code,
  "duplicate-key",
  "renaming onto an existing key is refused"
);
assert.equal(
  format.renameFrontmatterProperty(fixture, 0, "bad: key").refusal?.code,
  "invalid-key",
  "a key containing a colon would restructure the block and is refused"
);
assert.equal(
  format.renameFrontmatterProperty(fixture, 0, "  ").refusal?.code,
  "invalid-key",
  "a blank key is refused"
);
assert.equal(
  format.renameFrontmatterProperty(fixture, 7, "renamed").refusal,
  null,
  "renaming a complex property is safe: the key line is spliceable even when the value is not"
);
assert.equal(
  format.renameFrontmatterProperty(fixture, 0, "title").refusal,
  null,
  "a property does not clash with itself: committing an unchanged key must not read as a duplicate"
);

/* --------------------------------------------------------------------- add */

const added = format.addFrontmatterProperty(fixture, { key: "status", value: "draft" });
assert.equal(added.refusal, null, "adding a new key must not refuse");
assert.equal(added.splice.from, added.splice.to, "an add is an insertion, so it replaces no bytes");
assert.equal(added.splice.replacement, "status: draft\n", "the inserted line carries the block's line ending");
assert.equal(
  fixture.slice(0, added.splice.from).endsWith("anchored: &shared reusable\n"),
  true,
  "a new property is inserted after the last existing line, before the closing delimiter"
);
assertOnlySpanChanged(fixture, added.content, added.splice, "add");
assert.ok(added.content.includes("anchored: &shared reusable\nstatus: draft\n---\n"), "the block still closes");

const addedList = format.addFrontmatterProperty(fixture, { key: "authors", type: "list", value: ["ada"] });
assert.equal(addedList.splice.replacement, "authors:\n  - ada\n", "an added list uses the block's item indentation");

const addedEmpty = format.addFrontmatterProperty(fixture, { key: "status" , value: "" });
assert.equal(addedEmpty.splice.replacement, "status: \n", "an added property with no value still writes the key line");

assert.equal(
  format.addFrontmatterProperty(fixture, { key: "title", value: "x" }).refusal?.code,
  "duplicate-key",
  "adding a key that already exists is refused"
);
assert.equal(
  format.addFrontmatterProperty(fixture, { key: "", value: "x" }).refusal?.code,
  "invalid-key",
  "adding a blank key is refused"
);
assert.equal(
  format.addFrontmatterProperty(NO_FRONTMATTER, { key: "title", value: "x" }).refusal?.code,
  "no-frontmatter",
  "adding to a document with no block is refused; creating the block is a separate, explicit action"
);

/* ------------------------------------------------------------------ remove */

const removedScalar = format.removeFrontmatterProperty(fixture, 0);
assert.equal(
  fixture.slice(removedScalar.splice.from, removedScalar.splice.to),
  "title: Properties Fixture\n",
  "removing a scalar splices its whole line, terminator included"
);
assert.equal(removedScalar.splice.replacement, "", "a removal replaces with nothing");
assertOnlySpanChanged(fixture, removedScalar.content, removedScalar.splice, "remove scalar");
assert.ok(removedScalar.content.startsWith("---\npriority: 3\n"), "the following property moves up intact");

const removedList = format.removeFrontmatterProperty(fixture, 5);
assert.equal(
  fixture.slice(removedList.splice.from, removedList.splice.to),
  "tags:\n  - markdown\n  - preservation\n",
  "removing a list takes its item lines with it"
);
assert.ok(
  !removedList.content.includes("  - markdown"),
  "no orphaned list item survives the removal"
);
assert.ok(removedList.content.includes('reviewed: 2026-08-14T09:30:00\nquoted: "A value: with a colon"\n'));

const removedComplex = format.removeFrontmatterProperty(fixture, 8);
assert.equal(
  fixture.slice(removedComplex.splice.from, removedComplex.splice.to),
  "summary: |\n  A block scalar the panel must never rewrite,\n  because it cannot be spliced safely.\n",
  "a block scalar is removable as a whole even though its value is not editable"
);
assert.ok(
  removedComplex.content.includes("  stage: draft\nanchored: &shared reusable\n"),
  "removing the block scalar leaves its neighbours adjacent and unchanged"
);

/* ------------------------------------------------------------- CRLF documents */

const crlf = fixture.replace(/\n/g, "\r\n");
const crlfModel = format.readFrontmatterBlock(crlf);
assert.equal(crlfModel.lineEnding, "\r\n", "a CRLF document is detected as CRLF");
assert.equal(crlfModel.entries.length, expectedEntries.length, "CRLF parsing finds the same properties");
assert.deepEqual(crlfModel.entries[5].value, ["markdown", "preservation"], "CRLF list items parse without stray \\r");
assert.equal(crlfModel.entries[0].value, "Properties Fixture", "a CRLF scalar value carries no trailing \\r");

const crlfEdited = format.setFrontmatterPropertyValue(crlf, 0, "Renamed Fixture");
assert.ok(crlfEdited.content.includes("title: Renamed Fixture\r\n"), "a CRLF value edit keeps CRLF");
assert.equal(
  (crlfEdited.content.match(/\n/g) ?? []).length,
  (crlfEdited.content.match(/\r\n/g) ?? []).length,
  "a CRLF document must not gain a single bare LF"
);

const crlfAdded = format.addFrontmatterProperty(crlf, { key: "status", value: "draft" });
assert.equal(crlfAdded.splice.replacement, "status: draft\r\n", "an added line uses the document's line ending");
assert.equal(
  (crlfAdded.content.match(/\n/g) ?? []).length,
  (crlfAdded.content.match(/\r\n/g) ?? []).length,
  "adding a property must not introduce a bare LF"
);

const crlfList = format.setFrontmatterPropertyValue(crlf, 5, ["a", "b"]);
assert.equal(crlfList.splice.replacement, "\r\n  - a\r\n  - b", "a CRLF list rewrite keeps CRLF between items");

const crlfRemoved = format.removeFrontmatterProperty(crlf, 5);
assert.ok(!crlfRemoved.content.includes("- markdown"), "CRLF list removal takes the item lines");
assert.equal(
  (crlfRemoved.content.match(/\n/g) ?? []).length,
  (crlfRemoved.content.match(/\r\n/g) ?? []).length,
  "CRLF removal must not leave a bare LF behind"
);

/* ------------------------------------------- creating a block from nothing */

const created = format.createFrontmatterBlock(NO_FRONTMATTER);
assert.equal(created.refusal, null, "creating a block in a document with none must not refuse");
assert.equal(created.splice.from, 0, "the block is created at the top of the file");
assert.equal(created.splice.to, 0, "creation inserts, it does not overwrite the first line");
assert.equal(created.splice.replacement, "---\ntitle: \n---\n\n", "the created block is the documented minimal block");
assert.equal(created.content, "---\ntitle: \n---\n\n# Plain Document\n\nNo YAML block here.\n");
assert.equal(
  created.content.slice(created.splice.replacement.length),
  NO_FRONTMATTER,
  "the whole original document survives below the new block"
);
assert.equal(
  format.createFrontmatterBlock(fixture).refusal?.code,
  "frontmatter-exists",
  "a document that already has a block cannot get a second one"
);
assert.equal(format.createFrontmatterBlock(fixture).content, fixture, "the refusal changes nothing");

const createdInCrlf = format.createFrontmatterBlock("# Plain\r\n\r\nBody.\r\n");
assert.equal(
  createdInCrlf.splice.replacement,
  "---\r\ntitle: \r\n---\r\n\r\n",
  "a created block adopts the document's existing line ending"
);

const createdInEmpty = format.createFrontmatterBlock("");
assert.equal(createdInEmpty.splice.replacement, "---\ntitle: \n---\n", "an empty document gets no trailing blank line");

const createdAboveBlankLine = format.createFrontmatterBlock("\n# Already spaced\n");
assert.equal(
  createdAboveBlankLine.splice.replacement,
  "---\ntitle: \n---\n",
  "a document that already starts with a blank line does not gain a second one"
);
assert.equal(createdAboveBlankLine.content, "---\ntitle: \n---\n\n# Already spaced\n");

/* ------------------------------------------- type detection is not the model */

assert.equal(format.frontmatterPropertyTypeOfRawValue("3"), "number");
assert.equal(format.frontmatterPropertyTypeOfRawValue("3.5"), "number");
assert.equal(format.frontmatterPropertyTypeOfRawValue("-2"), "number");
assert.equal(format.frontmatterPropertyTypeOfRawValue("true"), "checkbox");
assert.equal(format.frontmatterPropertyTypeOfRawValue("false"), "checkbox");
assert.equal(format.frontmatterPropertyTypeOfRawValue("2026-08-14"), "date");
assert.equal(format.frontmatterPropertyTypeOfRawValue("2026-08-14T09:30"), "datetime");
/*
 * Only the shape `<input type="datetime-local">` can render is typed `datetime`.
 * A space separator or a zone offset blanks that input silently — the writer
 * sees an empty field for a value that exists, and committing it drops the
 * offset — so those stay text and round-trip verbatim.
 */
assert.equal(format.frontmatterPropertyTypeOfRawValue("2026-08-14 09:30:00"), "text");
assert.equal(format.frontmatterPropertyTypeOfRawValue("2026-08-14T09:30:00Z"), "text");
assert.equal(format.frontmatterPropertyTypeOfRawValue("2026-08-14T09:30:00+02:00"), "text");
assert.equal(format.frontmatterPropertyTypeOfRawValue("[a, b]"), "list");
assert.equal(format.frontmatterPropertyTypeOfRawValue('"3"'), "text", "a quoted number is text, because YAML says so");
assert.equal(format.frontmatterPropertyTypeOfRawValue("2026-13-45"), "text", "an impossible date is text, not a date");
assert.equal(format.frontmatterPropertyTypeOfRawValue(""), "text");

/* ------------------------------------- values the scanner refuses to touch */

const withInlineComment = "---\ntitle: Draft # not published yet\n---\n\nBody.\n";
const inlineCommentModel = format.readFrontmatterBlock(withInlineComment);
assert.equal(inlineCommentModel.entries[0].editable, false, "a value carrying a trailing comment is read-only");
assert.equal(
  inlineCommentModel.entries[0].reason,
  "inline-comment",
  "the comment is authored bytes inside the value range, so rewriting the value would delete it"
);
assert.equal(
  format.setFrontmatterPropertyValue(withInlineComment, 0, "Published").content,
  withInlineComment,
  "refusing an inline-comment value must not touch the comment"
);
assert.equal(
  format.readFrontmatterBlock('---\nquoted: "unterminated\n---\n').entries[0].reason,
  "unsupported-value",
  "a quote that never closes on its line is beyond the scanner"
);
assert.equal(
  format.readFrontmatterBlock("---\nowners:\n  - name: ada\n    role: author\n---\n").entries[0].reason,
  "nested-map",
  "a list of maps is not a list of scalars"
);
assert.equal(
  format.readFrontmatterBlock("---\ntags:\n  - a\n    - b\n---\n").entries[0].reason,
  "nested-map",
  "items at mixed indentation are not a flat sequence"
);

const unreadableBlock = format.readFrontmatterBlock("---\ntitle: Fine\nthis line has no colon\n---\n");
assert.equal(unreadableBlock.partial, true, "a block with a line the scanner cannot read is flagged");
assert.deepEqual(
  unreadableBlock.entries,
  [],
  "a partially understood block exposes no editable properties: half an understanding is how a splice lands on the wrong bytes"
);
assert.equal(
  format.setFrontmatterPropertyValue("---\ntitle: Fine\nthis line has no colon\n---\n", 0, "x").refusal?.code,
  "unknown-property",
  "nothing in an unreadable block is addressable"
);

/* ------------------------- defects the MME-0090 reviewers demonstrated ------ */

/*
 * `...` is a YAML document-end marker that remark-frontmatter does NOT accept as
 * a closing fence. Treating it as one made this scanner claim bytes the
 * ProseMirror document owns: the panel rendered rows over body content, the
 * rebase guard whose whole job is to refuse body splices let the splice through,
 * and the next rich serialization silently reverted the writer's edit. Both
 * reviewers found it independently, with a reproduction.
 */
assert.equal(
  format.readFrontmatterBlock("---\ntitle: A\n...\n\nBody.\n"),
  null,
  "`...` does not close a frontmatter block, so there is no block to edit"
);
assert.equal(
  format.readFrontmatterBlock("---\ntitle: A\n...\n---\n").raw,
  "---\ntitle: A\n...\n---\n",
  "and a `...` line inside a properly fenced block is just a line the scanner cannot read"
);

/*
 * A key is spliced into the block as authored, so a key carrying a YAML
 * indicator changes what the block means — `a #b` starts a comment that swallows
 * the colon and the whole block stops parsing, taking every other property with
 * it.
 */
for (const badKey of ["a #b", "[x]", "*alias", "{a}", "&anchor", "!tag", "|pipe", ">fold", "%directive", "@at", "`tick", "?q", ",comma"]) {
  assert.equal(
    format.renameFrontmatterProperty(fixture, 0, badKey).refusal?.code,
    "invalid-key",
    `renaming to ${JSON.stringify(badKey)} would change what the block means`
  );
  assert.equal(
    format.addFrontmatterProperty(fixture, { key: badKey, value: "x" }).refusal?.code,
    "invalid-key",
    `adding ${JSON.stringify(badKey)} would change what the block means`
  );
}
assert.equal(
  format.renameFrontmatterProperty(fixture, 0, "a-b_c 1").refusal,
  null,
  "an ordinary key with a space, a hyphen and a digit is still fine"
);

/*
 * A quote pair has to ENCLOSE the scalar. A start/end character test read
 * `title: "a" # "b"` as quoted, which suppressed the trailing-comment check,
 * displayed the value as `a" # "b`, and let an edit destroy the comment.
 */
const quotedWithComment = '---\ntitle: "a" # "b"\n---\n';
assert.equal(
  format.readFrontmatterBlock(quotedWithComment).entries[0].reason,
  "inline-comment",
  "a comment after a closed quote is still a comment"
);
assert.equal(
  format.setFrontmatterPropertyValue(quotedWithComment, 0, "new").content,
  quotedWithComment,
  "and the comment is not destroyed by an edit"
);
assert.equal(
  format.readFrontmatterBlock('---\ntitle: "a #b"\n---\n').entries[0].value,
  "a #b",
  "a # INSIDE the quotes is part of the value, not a comment"
);

/*
 * A top-level YAML sequence is not a mapping. Reading `- a: 1` as a property
 * keyed `- a` and renaming it destroyed the sequence and left a block that no
 * longer parses.
 */
const topLevelSequence = format.readFrontmatterBlock("---\n- a: 1\n- b: 2\n---\n");
assert.equal(topLevelSequence.partial, true, "a top-level sequence is not a mapping the panel can edit");
assert.deepEqual(topLevelSequence.entries, [], "and it exposes no properties");

/*
 * A block the scanner could not read exposes no entries, so the duplicate check
 * has nothing to compare against — and happily wrote a second `title:`.
 */
assert.equal(
  format.addFrontmatterProperty("---\ntitle: t\nthis line has no colon\n---\n", { key: "title", value: "x" })
    .refusal?.code,
  "complex-value",
  "a block the scanner cannot read is read-only in full, additions included"
);

/*
 * YAML 1.1 reads all of these back as booleans or null, so a TEXT value equal to
 * one of them has to be quoted or the property silently stops being text.
 */
for (const reserved of ["~", "null", "yes", "no", "on", "off", "NaN", "Infinity", "y", "N"]) {
  assert.equal(
    format.setFrontmatterPropertyValue(fixture, 0, reserved).splice.replacement,
    ` "${reserved}"`,
    `${reserved} is a YAML scalar, so writing it as text must quote it`
  );
}

/*
 * A real newline inside a double-quoted scalar adds a LINE to the block, which
 * shifts every offset below it and folds back to a space on read.
 */
assert.equal(
  format.setFrontmatterPropertyValue(fixture, 0, "line1\nline2").splice.replacement,
  ' "line1\\nline2"',
  "a newline in a value is escaped, never emitted literally"
);
assert.equal(
  format.setFrontmatterPropertyValue(fixture, 0, "line1\nline2").content.split("\n").length,
  fixture.split("\n").length,
  "so the block does not gain a line"
);

/* ---------------------------------------------- other authoring conventions */

const singleQuoted = "---\nname: 'Ada''s note'\n---\n";
const singleQuotedModel = format.readFrontmatterBlock(singleQuoted);
assert.equal(singleQuotedModel.entries[0].value, "Ada's note", "single-quoted escaping is '' , not backslash");
assert.equal(
  format.setFrontmatterPropertyValue(singleQuoted, 0, "Ada's other note").splice.replacement,
  " 'Ada''s other note'",
  "a single-quoted value stays single-quoted, with YAML's own escape"
);
assert.equal(
  format.setFrontmatterPropertyType(singleQuoted, 0, "text").splice.replacement,
  " 'Ada''s note'",
  "a type change keeps the block's quoting convention instead of renormalising it"
);

const flowList = "---\ntags: [markdown, preservation]\n---\n";
const flowListModel = format.readFrontmatterBlock(flowList);
assert.equal(flowListModel.entries[0].type, "list", "a flow sequence is a list");
assert.deepEqual(flowListModel.entries[0].value, ["markdown", "preservation"]);
assert.equal(
  format.setFrontmatterPropertyValue(flowList, 0, ["markdown", "properties"]).content,
  "---\ntags: [markdown, properties]\n---\n",
  "a document that writes its lists in flow style keeps writing them that way"
);
assert.equal(
  format.setFrontmatterPropertyValue("---\ntags:\n  - a\n---\n", 0, ["a", "b"]).content,
  "---\ntags:\n  - a\n  - b\n---\n",
  "and a block-style list stays block style"
);

const fourSpaceList = "---\ntags:\n    - a\n    - b\n---\n";
assert.equal(
  format.setFrontmatterPropertyValue(fourSpaceList, 0, ["a", "b", "c"]).splice.replacement,
  "\n    - a\n    - b\n    - c",
  "a list keeps the indentation its own items were written with, not a framework default"
);
assert.equal(
  format.addFrontmatterProperty(fourSpaceList, { key: "authors", type: "list", value: ["ada"] }).splice.replacement,
  "authors:\n    - ada\n",
  "a new list adopts the block's established item indentation"
);

/*
 * Two lists at different indentation in one block: each keeps its own. Reading
 * the indent from the block-level model would rewrite the second list's items
 * to the first list's indentation on an unrelated edit.
 */
const mixedIndentLists = "---\ntags:\n  - a\nowners:\n    - ada\n---\n";
assert.equal(
  format.setFrontmatterPropertyValue(mixedIndentLists, 1, ["ada", "grace"]).splice.replacement,
  "\n    - ada\n    - grace",
  "a list keeps its OWN indentation, not the first list's"
);
assert.equal(
  format.setFrontmatterPropertyValue(mixedIndentLists, 0, ["a", "b"]).splice.replacement,
  "\n  - a\n  - b",
  "the first list keeps its own two-space indentation"
);

const tabbedListDocument = "---\ntitle: T\n---\n";
assert.equal(
  format.addFrontmatterProperty(tabbedListDocument, { key: "tags", type: "list", value: ["a"] }).splice.replacement,
  "tags:\n  - a\n",
  "a block with no list yet falls back to two-space indentation"
);

const emptyValued = "---\ntitle:\n---\n";
const emptyValuedModel = format.readFrontmatterBlock(emptyValued);
assert.equal(emptyValuedModel.entries[0].editable, true, "a key with no value is an empty text property, not a refusal");
assert.equal(emptyValuedModel.entries[0].value, "", "an empty value reads as empty text");
assert.equal(
  format.setFrontmatterPropertyValue(emptyValued, 0, "Filled").content,
  "---\ntitle: Filled\n---\n",
  "filling an empty value writes the separating space"
);

const commentOnlyBlock = format.readFrontmatterBlock("---\n# just a note\n\ntitle: A\n---\n");
assert.equal(commentOnlyBlock.entries.length, 1, "comments and blank lines are skipped, not counted");
assert.equal(commentOnlyBlock.entries[0].key, "title");
assert.equal(commentOnlyBlock.partial, false, "a comment is not an unreadable line");

/* ------------------------------------------- the rich view after a splice */

/*
 * The frontmatter is not part of the ProseMirror document: the rich state keeps
 * the block aside and the targeted serializer slices every gap out of
 * `state.source` using offsets from `state.parseResult`. So a frontmatter splice
 * that changes the block's *length* leaves every one of those offsets stale.
 * Serialize a body edit against a stale state and the output is spliced from the
 * wrong byte positions — silent Markdown corruption, arriving through the
 * Properties panel.
 *
 * `rebaseRichMarkdownSource` is the answer: it re-parses the new bytes while
 * keeping the ProseMirror document (and its undo history) exactly as it is.
 */
const rich = await import("../packages/md-rich-prosemirror/dist/index.js");

const richState = rich.createRichMarkdownState(fixture, { dialect: "momentarise-enhanced" });
assert.equal(
  rich.serializeRichMarkdownState(richState).content,
  fixture,
  "the untouched rich view returns the fixture bytes (Gate 4.5 identity)"
);

const titleSplice = format.setFrontmatterPropertyValue(fixture, 0, "A Much Longer Fixture Title");
const rebased = rich.rebaseRichMarkdownSource(richState, titleSplice.splice);
/*
 * Identity, not `doc.eq`. Structural equality survives a rebase that rebuilds the
 * EditorState from the same doc — which would silently throw away the selection
 * and the whole undo history the rebase's own contract promises to keep.
 */
assert.equal(
  rebased.editorState,
  richState.editorState,
  "a frontmatter rebase must keep the very same EditorState, selection and undo history included"
);
assert.equal(
  rich.serializeRichMarkdownState(rebased).content,
  titleSplice.content,
  "after the rebase the rich view serializes the spliced document byte for byte"
);
assert.equal(
  rebased.source,
  titleSplice.content,
  "the rebased state carries the new bytes as its source of truth"
);
assert.equal(
  rebased.frontmatterSource,
  "---\ntitle: A Much Longer Fixture Title\npriority: 3\npublished: true\ncreated: 2026-08-14\nreviewed: 2026-08-14T09:30:00\ntags:\n  - markdown\n  - preservation\nquoted: \"A value: with a colon\"\n# Reviewers keep this note in the block; the panel must never touch it.\nnested:\n  owner: docs-team\n  stage: draft\nsummary: |\n  A block scalar the panel must never rewrite,\n  because it cannot be spliced safely.\nanchored: &shared reusable\n---",
  "the cached frontmatter source is re-extracted, not carried over"
);

// The defect the rebase exists to prevent, stated as an assertion.
assert.notEqual(
  rich.serializeRichMarkdownState(richState).content,
  titleSplice.content,
  "serializing the pre-splice state must NOT already produce the new bytes, or this rebase proves nothing"
);

const bodyEdited = rich.replaceFirstRichText(rebased, "Properties Fixture", "Properties Panel");
const bodyOutput = rich.serializeRichMarkdownState(bodyEdited).content;
assert.ok(
  bodyOutput.includes("title: A Much Longer Fixture Title\n"),
  "a body edit after a property edit keeps the new property value"
);
assert.ok(bodyOutput.includes("# Properties Panel\n"), "the body edit itself lands");
assert.equal(
  bodyOutput,
  titleSplice.content.replace("# Properties Fixture", "# Properties Panel"),
  "and every other byte of the document — block, comment, anchor, body — is untouched"
);

const richWithoutBlock = rich.createRichMarkdownState(NO_FRONTMATTER, { dialect: "momentarise-enhanced" });
const blockCreation = format.createFrontmatterBlock(NO_FRONTMATTER);
const withBlock = rich.rebaseRichMarkdownSource(richWithoutBlock, blockCreation.splice);
assert.equal(
  rich.serializeRichMarkdownState(withBlock).content,
  blockCreation.content,
  "creating the block from nothing rebases the same way"
);
assert.equal(
  rich.serializeRichMarkdownState(rich.replaceFirstRichText(withBlock, "Plain Document", "Titled Document")).content,
  "---\ntitle: \n---\n\n# Titled Document\n\nNo YAML block here.\n",
  "and a body edit afterwards writes below the freshly created block"
);

assert.throws(
  () => rich.rebaseRichMarkdownSource(richState, { from: fixture.indexOf("# Properties Fixture"), replacement: "x", to: fixture.length }),
  /frontmatter/i,
  "a splice reaching into the body is a programming error, not a silent no-op: the ProseMirror document owns those bytes"
);

/*
 * The footnote insertion baseline is a snapshot of the same bytes taken earlier.
 * Left stale across a frontmatter splice it reintroduces the OLD block on the
 * next footnote insertion — the defect the code comment names, and which nothing
 * proved until this leg.
 */
const withBaseline = { ...richState, footnoteInsertionBaseSource: fixture };
const rebasedBaseline = rich.rebaseRichMarkdownSource(withBaseline, titleSplice.splice);
assert.equal(
  rebasedBaseline.footnoteInsertionBaseSource,
  titleSplice.content,
  "a baseline carrying the replaced bytes receives the same splice"
);
const foreignBaseline = { ...richState, footnoteInsertionBaseSource: "# Some other document entirely\n" };
assert.equal(
  rich.rebaseRichMarkdownSource(foreignBaseline, titleSplice.splice).footnoteInsertionBaseSource,
  "# Some other document entirely\n",
  "a baseline that does NOT carry those bytes is left alone rather than spliced blind"
);
assert.equal(
  rich.rebaseRichMarkdownSource(richState, titleSplice.splice).footnoteInsertionBaseSource,
  undefined,
  "and a state with no baseline does not grow one"
);

/* --------------------------------------- `---` at the start of the document */

/*
 * Obsidian's fourth interaction: typing `---` at the very start of a note
 * creates the Properties block. The rule ships in the DEFAULT rule set —
 * `richInputRuleIds` carries it — because a rule a host has to opt into by id
 * is the reachability defect this project keeps paying for. The frontmatter
 * block lives outside the ProseMirror document, so the host supplies the sink.
 */
assert.ok(
  rich.richInputRuleIds.includes("frontmatterBlock"),
  "the frontmatter rule is a built-in, not something a host has to add"
);

const { TextSelection } = await import("prosemirror-state");

/** Types text character by character through the real input-rule pipeline. */
function typeIntoRich(state, text, caret) {
  let editorState = state.editorState;
  editorState = editorState.apply(editorState.tr.setSelection(TextSelection.create(editorState.doc, caret)));
  for (const character of text) {
    editorState = editorState.applyTransaction(editorState.tr.insertText(character)).state;
  }
  return { ...state, editorState };
}

const richWithSink = (source, onFrontmatterBlockRequested) =>
  rich.createRichMarkdownState(source, {
    dialect: "momentarise-enhanced",
    ...(onFrontmatterBlockRequested ? { preferences: { onFrontmatterBlockRequested } } : {})
  });

const firstBlockCalls = [];
const firstBlock = typeIntoRich(
  richWithSink("Body paragraph.\n\nSecond paragraph.\n", () => {
    firstBlockCalls.push("called");
    return true;
  }),
  "---",
  1
);
assert.deepEqual(firstBlockCalls, ["called"], "`---` in the first block asks the host to create the block");
assert.equal(
  rich.serializeRichMarkdownState(firstBlock).content,
  "Body paragraph.\n\nSecond paragraph.\n",
  "the typed dashes are removed and no horizontal rule is left behind"
);

const laterBlockCalls = [];
const laterBlockState = richWithSink("Body paragraph.\n\nSecond paragraph.\n", () => {
  laterBlockCalls.push("called");
  return true;
});
const secondBlockStart = laterBlockState.editorState.doc.firstChild.nodeSize + 1;
const laterBlock = typeIntoRich(laterBlockState, "---", secondBlockStart);
assert.deepEqual(laterBlockCalls, [], "`---` in a later block is a horizontal rule, and must not ask");
assert.ok(
  rich.serializeRichMarkdownState(laterBlock).content.includes("\n---\n"),
  "and it still produces the horizontal rule it always did"
);

const refusedCalls = [];
const refused = typeIntoRich(
  richWithSink("Body paragraph.\n", () => {
    refusedCalls.push("called");
    return false;
  }),
  "---",
  1
);
assert.deepEqual(refusedCalls, ["called"], "a refusing host is still asked");
assert.ok(
  rich.serializeRichMarkdownState(refused).content.startsWith("---"),
  "when the host refuses — a block already exists — `---` falls through to the horizontal rule"
);

const noSink = typeIntoRich(richWithSink("Body paragraph.\n", null), "---", 1);
assert.ok(
  rich.serializeRichMarkdownState(noSink).content.startsWith("---"),
  "a host with no frontmatter surface keeps the old horizontal-rule behaviour exactly"
);

/*
 * The rule is not merely inert for that host — it is not in the rule set at all.
 * An enabled rule that can never fire is an inert affordance: the writer types
 * `---`, expects a Properties block, gets nothing, and cannot know why. Gating on
 * the sink also means the rule activates by itself the moment a host provides
 * one, rather than waiting for someone to remember to re-enable it.
 *
 * Observed through the rule's own precedence: `frontmatterBlock` is ordered
 * ahead of `horizontalRule`, so disabling `horizontalRule` on a sink-less host
 * must leave `---` completely unhandled. If the frontmatter rule were still in
 * the set, it would be reached and would swallow the input.
 */
const noSinkNoRule = typeIntoRich(
  rich.createRichMarkdownState("Body paragraph.\n", {
    dialect: "momentarise-enhanced",
    preferences: { inputRules: { disable: ["horizontalRule"] } }
  }),
  "---",
  1
);
assert.equal(
  rich.serializeRichMarkdownState(noSinkNoRule).content,
  "---Body paragraph.\n",
  "with no sink and no horizontal-rule rule, `---` stays literal text: nothing handled it"
);

// The same document WITH a sink is handled, which is what makes the line above
// evidence about the frontmatter rule rather than about the disabled one.
const sinkNoRuleCalls = [];
const sinkNoRule = typeIntoRich(
  rich.createRichMarkdownState("Body paragraph.\n", {
    dialect: "momentarise-enhanced",
    preferences: {
      inputRules: { disable: ["horizontalRule"] },
      onFrontmatterBlockRequested: () => {
        sinkNoRuleCalls.push("called");
        return true;
      }
    }
  }),
  "---",
  1
);
assert.deepEqual(sinkNoRuleCalls, ["called"], "supplying the sink puts the rule back in the set, with no other change");
assert.equal(
  rich.serializeRichMarkdownState(sinkNoRule).content,
  "Body paragraph.\n",
  "and the typed dashes are consumed by it"
);

/* ==========================================================================
 * The panel.
 *
 * Obsidian's Properties is the benchmark named in the issue, and the contract
 * is the *interaction set*, not the look: six value types with type-appropriate
 * inputs behind a clickable type icon, three display states, an add shortcut, a
 * delete shortcut on the focused property, and complex values shown read-only
 * with a route into Source mode.
 * ========================================================================== */

const { JSDOM } = await import("jsdom");
const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true });
const documentRef = dom.window.document;
const { createMarkdownEditorSession } = await import("../packages/md-editor/dist/index.js");
const { createMemorySaveTarget } = await import("../packages/md-save/dist/index.js");
const surface = await import("../packages/md-surface/dist/index.js");
const { defaultIconSet } = await import("../packages/md-theme/dist/index.js");

for (const exportName of ["createPropertiesPanel", "surfacePropertyRowsFromFrontmatter"]) {
  assert.ok(exportName in surface, `@momentarise/md-surface must export ${exportName}`);
}

const session = createMarkdownEditorSession({
  content: fixture,
  scheduler: { cancel() {}, schedule: (run) => { run(); return 0; } },
  target: createMemorySaveTarget({ initialContent: fixture })
});

/** The host maps the md-format model into rows; the panel never parses YAML itself. */
const rowsFromSource = (source) => surface.surfacePropertyRowsFromFrontmatter(format.readFrontmatterBlock(source));

function mountPanel(overrides = {}) {
  const host = documentRef.createElement("div");
  documentRef.body.append(host);
  const events = [];
  const state = {
    display: "visible",
    present: true,
    properties: rowsFromSource(fixture),
    source: format.readFrontmatterBlock(fixture).raw,
    ...overrides
  };
  const panel = surface.createPropertiesPanel({
    host,
    icons: defaultIconSet,
    onAddProperty: () => events.push({ type: "add" }),
    onChangeDisplay: (display) => events.push({ display, type: "display" }),
    onChangeType: (event) => events.push({ ...event, type: "type" }),
    onChangeValue: (event) => events.push({ ...event, type: "value" }),
    onEditInSource: (event) => events.push({ ...event, type: "edit-in-source" }),
    onRemoveProperty: (event) => events.push({ ...event, type: "remove" }),
    onRenameProperty: (event) => events.push({ ...event, type: "rename" }),
    preferences: { aiEntryPoints: [] },
    session,
    state,
    strings: surface.defaultMmeStrings
  });
  return { events, host, panel };
}

const query = (host, testId) => host.querySelector(`[data-testid="${testId}"]`);
const queryAll = (host, testId) => [...host.querySelectorAll(`[data-testid="${testId}"]`)];
const rowAt = (host, index) => host.querySelector(`[data-testid="property-row"][data-property-index="${index}"]`);
const fire = (element, type, init = {}) => element.dispatchEvent(new dom.window.Event(type, { bubbles: true, ...init }));
const key = (element, init) =>
  element.dispatchEvent(new dom.window.KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }));

/* ------------------------------------------- rows map the model, in order */

const mounted = mountPanel();
const rows = queryAll(mounted.host, "property-row");
assert.equal(rows.length, 10, "one row per property, including the read-only ones");
assert.deepEqual(
  rows.map((row) => query(row, "property-key").value),
  ["title", "priority", "published", "created", "reviewed", "tags", "quoted", "nested", "summary", "anchored"],
  "rows keep the block's own key order — the panel must never sort"
);
assert.deepEqual(
  rows.map((row) => row.dataset.propertyType),
  ["text", "number", "checkbox", "date", "datetime", "list", "text", "text", "text", "text"],
  "each row is labelled with its own type"
);

/* -------------------------------------- six types, six type-appropriate inputs */

assert.equal(query(rowAt(mounted.host, 0), "property-value").type, "text", "text uses a text input");
assert.equal(query(rowAt(mounted.host, 1), "property-value").type, "number", "number uses a number input");
assert.equal(query(rowAt(mounted.host, 2), "property-value").type, "checkbox", "checkbox uses a checkbox");
assert.equal(query(rowAt(mounted.host, 3), "property-value").type, "date", "date uses a date input");
assert.equal(
  query(rowAt(mounted.host, 4), "property-value").type,
  "datetime-local",
  "date & time uses a datetime-local input"
);
assert.equal(
  query(rowAt(mounted.host, 5), "property-value"),
  null,
  "a list is not a single input: it renders chips"
);
assert.deepEqual(
  queryAll(rowAt(mounted.host, 5), "property-chip").map((chip) => chip.dataset.chipValue),
  ["markdown", "preservation"],
  "each list item is its own chip"
);
assert.equal(query(rowAt(mounted.host, 0), "property-value").value, "Properties Fixture", "the text value is shown");
assert.equal(query(rowAt(mounted.host, 1), "property-value").value, "3");
assert.equal(query(rowAt(mounted.host, 2), "property-value").checked, true, "a true checkbox renders checked");
assert.equal(query(rowAt(mounted.host, 3), "property-value").value, "2026-08-14");

/* ------------------------------------------------- the clickable type icon */

const typeButton = query(rowAt(mounted.host, 0), "property-type-button");
assert.equal(typeButton.getAttribute("aria-haspopup"), "menu", "the type icon opens a menu");
assert.equal(typeButton.getAttribute("aria-expanded"), "false");
assert.ok(typeButton.getAttribute("title").toLowerCase().includes("text"), "the type icon names its own type");
assert.notEqual(
  query(rowAt(mounted.host, 7), "property-type-button").title,
  typeButton.getAttribute("title"),
  "a read-only row must not carry the same type label as an editable text row"
);
assert.equal(query(mounted.host, "property-type-menu"), null, "the menu is closed until the icon is clicked");
typeButton.click();
assert.equal(
  query(rowAt(mounted.host, 0), "property-type-button").getAttribute("aria-expanded"),
  "true",
  "clicking the icon opens the menu"
);
const typeOptions = queryAll(mounted.host, "property-type-option");
assert.deepEqual(
  typeOptions.map((option) => option.dataset.propertyType),
  ["text", "list", "number", "checkbox", "date", "datetime"],
  "the menu offers exactly the six benchmark types"
);
assert.deepEqual(
  typeOptions.map((option) => option.getAttribute("aria-checked")),
  ["true", "false", "false", "false", "false", "false"],
  "the open menu marks the type the property already is"
);
assert.deepEqual(
  typeOptions.map((option) => option.getAttribute("role")),
  Array.from({ length: 6 }, () => "menuitemradio"),
  "`aria-checked` is not a supported state on `menuitem`, so the role has to be `menuitemradio`"
);

typeOptions[2].click();
assert.deepEqual(
  mounted.events.at(-1),
  { index: 0, propertyType: "number", type: "type" },
  "choosing a type reports the property and the chosen type"
);
assert.equal(query(mounted.host, "property-type-menu"), null, "choosing a type closes the menu");

query(rowAt(mounted.host, 0), "property-type-button").click();
assert.ok(query(mounted.host, "property-type-menu"), "the menu reopens");
assert.equal(
  documentRef.activeElement?.dataset.testid,
  "property-type-option",
  "opening the menu moves focus into it: a menu that announces itself as a menu has to behave like one"
);
key(documentRef.activeElement, { key: "ArrowDown" });
assert.equal(documentRef.activeElement?.dataset.propertyType, "list", "ArrowDown moves to the next type");
key(documentRef.activeElement, { key: "End" });
assert.equal(documentRef.activeElement?.dataset.propertyType, "datetime", "End jumps to the last type");
key(documentRef.activeElement, { key: "Home" });
assert.equal(documentRef.activeElement?.dataset.propertyType, "text", "Home jumps back to the first");
key(documentRef.activeElement, { key: "Escape" });
assert.equal(query(mounted.host, "property-type-menu"), null, "Escape closes the type menu");
assert.equal(
  documentRef.activeElement?.dataset.testid,
  "property-type-button",
  "and focus returns to the trigger rather than being dropped on the document"
);

query(rowAt(mounted.host, 0), "property-type-button").click();
assert.ok(query(mounted.host, "property-type-menu"), "precondition: open");
query(rowAt(mounted.host, 0), "property-type-button").click();
assert.equal(
  query(mounted.host, "property-type-menu"),
  null,
  "clicking the trigger again closes the menu it opened"
);

/*
 * Each of these covers a mutant the reviewer measured as surviving: an
 * `aria-pressed` that is always "true", an `aria-expanded` that opens every row
 * at once, a checkbox hardcoded checked, a raw value trimmed with `trimStart`
 * (which mangles a nested map), an unmarked `aria-checked`, and one icon
 * rendered for every type while the benchmark calls the type icon a criterion.
 */
assert.deepEqual(
  ["properties-display-visible", "properties-display-hidden", "properties-display-source"].map((testId) =>
    query(mounted.host, testId).getAttribute("aria-pressed")
  ),
  ["true", "false", "false"],
  "exactly one display state reports itself as pressed"
);
assert.deepEqual(
  queryAll(mounted.host, "property-type-button").map((button) => button.getAttribute("aria-expanded")),
  Array.from({ length: 10 }, () => "false"),
  "with no menu open, no row claims to be expanded"
);
const falseCheckbox = mountPanel({
  properties: rowsFromSource(format.setFrontmatterPropertyValue(fixture, 2, false).content)
});
assert.equal(
  query(rowAt(falseCheckbox.host, 2), "property-value").checked,
  false,
  "a false checkbox renders unchecked \u2014 the panel must read the value, not assume it"
);
assert.equal(
  query(rowAt(mounted.host, 7), "property-raw-value").textContent,
  "\n  owner: docs-team\n  stage: draft",
  "a nested map's raw display keeps its leading newline and indentation: only the separating space is dropped"
);
/** jsdom rewrites self-closing SVG tags, so both sides go through the parser. */
const normalizeMarkup = (markup) => {
  const holder = documentRef.createElement("div");
  holder.innerHTML = markup;
  return holder.innerHTML;
};
assert.deepEqual(
  queryAll(mounted.host, "property-type-button").slice(0, 7).map((button) => button.innerHTML),
  ["propertyText", "propertyNumber", "propertyCheckbox", "propertyDate", "propertyDatetime", "list", "propertyText"].map(
    (icon) => normalizeMarkup(defaultIconSet.render(icon))
  ),
  "each editable row renders ITS OWN type glyph \u2014 the icon is the only place a row's type is shown"
);
assert.equal(
  new Set(queryAll(mounted.host, "property-type-button").slice(0, 6).map((button) => button.innerHTML)).size,
  6,
  "and the six types are six distinguishable glyphs, not one glyph six times"
);

/* ------------------------------------------------------- editing a value */

const titleInput = query(rowAt(mounted.host, 0), "property-value");
titleInput.value = "Edited In The Panel";
fire(titleInput, "change");
assert.deepEqual(
  mounted.events.at(-1),
  { index: 0, type: "value", value: "Edited In The Panel" },
  "committing a text value reports the property index and the new string"
);

titleInput.value = "Not committed yet";
fire(titleInput, "input");
assert.notEqual(
  mounted.events.at(-1).value,
  "Not committed yet",
  "typing must not rewrite the file on every keystroke: the commit is `change`, not `input`"
);

const numberInput = query(rowAt(mounted.host, 1), "property-value");
numberInput.value = "9";
fire(numberInput, "change");
assert.deepEqual(
  mounted.events.at(-1),
  { index: 1, type: "value", value: 9 },
  "a number input reports a number, not the string the DOM holds"
);

numberInput.value = "";
fire(numberInput, "change");
assert.deepEqual(
  mounted.events.at(-1),
  { index: 1, type: "value", value: "" },
  "clearing a number field clears the property; it must not silently write 0"
);
numberInput.value = "4.5";
fire(numberInput, "change");
assert.deepEqual(
  mounted.events.at(-1),
  { index: 1, type: "value", value: 4.5 },
  "a decimal survives: the commit must not round through parseInt"
);

const checkboxInput = query(rowAt(mounted.host, 2), "property-value");
checkboxInput.checked = false;
fire(checkboxInput, "change");
assert.deepEqual(
  mounted.events.at(-1),
  { index: 2, type: "value", value: false },
  "a checkbox reports a boolean"
);

/* ------------------------------------------------------------- list chips */

const listRow = rowAt(mounted.host, 5);
queryAll(listRow, "property-chip-remove")[0].click();
assert.deepEqual(
  mounted.events.at(-1),
  { index: 5, type: "value", value: ["preservation"] },
  "removing a chip reports the remaining items, in order"
);
const chipInput = query(listRow, "property-chip-input");
chipInput.value = "properties";
key(chipInput, { key: "Enter" });
assert.deepEqual(
  mounted.events.at(-1),
  { index: 5, type: "value", value: ["markdown", "preservation", "properties"] },
  "Enter in the chip input appends an item"
);
assert.equal(chipInput.value, "", "a committed chip clears its input, or the next Enter duplicates it");
chipInput.value = "   ";
key(chipInput, { key: "Enter" });
assert.notDeepEqual(
  mounted.events.at(-1).value,
  ["markdown", "preservation", "   "],
  "a blank chip is not added"
);

/* -------------------------------------------------- read-only complex rows */

for (const [index, reason] of [[7, "nested-map"], [8, "block-scalar"], [9, "anchor-or-tag"]]) {
  const row = rowAt(mounted.host, index);
  assert.equal(row.dataset.propertyEditable, "false", `property ${index} is marked read-only`);
  assert.equal(query(row, "property-value"), null, `property ${index} offers no value input`);
  assert.ok(query(row, "property-raw-value"), `property ${index} shows its raw source instead`);
  assert.equal(row.dataset.propertyReason, reason, `property ${index} states why it is read-only`);
  assert.ok(
    query(row, "property-type-button").disabled,
    `property ${index}: the type of a value that cannot be rewritten cannot be changed either`
  );
  assert.equal(
    query(row, "property-type-button").title,
    surface.defaultMmeStrings.properties.reasons[reason],
    `property ${index}: a read-only row must state why, not claim a type the engine never determined`
  );
}
assert.equal(
  query(rowAt(mounted.host, 8), "property-raw-value").textContent,
  "|\n  A block scalar the panel must never rewrite,\n  because it cannot be spliced safely.",
  "the raw display shows the authored bytes, not a summary of them"
);
query(rowAt(mounted.host, 7), "property-edit-in-source").click();
assert.deepEqual(
  mounted.events.at(-1),
  { index: 7, type: "edit-in-source" },
  "the read-only affordance routes the writer to Source mode"
);

/* ------------------------------------------------------- rename and remove */

const keyInput = query(rowAt(mounted.host, 0), "property-key");
keyInput.value = "headline";
fire(keyInput, "change");
assert.deepEqual(mounted.events.at(-1), { index: 0, key: "headline", type: "rename" });

query(rowAt(mounted.host, 1), "property-remove").click();
assert.deepEqual(mounted.events.at(-1), { index: 1, type: "remove" });

/* ------------------------------------------------------------- shortcuts */

query(mounted.host, "properties-add").click();
assert.deepEqual(mounted.events.at(-1), { type: "add" }, "the add control adds a property");

const addEvent = new dom.window.KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: ";", metaKey: true });
query(rowAt(mounted.host, 3), "property-value").dispatchEvent(addEvent);
assert.deepEqual(mounted.events.at(-1), { type: "add" }, "Cmd+; adds a property (Obsidian's shortcut)");
assert.equal(
  addEvent.defaultPrevented,
  true,
  "the shortcut consumes the event, or the browser's own binding fires as well"
);
key(query(rowAt(mounted.host, 3), "property-value"), { key: ";", ctrlKey: true });
assert.deepEqual(mounted.events.at(-1), { type: "add" }, "Ctrl+; is the same shortcut off macOS");

const deleteEvent = new dom.window.KeyboardEvent("keydown", {
  bubbles: true,
  cancelable: true,
  key: "Backspace",
  metaKey: true
});
query(rowAt(mounted.host, 4), "property-value").dispatchEvent(deleteEvent);
assert.deepEqual(
  mounted.events.at(-1),
  { index: 4, type: "remove" },
  "Cmd+Backspace deletes the property the focus is in, not the first one"
);
assert.equal(
  deleteEvent.defaultPrevented,
  true,
  "and it consumes the event, or it also deletes a character from the focused field"
);
key(query(rowAt(mounted.host, 6), "property-key"), { key: "Backspace", ctrlKey: true });
assert.deepEqual(
  mounted.events.at(-1),
  { index: 6, type: "remove" },
  "the delete shortcut works from the key field too"
);
const plainBackspace = mounted.events.length;
key(query(rowAt(mounted.host, 6), "property-key"), { key: "Backspace" });
assert.equal(mounted.events.length, plainBackspace, "a plain Backspace edits text; it must not delete the property");

/* --------------------------------------------------- three display states */

for (const [testId, display] of [
  ["properties-display-visible", "visible"],
  ["properties-display-hidden", "hidden"],
  ["properties-display-source", "source"]
]) {
  const control = query(mounted.host, testId);
  assert.ok(control, `the panel offers the "${display}" display state`);
  control.click();
  assert.deepEqual(mounted.events.at(-1), { display, type: "display" });
}
assert.equal(
  query(mounted.host, "properties-display-visible").getAttribute("aria-pressed"),
  "true",
  "the active display state is reported to assistive technology"
);

const sourceMode = mountPanel({ display: "source" });
assert.equal(
  query(sourceMode.host, "properties-source").textContent,
  format.readFrontmatterBlock(fixture).raw,
  "the source display shows the block's own bytes"
);
assert.equal(queryAll(sourceMode.host, "property-row").length, 0, "the source display replaces the rows");

const hiddenMode = mountPanel({ display: "hidden" });
assert.equal(queryAll(hiddenMode.host, "property-row").length, 0, "the hidden display renders no rows");
assert.equal(query(hiddenMode.host, "properties-source"), null, "the hidden display shows no YAML either");
assert.ok(
  query(hiddenMode.host, "properties-display-visible"),
  "the hidden display keeps a way back, or the properties become unreachable"
);

/* ------------------------------------------------ no frontmatter, no panel */

const absent = mountPanel({ present: false, properties: [], source: "" });
assert.equal(queryAll(absent.host, "property-row").length, 0, "a document with no frontmatter shows no rows");
assert.equal(query(absent.host, "properties-surface").hidden, true, "and the panel itself is hidden, not an empty frame");
assert.equal(
  query(absent.host, "properties-add"),
  null,
  "there is nothing to add to: creating the block is an explicit action elsewhere"
);

/* --------------------------------------------- focus survives a re-render */

const focusHost = mountPanel();
/*
 * Row 0 (a text input), not row 3: `date` and `number` inputs throw in
 * `setSelectionRange`, so a caret assertion on them lands in the empty catch and
 * proves nothing about caret restoration.
 */
const focusTarget = query(rowAt(focusHost.host, 0), "property-value");
focusTarget.focus();
focusTarget.setSelectionRange(4, 4);
assert.equal(documentRef.activeElement, focusTarget, "precondition: the value field has focus");
focusHost.panel.setState({
  display: "visible",
  present: true,
  properties: rowsFromSource(format.setFrontmatterPropertyValue(fixture, 3, "2026-09-09").content),
  source: format.readFrontmatterBlock(fixture).raw
});
assert.equal(
  documentRef.activeElement?.dataset.testid,
  "property-value",
  "after the host applies the edit and re-renders, focus stays in a value field"
);
assert.equal(
  documentRef.activeElement.closest("[data-testid='property-row']").dataset.propertyIndex,
  "0",
  "and in the SAME property's field, not dumped at the top of the panel"
);
assert.equal(
  documentRef.activeElement.selectionStart,
  4,
  "with the caret where the writer left it, not collapsed to the start"
);
assert.equal(query(rowAt(focusHost.host, 3), "property-value").value, "2026-09-09", "the re-render shows the new value");

/* ----------------------------------------------------------------- destroy */

const disposable = mountPanel();
assert.ok(query(disposable.host, "properties-surface"), "precondition: mounted");
disposable.panel.destroy();
assert.equal(query(disposable.host, "properties-surface"), null, "destroy removes the panel from the host");
assert.equal(disposable.host.childNodes.length, 0, "and leaves nothing behind");

console.log("MME-0090 frontmatter engine: all assertions passed.");
