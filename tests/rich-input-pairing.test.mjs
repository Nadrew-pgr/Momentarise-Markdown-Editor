/**
 * MME-0104b — smart pairing and paste-URL-to-link.
 *
 * The harness drives `handleTextInput`, `handleKeyDown` and `handlePaste` — the
 * view-level props — because that is where pairing lives. The previous attempt
 * at this issue was undone by a harness that drove `tr.insertText` only, which
 * bypasses `handleTextInput` entirely: an empty pairing implementation passed
 * every assertion.
 *
 * `typeThroughInputPath` mirrors ProseMirror's own flow: offer the character to
 * each plugin's `handleTextInput`, and insert it only if none handled it. That
 * is what makes removing pairing fail these assertions instead of hiding —
 * without a handler the opening character is still typed, and the closing one is
 * simply absent.
 */

const rich = await import("../packages/md-rich-prosemirror/dist/index.js");
const { TextSelection } = await import("prosemirror-state");
const { Fragment, Slice } = await import("prosemirror-model");

const failures = [];

// --- pairing ---------------------------------------------------------------

for (const [opening, closing] of [
  ["(", ")"],
  ["[", "]"],
  ["{", "}"],
  ['"', '"'],
  ["'", "'"],
  ["`", "`"]
]) {
  check(`typing ${JSON.stringify(opening)} inserts its closing character`, () => {
    const state = typeThroughInputPath(rich.createRichMarkdownState(""), opening);
    assertBlockText(state, `${opening}${closing}`, `pair ${opening}`);
    assertCaretOffset(state, 1, `pair ${opening}`);
  });
}

check("typing the closing character steps over the auto-inserted one", () => {
  const state = typeThroughInputPath(rich.createRichMarkdownState(""), "(x)");
  assertBlockText(state, "(x)", "step over");
  assertCaretOffset(state, 3, "step over");
});

check("the step-over position survives intervening keystrokes", () => {
  // The recorded position must be mapped through the edits between the opening
  // character and the closing one, or `(xy)` becomes `(xy))`.
  const state = typeThroughInputPath(rich.createRichMarkdownState(""), "(xyz)");
  assertBlockText(state, "(xyz)", "step over after several edits");
});

check("nested pairs step over in the right order", () => {
  const state = typeThroughInputPath(rich.createRichMarkdownState(""), "([a])");
  assertBlockText(state, "([a])", "nested step over");
});

check("a closing character with no auto-inserted partner is typed literally", () => {
  const state = typeThroughInputPath(rich.createRichMarkdownState(""), "a)");
  assertBlockText(state, "a)", "unmatched closing character");
});

check("Backspace between an empty pair deletes both characters", () => {
  const opened = typeThroughInputPath(rich.createRichMarkdownState(""), "(");
  assertBlockText(opened, "()", "pair before Backspace");
  const { handled, state } = pressKeyThroughInputPath(opened, "Backspace");
  if (!handled) {
    throw new Error("Backspace between an empty pair was not handled, so both characters were not deleted.");
  }
  assertBlockText(state, "", "Backspace between an empty pair");
});

check("Backspace outside a pair is left to the editor", () => {
  /*
   * Deleting one ordinary character is contentEditable's job, not a command's,
   * so the assertion is that pairing does not intercept it — asserting the
   * deletion itself would be asserting the browser.
   */
  const typed = typeThroughInputPath(rich.createRichMarkdownState(""), "ab");
  const { handled, state } = pressKeyThroughInputPath(typed, "Backspace");
  if (handled) {
    throw new Error("Backspace outside a pair must not be intercepted by pairing.");
  }
  assertBlockText(state, "ab", "Backspace outside a pair leaves the document to the editor");
});

check("Backspace before a closing character that is not empty is left alone", () => {
  const typed = typeThroughInputPath(rich.createRichMarkdownState(""), "(ab");
  const { handled } = pressKeyThroughInputPath(typed, "Backspace");
  if (handled) {
    throw new Error("Backspace must only delete a pair when the pair is empty.");
  }
});

check("Backspace after an opening character with content after it deletes only one", () => {
  /*
   * The caret sits between `(` and `x`, so the pair is not empty. Checking only
   * that the character before is an opener would delete the `x` as well —
   * silent data loss one keystroke wide.
   */
  const selected = rich.selectFirstRichText(rich.createRichMarkdownState("(x)\n"), "(x)");
  const caret = caretAt(selected, selected.editorState.selection.from + 1);
  const { handled, state } = pressKeyThroughInputPath(caret, "Backspace");
  if (handled) {
    throw new Error("Backspace must not collapse a pair that has content between its characters.");
  }
  assertBlockText(state, "(x)", "Backspace between an opener and content");
});

