import { readFileSync } from "node:fs";

import { JSDOM } from "jsdom";

const surface = await import("../packages/md-surface/dist/index.js");

assert(
  typeof surface.createSurfaceViewportController === "function",
  "MME-0078 requires createSurfaceViewportController."
);

const dom = new JSDOM("<!doctype html><html><body><main id='surface'></main></body></html>");
const host = dom.window.document.querySelector("#surface");
host.style.setProperty("--mme-visual-viewport-height", "777px");
host.dataset.mmeKeyboardOpen = "before";

let measurement = {
  layoutHeight: 844,
  layoutWidth: 390,
  visualHeight: 460,
  visualOffsetTop: 12,
  visualWidth: 390
};
let subscribedListener = null;
let subscriptionCleanups = 0;
const controller = surface.createSurfaceViewportController({
  host,
  viewport: {
    measure() {
      return measurement;
    },
    subscribe(listener) {
      subscribedListener = listener;
      return () => {
        subscribedListener = null;
        subscriptionCleanups += 1;
      };
    }
  }
});

assertEqual(controller.getState(), {
  keyboardInset: 372,
  layoutHeight: 844,
  layoutWidth: 390,
  mode: "visual",
  visualHeight: 460,
  visualOffsetTop: 12,
  visualWidth: 390
}, "initial visual viewport state");
assert(host.style.getPropertyValue("--mme-visual-viewport-height") === "460px", "visual height CSS state");
assert(host.style.getPropertyValue("--mme-visual-viewport-width") === "390px", "visual width CSS state");
assert(host.style.getPropertyValue("--mme-visual-viewport-offset-top") === "12px", "visual offset CSS state");
assert(host.style.getPropertyValue("--mme-keyboard-inset") === "372px", "keyboard inset CSS state");
assert(host.dataset.mmeViewportMode === "visual", "visual viewport data state");
assert(host.dataset.mmeKeyboardOpen === "true", "keyboard-open data state");

measurement = {
  layoutHeight: 844.4,
  layoutWidth: 390.4,
  visualHeight: 844.2,
  visualOffsetTop: -20,
  visualWidth: 390.2
};
subscribedListener?.();
assertEqual(controller.getState(), {
  keyboardInset: 0,
  layoutHeight: 844,
  layoutWidth: 390,
  mode: "visual",
  visualHeight: 844,
  visualOffsetTop: 0,
  visualWidth: 390
}, "resize/scroll update state");
assert(host.dataset.mmeKeyboardOpen === "false", "zero inset closes keyboard state");

measurement = {
  layoutHeight: 700,
  layoutWidth: 360,
  visualHeight: Number.NaN,
  visualOffsetTop: Number.POSITIVE_INFINITY,
  visualWidth: -10
};
controller.update();
assertEqual(controller.getState(), {
  keyboardInset: 0,
  layoutHeight: 700,
  layoutWidth: 360,
  mode: "layout",
  visualHeight: 700,
  visualOffsetTop: 0,
  visualWidth: 360
}, "invalid visual measurements fall back to layout viewport");

measurement = {
  layoutHeight: 700,
  layoutWidth: 360,
  visualHeight: 0,
  visualOffsetTop: 0,
  visualWidth: 0
};
controller.update();
assertEqual(controller.getState(), {
  keyboardInset: 0,
  layoutHeight: 700,
  layoutWidth: 360,
  mode: "layout",
  visualHeight: 700,
  visualOffsetTop: 0,
  visualWidth: 360
}, "transient zero visual dimensions fall back to layout viewport");

controller.destroy();
assert(subscriptionCleanups === 1, "destroy must run the injected subscription cleanup once");
assert(subscribedListener === null, "destroy must detach the injected viewport listener");
assert(
  host.style.getPropertyValue("--mme-visual-viewport-height") === "777px",
  "destroy must restore prior host style state"
);
assert(!host.style.getPropertyValue("--mme-visual-viewport-width"), "destroy must remove newly-owned width state");
assert(host.dataset.mmeKeyboardOpen === "before", "destroy must restore prior host data state");
assert(!host.dataset.mmeViewportMode, "destroy must remove newly-owned viewport mode state");
controller.destroy();
assert(subscriptionCleanups === 1, "destroy must be idempotent");

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
assert(
  packageJson.scripts["test:surface-mobile-viewport"] ===
    "npm run build && node tests/surface-mobile-viewport.test.mjs",
  "Missing focused MME-0078 test script."
);
assert(packageJson.scripts.test.includes("test:surface-mobile-viewport"), "Root npm test must include MME-0078.");
assert(
  packageJson.scripts["visual:mme-0078"] === "node scripts/visual-check-mme0078.mjs",
  "Missing MME-0078 visual script."
);

