import { ContainerModule } from "@theia/core/shared/inversify/index.js";
import { URI } from "@theia/core/lib/common/uri.js";
import { CommandContribution, type CommandRegistry } from "@theia/core/lib/common/command.js";
import { ContextKeyService, type ContextKey } from "@theia/core/lib/browser/context-key-service.js";
import { ApplicationShell } from "@theia/core/lib/browser/shell/application-shell.js";
import { BaseWidget } from "@theia/core/lib/browser/widgets/widget.js";
import { KeybindingContribution, type KeybindingRegistry } from "@theia/core/lib/browser/keybinding.js";
import { OpenHandler } from "@theia/core/lib/browser/opener-service.js";
import { PreferenceService } from "@theia/core/lib/common/preferences/preference-service.js";
import { type WidgetOpenerOptions } from "@theia/core/lib/browser/widget-open-handler.js";
import { WidgetFactory, WidgetManager } from "@theia/core/lib/browser/widget-manager.js";
import { FileService } from "@theia/filesystem/lib/browser/file-service.js";
import {
  createTheiaMarkdownEditorWidgetClass,
  readTheiaMarkdownDocument,
  registerTheiaMarkdownKeybindings,
  THEIA_MARKDOWN_OPEN_PRIORITY,
  THEIA_MARKDOWN_COMMANDS,
  type TheiaBaseWidgetConstructor,
  type TheiaMarkdownEditorWidget,
  type TheiaResourceLike
} from "../index.js";

export const THEIA_MARKDOWN_WIDGET_FACTORY_ID = "momentarise.markdown.editor";

type TheiaMarkdownLuminoWidget = BaseWidget & TheiaMarkdownEditorWidget;

export interface TheiaMarkdownWidgetFactoryOptions {
  readonly resource: string;
}

export class TheiaMarkdownEditorWidgetFactory implements WidgetFactory {
  readonly id = THEIA_MARKDOWN_WIDGET_FACTORY_ID;
  private readonly focusContext: ContextKey<boolean>;

  constructor(
    private readonly fileService: FileService,
    private readonly preferenceService: PreferenceService,
    contextKeyService: ContextKeyService
  ) {
    this.focusContext = contextKeyService.createKey("momentariseMarkdownEditorFocus", false);
  }

  async createWidget(options?: TheiaMarkdownWidgetFactoryOptions): Promise<TheiaMarkdownLuminoWidget> {
    if (!options?.resource) {
      throw new Error("Theia Markdown widget creation requires a resource URI.");
    }
    const resource = new URI(options.resource) as TheiaResourceLike;
    const document = await readTheiaMarkdownDocument(this.fileService, resource);
    const WidgetClass = createTheiaMarkdownEditorWidgetClass(BaseWidget as unknown as TheiaBaseWidgetConstructor);
    const widget = new WidgetClass(document, {
      contextKey: this.focusContext,
      preferenceService: this.preferenceService
    });
    widget.initialize();
    return widget as TheiaMarkdownLuminoWidget;
  }
}

export class TheiaMarkdownRegisteredOpenHandler implements OpenHandler {
  readonly id = THEIA_MARKDOWN_WIDGET_FACTORY_ID;
  readonly label = "Momentarise Markdown Editor";
  readonly providerName = "momentarise";

  constructor(
    private readonly widgetManager: WidgetManager,
    private readonly shell: ApplicationShell
  ) {}

  canHandle(uri: URI): number {
    const extension = uri.path.ext.toLowerCase();
    return extension === ".md" || extension === ".markdown" || extension === ".mdown" ? THEIA_MARKDOWN_OPEN_PRIORITY : 0;
  }

  async open(uri: URI, options?: WidgetOpenerOptions): Promise<TheiaMarkdownLuminoWidget> {
    const widget = await this.widgetManager.getOrCreateWidget<TheiaMarkdownLuminoWidget>(
      THEIA_MARKDOWN_WIDGET_FACTORY_ID,
      this.createWidgetOptions(uri)
    );
    if (!widget.isAttached) {
      await this.shell.addWidget(widget, options?.widgetOptions ?? { area: "main" });
    }
    const mode = options?.mode ?? "activate";
    if (mode === "activate") {
      await this.shell.activateWidget(widget.id);
    } else if (mode === "reveal") {
      await this.shell.revealWidget(widget.id);
    }
    return widget;
  }

  protected createWidgetOptions(uri: URI): TheiaMarkdownWidgetFactoryOptions {
    return {
      resource: uri.toString()
    };
  }
}

export class TheiaMarkdownCommandContribution implements CommandContribution {
  constructor(private readonly shell: ApplicationShell) {}

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(THEIA_MARKDOWN_COMMANDS.save, {
      execute: () => this.activeWidget()?.save(),
      isEnabled: () => Boolean(this.activeWidget())
    });
    commands.registerCommand(THEIA_MARKDOWN_COMMANDS.find, {
      execute: () => this.activeWidget()?.openFind(),
      isEnabled: () => Boolean(this.activeWidget())
    });
  }

  private activeWidget(): TheiaMarkdownLuminoWidget | undefined {
    const widget = this.shell.currentWidget as TheiaMarkdownLuminoWidget | undefined;
    if (widget?.id?.startsWith(THEIA_MARKDOWN_WIDGET_FACTORY_ID) && typeof widget.save === "function") {
      return widget;
    }
    return undefined;
  }
}

export class TheiaMarkdownKeybindingContribution implements KeybindingContribution {
  registerKeybindings(registry: KeybindingRegistry): void {
    registerTheiaMarkdownKeybindings(registry);
  }
}

export default new ContainerModule((bind: any) => {
  bind(TheiaMarkdownEditorWidgetFactory)
    .toDynamicValue(
      ({ container }: any) =>
        new TheiaMarkdownEditorWidgetFactory(
          container.get(FileService),
          container.get(PreferenceService),
          container.get(ContextKeyService)
        )
    )
    .inSingletonScope();
  bind(WidgetFactory).toService(TheiaMarkdownEditorWidgetFactory);

  bind(TheiaMarkdownRegisteredOpenHandler)
    .toDynamicValue(({ container }: any) => new TheiaMarkdownRegisteredOpenHandler(container.get(WidgetManager), container.get(ApplicationShell)))
    .inSingletonScope();
  bind(OpenHandler).toService(TheiaMarkdownRegisteredOpenHandler);

  bind(TheiaMarkdownCommandContribution)
    .toDynamicValue(({ container }: any) => new TheiaMarkdownCommandContribution(container.get(ApplicationShell)))
    .inSingletonScope();
  bind(CommandContribution).toService(TheiaMarkdownCommandContribution);

  bind(TheiaMarkdownKeybindingContribution).toSelf().inSingletonScope();
  bind(KeybindingContribution).toService(TheiaMarkdownKeybindingContribution);
});