check("brackets pair inside a code block", () => {
  const fence = typeThroughInputPath(rich.createRichMarkdownState(""), "```js ");
  const state = typeThroughInputPath(fence, "(");
  assertBlockText(state, "()", "bracket inside a code block");
});

check("quotes do not pair inside a code block", () => {
  const fence = typeThroughInputPath(rich.createRichMarkdownState(""), "```js ");
  const state = typeThroughInputPath(fence, '"');
  assertBlockText(state, '"', "quote inside a code block");
});

check("a quote does not pair directly after a word character", () => {
  // Without this, typing `don't` produces `don''t`.
  const state = typeThroughInputPath(rich.createRichMarkdownState(""), "don't");
  assertBlockText(state, "don't", "apostrophe inside a word");
});

check("a bracket does not pair directly before a word character", () => {
  const selected = rich.selectFirstRichText(rich.createRichMarkdownState("word\n"), "word");
  const caret = caretAt(selected, selected.editorState.selection.from);
  const state = typeThroughInputPath(caret, "(");
  assertBlockText(state, "(word", "bracket before a word");
});

check("pairing does not rewrite untouched neighbours", () => {
  /*
   * The pair is left OPEN on purpose. Typing `" (note)"` produces the same bytes
   * with and without pairing, because the step-over makes the paired output
   * equal the literal one — so the closed form cannot tell the two apart. Typing
   * `" (note"` can: without pairing there is no `)` at all.
   */
  const selected = rich.selectFirstRichText(rich.createRichMarkdownState("Alpha\n\nBravo\n\nCharlie\n"), "Bravo");
  const caret = caretAt(selected, selected.editorState.selection.to);
  const state = typeThroughInputPath(caret, " (note");
  assertSerialized(state, "Alpha\n\nBravo (note)\n\nCharlie\n", "neighbours after pairing");
});

check("typing an opening character over a selection does not pair", () => {
  /*
   * The acceptance criterion "pairing never rewrites bytes the user did not
   * type". Replacing a selection is the user's own edit, so the character is
   * typed plainly; wrapping or inserting a closer here would rewrite text they
   * did not ask to keep.
   */
  /*
   * The selection must start with a non-word character, or the "do not pair
   * before a word" guard refuses first and this never reaches the guard it is
   * meant to protect.
   */
  const selected = rich.selectFirstRichText(rich.createRichMarkdownState("Read the -docs- today.\n"), "-docs-");
  const state = typeThroughInputPath(selected, "(");
  assertSerialized(state, "Read the ( today.\n", "opening character over a selection");
});

check("quotes do not pair inside an inline code span", () => {
  // Two spaces so the caret has neither a word character after it nor one
  // before it: the context gate is then the only guard that can refuse.
  const selected = rich.selectFirstRichText(rich.createRichMarkdownState("`abc  def`\n"), "abc  def");
  const caret = caretAt(selected, selected.editorState.selection.from + 4);
  const state = typeThroughInputPath(caret, '"');
  assertBlockText(state, 'abc " def', "quote inside an inline code span");
});

check("Backspace does not collapse a hand-typed pair inside a code block", () => {
  const fence = typeThroughInputPath(rich.createRichMarkdownState(""), "```js ");
  const typed = typeThroughInputPath(fence, '""');
  assertBlockText(typed, '""', "hand-typed quotes inside a code block");
  const caret = caretAt(typed, typed.editorState.selection.from - 1);
  const { handled } = pressKeyThroughInputPath(caret, "Backspace");
  if (handled) {
    throw new Error("Backspace must not collapse a pair the plugin would never have created.");
  }
});

for (const modifier of ["metaKey", "ctrlKey", "altKey"]) {
  check(`${modifier} + Backspace is not stolen by the pair collapse`, () => {
    // Delete-word and delete-to-line-start must reach their own handlers.
    const opened = typeThroughInputPath(rich.createRichMarkdownState(""), "(");
    const { handled } = pressKeyThroughInputPath(opened, "Backspace", modifier);
    if (handled) {
      throw new Error(`${modifier} + Backspace must not be treated as a pair collapse.`);
    }
  });
}