const surfaceSource = readFileSync("packages/md-surface/src/index.ts", "utf8");
for (const forbidden of ["window.", "document.querySelector", "visualViewport", "localStorage", "sessionStorage"]) {
  assert(!surfaceSource.includes(forbidden), `Viewport controller must not add direct host/global dependency: ${forbidden}`);
}
for (const snippet of [
  "SurfaceViewportAdapter",
  "SurfaceViewportMeasurement",
  "SurfaceViewportState",
  "createSurfaceViewportController",
  "--mme-visual-viewport-height",
  "--mme-keyboard-inset"
]) {
  assert(surfaceSource.includes(snippet), `Surface viewport contract missing ${snippet}.`);
}

const surfaceReadme = readFileSync("packages/md-surface/README.md", "utf8");
assert(surfaceReadme.includes("Viewport Controller"), "md-surface README must document the viewport controller.");
assert(surfaceReadme.includes("host-injected"), "viewport docs must preserve the host capability boundary.");

const themeSource = readFileSync("packages/md-theme/src/index.ts", "utf8");
const themeCss = readFileSync("packages/md-theme/src/tokens.css", "utf8");
for (const snippet of [
  "touchTargetSize",
  "--mme-touch-target-size",
  "--mme-visual-viewport-height: 100dvh",
  "--mme-visual-viewport-width: 100vw",
  "--mme-keyboard-inset: 0px"
]) {
  assert(themeSource.includes(snippet) || themeCss.includes(snippet), `Theme viewport/touch contract missing ${snippet}.`);
}

const demoHtml = readFileSync("apps/md-demo/index.html", "utf8");
assert(
  demoHtml.includes("width=device-width, initial-scale=1.0, viewport-fit=cover"),
  "Reference demo must opt into safe-area viewport coverage."
);

const demoMain = readFileSync("apps/md-demo/src/main.ts", "utf8");
for (const snippet of [
  "createSurfaceViewportController",
  "window.visualViewport",
  "surfaceViewportController",
  "setSurfaceViewportMeasurementForTest",
  "getSurfaceViewportState"
]) {
  assert(demoMain.includes(snippet), `Reference host viewport wiring missing ${snippet}.`);
}

const demoCss = readFileSync("apps/md-demo/src/styles.css", "utf8");
assert(!demoCss.includes("height: 100vh;"), "Reference shell must not use a fixed 100vh height.");
for (const snippet of [
  "var(--mme-visual-viewport-height, 100dvh)",
  "env(safe-area-inset-top)",
  "env(safe-area-inset-right)",
  "env(safe-area-inset-bottom)",
  "env(safe-area-inset-left)",
  "@media (pointer: coarse)",
  "var(--mme-touch-target-size)"
]) {
  assert(demoCss.includes(snippet), `Reference mobile CSS missing ${snippet}.`);
}

const publicApi = JSON.parse(readFileSync("tests/fixtures/public-api-approved.json", "utf8"));
assert(
  publicApi["@momentarise/md-surface"].includes("createSurfaceViewportController"),
  "Intentional viewport controller export must be approved."
);

const visual = readFileSync("scripts/visual-check-mme0078.mjs", "utf8");
for (const artifact of [
  "mobile-touch-rich.png",
  "mobile-touch-commands.png",
  "tablet-touch-rich.png",
  "mobile-keyboard-rich.png",
  "mobile-keyboard-source.png",
  "result.json"
]) {
  assert(visual.includes(artifact), `MME-0078 visual proof missing ${artifact}.`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual(actual, expected, label) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  assert(actualJson === expectedJson, `${label}\nExpected: ${expectedJson}\nActual:   ${actualJson}`);
}
