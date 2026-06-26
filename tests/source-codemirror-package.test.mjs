import { existsSync, readFileSync } from "node:fs";
import {
  createMomentariseSourceCompartments,
  createMomentariseSourceExtensions,
  createMomentariseSourceReconfigureEffects,
  momentariseSourceKeymap,
  momentariseSourcePackage
} from "../packages/md-source-codemirror/dist/index.js";

const packageJsonPath = "packages/md-source-codemirror/package.json";
if (!existsSync(packageJsonPath)) {
  throw new Error("Missing @momentarise/md-source-codemirror package.");
}

const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
if (packageJson.name !== "@momentarise/md-source-codemirror") {
  throw new Error(`Unexpected source package name: ${packageJson.name}`);
}

if (momentariseSourcePackage.packageName !== "@momentarise/md-source-codemirror") {
  throw new Error("Source package contract must expose its package name.");
}

if (!Array.isArray(createMomentariseSourceExtensions()) || createMomentariseSourceExtensions().length === 0) {
  throw new Error("Source package must expose reusable CodeMirror extensions.");
}

if (!Array.isArray(momentariseSourceKeymap()) || momentariseSourceKeymap().length === 0) {
  throw new Error("Source package must expose reusable source keymaps.");
}

const compartments = createMomentariseSourceCompartments();
for (const key of ["behavior", "keymap", "theme"]) {
  if (!compartments[key]) {
    throw new Error(`Source package must expose a CodeMirror ${key} Compartment for live preferences.`);
  }
}

const reconfigureEffects = createMomentariseSourceReconfigureEffects(compartments, {
  density: "compact",
  keymapDelegateToHost: true,
  keymapProfile: "delegate",
  lineWrapping: false,
  readableLineWidth: 720
});
if (!Array.isArray(reconfigureEffects) || reconfigureEffects.length < 3) {
  throw new Error("Source package must produce CodeMirror StateEffects for live preference changes.");
}

const demoSource = readFileSync("apps/md-demo/src/main.ts", "utf8");
if (!demoSource.includes("@momentarise/md-source-codemirror")) {
  throw new Error("Demo must consume the reusable source CodeMirror package instead of owning all setup locally.");
}