check("backtick pairing still lets the inline-code rule fire", () => {
  /*
   * The interaction the previous attempt recorded. With pairing, the closing
   * backtick is inserted ahead of the caret, so the inline-code rule never sees
   * a closing delimiter before the caret, and the step-over is a selection-only
   * change that `appendTransaction` skips. Without an explicit re-trigger, this
   * shipped rule silently stops working the moment pairing lands.
   */
  const state = typeThroughInputPath(rich.createRichMarkdownState(""), "`code`");
  assertInlineNodes(state, [["code", ["code"]]], "inline code through pairing");
  assertSerialized(state, "`code`\n", "inline code through pairing");
});

// --- paste URL over a selection --------------------------------------------

check("pasting a URL over a selection wraps it as a Markdown link", () => {
  const state = pasteThroughInputPath(
    rich.selectFirstRichText(rich.createRichMarkdownState("Read the docs today.\n"), "docs"),
    "https://example.com"
  );
  assertSerialized(state, "Read the [docs](https://example.com) today.\n", "paste over a selection");
  assertHasLink(state, "https://example.com", "docs", "paste over a selection");
});

check("pasting a URL with no selection inserts a plain link", () => {
  const selected = rich.selectFirstRichText(rich.createRichMarkdownState("Read this.\n"), "this");
  const caret = caretAt(selected, selected.editorState.selection.to);
  const state = pasteThroughInputPath(caret, "https://example.com");
  assertSerialized(state, "Read this[https://example.com](https://example.com).\n", "paste with no selection");
  assertHasLink(state, "https://example.com", "https://example.com", "paste with no selection");
});

check("pasting a non-URL over a selection keeps the replace behaviour", () => {
  const state = pasteThroughInputPath(
    rich.selectFirstRichText(rich.createRichMarkdownState("Read the docs today.\n"), "docs"),
    "manual"
  );
  assertSerialized(state, "Read the manual today.\n", "non-URL paste");
});

check("an unsafe scheme is never turned into a link", () => {
  const state = pasteThroughInputPath(
    rich.selectFirstRichText(rich.createRichMarkdownState("Read the docs today.\n"), "docs"),
    "javascript:alert(1)"
  );
  assertNoLink(state, "unsafe scheme");
  // Asserting the document too: "no link mark" alone cannot tell a fall-through
  // to the default replace from the paste being swallowed entirely.
  assertSerialized(state, "Read the javascript:alert(1) today.\n", "unsafe scheme");
});

check("a URL the serializer cannot represent is not turned into a link", () => {
  /*
   * `[docs](https://x.example/#a)b)` re-parses with the href truncated at the
   * first `)` and `b)` left as stray text — stable bytes, a different document.
   * Representability is part of the URL definition, so this falls through to the
   * plain paste, exactly as it did before this issue.
   */
  const state = pasteThroughInputPath(
    rich.selectFirstRichText(rich.createRichMarkdownState("Read the docs today.\n"), "docs"),
    "https://x.example/#a)b"
  );
  assertNoLink(state, "unbalanced parentheses");
  assertSerialized(state, "Read the https://x.example/#a)b today.\n", "unbalanced parentheses");

  // The other direction: an unclosed `(` comes back with a `)` appended.
  const unclosed = pasteThroughInputPath(
    rich.selectFirstRichText(rich.createRichMarkdownState("Read the docs today.\n"), "docs"),
    "https://x.example/a(b"
  );
  assertNoLink(unclosed, "unbalanced opening parenthesis");
  assertSerialized(unclosed, "Read the https://x.example/a(b today.\n", "unbalanced opening parenthesis");
});


check("a URL with balanced parentheses is linked and round-trips", () => {
  const state = pasteThroughInputPath(
    rich.selectFirstRichText(rich.createRichMarkdownState("Read the docs today.\n"), "docs"),
    "https://x.example/Foo_(bar)"
  );
  assertHasLink(state, "https://x.example/Foo_(bar)", "docs", "balanced parentheses");
  const markdown = rich.serializeRichMarkdownState(state).content;
  const reparsed = rich.createRichMarkdownState(markdown);
  assertHasLink({ ...state, editorState: reparsed.editorState }, "https://x.example/Foo_(bar)", "docs", "balanced parentheses round-trip");
});

