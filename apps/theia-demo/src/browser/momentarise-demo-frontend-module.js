"use strict";

const { ContainerModule, injectable } = require("@theia/core/shared/inversify");
const { Disposable, Event } = require("@theia/core/lib/common");
const { BinaryBuffer } = require("@theia/core/lib/common/buffer");
const { URI } = require("@theia/core/lib/common/uri");
const { CommandService } = require("@theia/core/lib/common/command");
const { FrontendApplicationStateService } = require("@theia/core/lib/browser/frontend-application-state");
const { FrontendApplicationContribution } = require("@theia/core/lib/browser/frontend-application-contribution");
const { OpenerService } = require("@theia/core/lib/browser/opener-service");
const { ShellLayoutRestorer } = require("@theia/core/lib/browser/shell/shell-layout-restorer");
const { WidgetManager } = require("@theia/core/lib/browser/widget-manager");
const { FileService } = require("@theia/filesystem/lib/browser/file-service");
const { FileType } = require("@theia/filesystem/lib/common/files");

const DEMO_FILE_SCHEME = "mme-demo";
const MME_WIDGET_FACTORY_ID = "momentarise.markdown.editor";
const VISUAL_SAMPLE_CONTENT = "# MME-0034 visual sample\n\nFind target line for Theia source mode.\n";

class MomentariseDemoLayoutRestorer {
  registerCommands() {}

  storeLayout() {}

  async restoreLayout() {
    return false;
  }
}

injectable()(MomentariseDemoLayoutRestorer);

class MomentariseDemoContribution {
  constructor(commandService, openerService, fileService, stateService, widgetManager) {
    this.commandService = commandService;
    this.fileService = fileService;
    this.openerService = openerService;
    this.stateService = stateService;
    this.widgetManager = widgetManager;
  }

  onDidInitializeLayout() {
    this.registerDemoFileProvider();
    window.__MME_THEIA_DEMO__ = {
      isReady: () => this.stateService.state === "ready",
      diagnoseMarkdownResource: async (resource) => {
        const uri = new URI(resource);
        const file = await withTimeout(this.fileService.readFile(uri), `readFile(${resource})`, 15000);
        const widget = await withTimeout(
          this.widgetManager.getOrCreateWidget(MME_WIDGET_FACTORY_ID, { resource: uri.toString() }),
          `getOrCreateWidget(${MME_WIDGET_FACTORY_ID})`,
          15000
        );
        return {
          attached: Boolean(widget.isAttached),
          fileLength: file.value.toString().length,
          widgetId: widget.id ?? null
        };
      },
      openMarkdownResource: async (resource) => {
        const uri = new URI(resource);
        const opener = await withTimeout(
          this.openerService.getOpener(uri, { mode: "activate" }),
          `getOpener(${resource})`,
          15000
        );
        const widget = await withTimeout(opener.open(uri, { mode: "activate" }), `open(${opener.id ?? "unknown"})`, 15000);
        return {
          id: widget?.id ?? null,
          title: widget?.title?.label ?? null
        };
      },
      openFind: async () => {
        await this.commandService.executeCommand("momentarise.markdown.find");
        return Boolean(document.querySelector('[data-mme-theia-find] [data-testid="find-replace-surface"]:not([hidden])'));
      }
    };
  }

  registerDemoFileProvider() {
    if (this.demoProviderRegistration) {
      return;
    }
    this.demoProviderRegistration = this.fileService.registerProvider(DEMO_FILE_SCHEME, new MomentariseDemoFileSystemProvider());
  }
}

injectable()(MomentariseDemoContribution);

class MomentariseDemoFileSystemProvider {
  constructor() {
    this.capabilities = 2;
    this.decoder = new TextDecoder();
    this.encoder = new TextEncoder();
    this.files = new Map([["/visual-sample.md", VISUAL_SAMPLE_CONTENT]]);
    this.onDidChangeCapabilities = Event.None;
    this.onDidChangeFile = Event.None;
    this.onFileWatchError = Event.None;
    this.onDidChangeReadOnlyMessage = Event.None;
  }

  watch() {
    return Disposable.NULL;
  }

  async stat(resource) {
    const content = this.readContent(resource);
    return {
      ctime: 0,
      mtime: Date.now(),
      size: this.encoder.encode(content).byteLength,
      type: FileType.File
    };
  }

  async readFile(resource) {
    return this.encoder.encode(this.readContent(resource));
  }

  async writeFile(resource, content) {
    this.files.set(this.key(resource), this.decoder.decode(BinaryBuffer.wrap(content).buffer));
  }

  async readDirectory(resource) {
    if (this.key(resource) === "/") {
      return Array.from(this.files.keys()).map((filePath) => [filePath.slice(1), FileType.File]);
    }
    return [];
  }

  async createDirectory() {}

  async delete(resource) {
    this.files.delete(this.key(resource));
  }

  async rename(from, to) {
    const content = this.readContent(from);
    this.files.set(this.key(to), content);
    this.files.delete(this.key(from));
  }

  key(resource) {
    const key = resource.path.toString();
    return key === "" ? "/" : key;
  }

  readContent(resource) {
    return this.files.get(this.key(resource)) ?? "";
  }
}

function withTimeout(promise, label, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Timed out during ${label}.`));
      }, timeoutMs);
    })
  ]);
}

const momentariseDemoFrontendModule = new ContainerModule((bind, _unbind, isBound, rebind) => {
  if (isBound(ShellLayoutRestorer)) {
    rebind(ShellLayoutRestorer).to(MomentariseDemoLayoutRestorer).inSingletonScope();
  }
  bind(MomentariseDemoContribution)
    .toDynamicValue(
      ({ container }) =>
        new MomentariseDemoContribution(
          container.get(CommandService),
          container.get(OpenerService),
          container.get(FileService),
          container.get(FrontendApplicationStateService),
          container.get(WidgetManager)
        )
    )
    .inSingletonScope();
  bind(FrontendApplicationContribution).toService(MomentariseDemoContribution);
});

module.exports = momentariseDemoFrontendModule;
module.exports.default = momentariseDemoFrontendModule;
