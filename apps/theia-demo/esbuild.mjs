/**
 * This file can be edited to adjust the ESBuild build process.
 * To reset, delete this file and rerun theia build again.
 */
import { browserOptions, watch } from './gen-esbuild.browser.mjs';
import { nodeOptions } from './gen-esbuild.node.mjs';

import esbuild from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.dirname(fileURLToPath(import.meta.url));
const frontendEntryPath = path.join(appRoot, 'src-gen/frontend/index.js');
const demoModuleImport = "        await load(container, import('../../src/browser/momentarise-demo-frontend-module.js'));";

const require = createRequire(import.meta.url);
const theiaCoreRoot = path.dirname(require.resolve('@theia/core/package.json'));
const theiaCoreResolveRoot = path.dirname(theiaCoreRoot);

function wireMomentariseDemoFrontendModule() {
    const source = readFileSync(frontendEntryPath, 'utf8');
    if (source.includes(demoModuleImport)) {
        return;
    }
    const marker = "        ;\n        startupLog('modules loaded');";
    if (!source.includes(marker)) {
        throw new Error('Could not find Theia frontend module insertion point.');
    }
    writeFileSync(frontendEntryPath, source.replace(marker, `${demoModuleImport}\n${marker}`));
}

const theiaCoreSingletonPlugin = {
    name: 'momentarise-theia-core-singleton',
    setup(build) {
        build.onResolve({ filter: /^@theia\/core(?:\/.*)?$/ }, args => {
            return {
                path: require.resolve(args.path, { paths: [theiaCoreResolveRoot] }),
            };
        });
    }
};

browserOptions.plugins = [
    theiaCoreSingletonPlugin,
    ...browserOptions.plugins
];

wireMomentariseDemoFrontendModule();

const browserContext = await esbuild.context(browserOptions);
const nodeContext = await esbuild.context(nodeOptions);


if (watch) {
    await Promise.all([
        browserContext.watch(),
        nodeContext.watch(),
    ]);
} else {
    try {
        await browserContext.rebuild();
        await browserContext.dispose();
        await nodeContext.rebuild();
        await nodeContext.dispose();
    } catch {
        process.exit(1);
    }
}