check("a paste that cannot be a link inside code still lands", () => {
  /*
   * `addMark` is a silent no-op where the parent forbids the mark. Dispatching
   * anyway swallowed the paste: `preventDefault` was called and nothing was
   * inserted, so the user's clipboard vanished — in the preservation-critical
   * contexts specifically.
   */
  const fence = rich.createRichMarkdownState("```js\nconst docs = 1;\n```\n");
  const state = pasteThroughInputPath(rich.selectFirstRichText(fence, "docs"), "https://example.com");
  assertSerialized(state, "```js\nconst https://example.com = 1;\n```\n", "paste inside a code block");
});

check("a paste inside an inline code span still lands", () => {
  /*
   * `addMark` succeeds on a code span in the model, but the serializer emits the
   * code span alone — so accepting the wrap would show the URL on screen and
   * leave it out of the file. Refusing sends it to the default paste, which
   * lands the text. The result is identical to a non-URL paste over the same
   * selection, asserted below, so what remains is the default's own behaviour
   * rather than anything this handler introduces.
   */
  const url = pasteThroughInputPath(
    rich.selectFirstRichText(rich.createRichMarkdownState("A `docs` B\n"), "docs"),
    "https://example.com"
  );
  assertNoLink(url, "paste inside an inline code span");
  assertSerialized(url, "A https://example.com B\n", "paste inside an inline code span");
  const plain = pasteThroughInputPath(
    rich.selectFirstRichText(rich.createRichMarkdownState("A `docs` B\n"), "docs"),
    "manual"
  );
  assertSerialized(plain, "A manual B\n", "non-URL paste inside an inline code span");
});

check("a caret inside an existing link does not create a second link", () => {
  /*
   * The empty-selection form of the "already linked" decision. The default paste
   * still splits the word, which is ordinary paste-inside-a-word behaviour; what
   * must not happen is a *new* link appearing inside the existing one.
   */
  const doc = rich.createRichMarkdownState("Read [docs](https://a.example) today.\n");
  const selected = rich.selectFirstRichText(doc, "docs");
  const caret = caretAt(selected, selected.editorState.selection.from + 2);
  const state = pasteThroughInputPath(caret, "https://example.com");
  const hrefs = [...new Set(linksIn(state).map((link) => link.href))];
  if (JSON.stringify(hrefs) !== JSON.stringify(["https://a.example"])) {
    throw new Error(`caret inside an existing link expected only the original href, got ${JSON.stringify(hrefs)}.`);
  }
});

check("a selection that already contains a link is not wrapped again", () => {
  /*
   * Settled: fall through to the default replace. Wrapping would nest a link
   * inside a link, which has no Markdown representation, and re-pointing the
   * existing link would be an inference about intent — the wrapping feature is
   * aimed at unlinked text. The user replaced a selection, so it is replaced.
   */
  const state = pasteThroughInputPath(
    rich.selectFirstRichText(rich.createRichMarkdownState("Read [docs](https://a.example) today.\n"), "docs"),
    "https://example.com"
  );
  assertSerialized(state, "Read https://example.com today.\n", "selection already linked");
  assertNoLink(state, "selection already linked");
});

check("a selection spanning blocks is not wrapped", () => {
  const base = rich.createRichMarkdownState("Alpha\n\nBravo\n");
  const spanning = {
    ...base,
    editorState: base.editorState.apply(
      base.editorState.tr.setSelection(TextSelection.create(base.editorState.doc, 2, base.editorState.doc.content.size - 2))
    )
  };
  const state = pasteThroughInputPath(spanning, "https://example.com");
  assertNoLink(state, "selection spanning blocks");
  assertSerialized(state, "Ahttps://example.como\n", "selection spanning blocks");
});

if (failures.length > 0) {
  throw new Error([`MME-0104b: ${failures.length} pairing/paste case(s) failed.`, ...failures].join("\n\n"));
}

// --- harness ---------------------------------------------------------------

function check(label, run) {
  try {
    run();
  } catch (error) {
    if (error instanceof TypeError || error instanceof ReferenceError) {
      throw new Error(`[${label}] harness fault, not an assertion failure: ${error.stack}`);
    }
    failures.push(`[${label}] ${error.message}`);
  }
}

function viewFor(getState, setState) {
  return {
    get state() {
      return getState();
    },
    dispatch(transaction) {
      setState(getState().apply(transaction));
    }
  };
}

