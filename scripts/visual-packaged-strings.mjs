/**
 * MME-0116 — read a gate's expectation from the package that owns it.
 *
 * Nine of the gates this issue repaired were red for the same reason: they froze
 * a value a later issue legitimately changed. `Export` became `Export copy`
 * (MME-0020), `heading1` became `mme:heading1` (MME-0027), light `--mme-color-bg`
 * became `#fbfcff` (MME-0102). Every one of those was a deliberate product change
 * and every one left a gate red for being out of date rather than for anything
 * being broken.
 *
 * Re-pinning the new literal only resets that clock. So where a value has exactly
 * one declaration in the repository, the gate reads it from there instead. A
 * deliberate change updates one file and the gate follows; a regression — the
 * imported-copy button offering a plain `Save`, a command id that no longer
 * exists — still fails, because the gate asserts the *relationship* between the
 * package and the rendered surface rather than a snapshot of one moment.
 *
 * This is not a licence to assert nothing. Each caller pairs the sourced value
 * with the property the gate exists to prove, and the mutation evidence in the
 * MME-0116 build-log entry shows each one failing.
 */

import { readFile } from "node:fs/promises";

const SURFACE_SOURCE = "packages/md-surface/src/index.ts";

/**
 * A single `key: "value"` string literal from a package source file.
 *
 * Deliberately requires the quoted form, so an interface's
 * `readonly primaryExport: string;` declaration cannot be mistaken for the value.
 *
 * @param {string} path repository-relative source file
 * @param {string} key the property name to read
 */
export async function packagedString(path, key) {
  const source = await readFile(path, "utf8");
  const matches = [...source.matchAll(new RegExp(`(?:^|[\\s{,])${key}:\\s*"([^"]*)"`, "g"))];
  if (matches.length === 0) {
    throw new Error(
      `${path} no longer declares a string value for \`${key}\`. ` +
        "Point the gate at the new declaration rather than guessing the label."
    );
  }
  if (matches.length > 1) {
    throw new Error(
      `${path} declares \`${key}\` ${matches.length} times; the gate cannot tell which one the surface renders.`
    );
  }
  return matches[0][1];
}

/** The default status-panel strings `@momentarise/md-surface` renders. */
export async function surfaceStatusString(key) {
  return packagedString(SURFACE_SOURCE, key);
}

/**
 * The namespaced id `md-surface` gives a built-in command.
 *
 * MME-0027 namespaced every built-in (`heading1` became `mme:heading1`) so host
 * extensions cannot collide with them. A gate that hard-codes either spelling
 * pins one side of that decision; this reads the mapping from the registry
 * itself, and throws if the entry is gone — which is a real regression, unlike a
 * rename.
 *
 * @param {string} richCommand the un-namespaced command the registry entry drives
 */
export async function surfaceCommandId(richCommand) {
  const source = await readFile(SURFACE_SOURCE, "utf8");
  const entry = source.match(new RegExp(`\\{[^}\\n]*\\brichCommand:\\s*"${richCommand}"[^}\\n]*\\}`));
  if (!entry) {
    throw new Error(
      `${SURFACE_SOURCE} has no built-in command registry entry driving \`${richCommand}\`. ` +
        "A missing built-in is a regression; update the gate only if the command was deliberately retired."
    );
  }
  const id = entry[0].match(/\bid:\s*"([^"]+)"/);
  if (!id) {
    throw new Error(`${SURFACE_SOURCE}'s \`${richCommand}\` registry entry declares no id.`);
  }
  if (!id[1].includes(":")) {
    throw new Error(
      `Built-in command \`${richCommand}\` has the un-namespaced id ${JSON.stringify(id[1])}. ` +
        "MME-0027 namespaced every built-in so a host extension cannot collide with one."
    );
  }
  return id[1];
}
