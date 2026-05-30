import { existsSync, readFileSync } from "node:fs";
import {
  createMomentariseSourceExtensions,
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

const demoSource = readFileSync("apps/md-demo/src/main.ts", "utf8");
if (!demoSource.includes("@momentarise/md-source-codemirror")) {
  throw new Error("Demo must consume the reusable source CodeMirror package instead of owning all setup locally.");
}