function typeThroughInputPath(state, text) {
  let editorState = state.editorState;
  const view = viewFor(
    () => editorState,
    (next) => {
      editorState = next;
    }
  );
  for (const character of text) {
    let handled = false;
    for (const plugin of editorState.plugins) {
      const handler = plugin.props.handleTextInput;
      if (!handler) {
        continue;
      }
      if (handler(view, editorState.selection.from, editorState.selection.to, character)) {
        handled = true;
        break;
      }
    }
    // ProseMirror inserts the character itself when nothing handled it, which is
    // why removing pairing makes these assertions fail rather than crash.
    if (!handled) {
      editorState = editorState.applyTransaction(editorState.tr.insertText(character)).state;
    }
  }
  return { ...state, editorState };
}

function pressKeyThroughInputPath(state, key, modifier) {
  let editorState = state.editorState;
  const view = viewFor(
    () => editorState,
    (next) => {
      editorState = next;
    }
  );
  // `joinBackward` in the base keymap asks the view where the textblock ends.
  view.endOfTextblock = () => false;
  const event = {
    altKey: modifier === "altKey",
    ctrlKey: modifier === "ctrlKey",
    key,
    metaKey: modifier === "metaKey",
    preventDefault() {},
    shiftKey: false
  };
  let handled = false;
  for (const plugin of editorState.plugins) {
    const handler = plugin.props.handleKeyDown;
    if (!handler) {
      continue;
    }
    if (handler(view, event)) {
      handled = true;
      break;
    }
  }
  return { handled, state: { ...state, editorState } };
}

function pasteThroughInputPath(state, text) {
  let editorState = state.editorState;
  const view = viewFor(
    () => editorState,
    (next) => {
      editorState = next;
    }
  );
  const event = {
    clipboardData: {
      files: [],
      getData: (type) => (type === "text/plain" ? text : ""),
      items: [],
      types: ["text/plain"]
    },
    preventDefault() {}
  };
  const slice = new Slice(Fragment.from(state.schema.text(text)), 0, 0);
  let handled = false;
  for (const plugin of editorState.plugins) {
    const handler = plugin.props.handlePaste;
    if (!handler) {
      continue;
    }
    if (handler(view, event, slice)) {
      handled = true;
      break;
    }
  }
  // ProseMirror replaces the selection itself when no plugin handled the paste.
  // Modelling that is what keeps the non-URL case an assertion about the
  // default behaviour rather than about an empty harness.
  if (!handled) {
    editorState = editorState.apply(editorState.tr.replaceSelection(slice));
  }
  return { ...state, editorState };
}

function caretAt(state, position) {
  return {
    ...state,
    editorState: state.editorState.apply(
      state.editorState.tr.setSelection(TextSelection.create(state.editorState.doc, position))
    )
  };
}

function assertBlockText(state, expected, label) {
  const actual = state.editorState.selection.$from.parent.textContent;
  if (actual !== expected) {
    throw new Error(`${label} expected block text ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}.`);
  }
}

function assertCaretOffset(state, expected, label) {
  const actual = state.editorState.selection.$from.parentOffset;
  if (actual !== expected) {
    throw new Error(`${label} expected the caret at offset ${expected}, got ${actual}.`);
  }
}

function assertSerialized(state, expected, label) {
  const actual = rich.serializeRichMarkdownState(state).content;
  if (actual !== expected) {
    throw new Error(`${label} expected Markdown ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}.`);
  }
}

function assertInlineNodes(state, expected, label) {
  const block = state.editorState.selection.$from.parent;
  const actual = [];
  block.forEach((child) => {
    actual.push([child.text ?? `<${child.type.name}>`, child.marks.map((mark) => mark.type.name).sort()]);
  });
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} expected inline nodes ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}.`);
  }
}

function linksIn(state) {
  const found = [];
  state.editorState.doc.descendants((node) => {
    for (const mark of node.marks) {
      if (mark.type.name === "link") {
        found.push({ href: mark.attrs.href, text: node.text });
      }
    }
    return true;
  });
  return found;
}

function assertHasLink(state, href, text, label) {
  const found = linksIn(state);
  if (!found.some((link) => link.href === href && link.text === text)) {
    throw new Error(`${label} expected a link ${JSON.stringify(text)} -> ${JSON.stringify(href)}, got ${JSON.stringify(found)}.`);
  }
}

function assertNoLink(state, label) {
  const found = linksIn(state);
  if (found.length > 0) {
    throw new Error(`${label} expected no link mark, got ${JSON.stringify(found)}.`);
  }
}
