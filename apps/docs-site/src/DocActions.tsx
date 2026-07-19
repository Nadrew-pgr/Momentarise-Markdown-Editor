"use client";

import { useMemo, useState } from "react";
import { createPagePrompt } from "./prompt";
import { sectionMarkdownForSlug, type SerializableOutlineItem } from "./outline-utils";
import type { AgentActionDescriptor, AgentActionRegistry, OpenInChatTargetDescriptor } from "./agent-actions";

export interface DocActionsProps {
  readonly actionRegistry: AgentActionRegistry;
  readonly outline: readonly SerializableOutlineItem[];
  readonly page: {
    readonly path: string;
    readonly rawUrl: string;
    readonly source: string;
    readonly title: string;
  };
}

export function DocActions({ actionRegistry, outline, page }: DocActionsProps) {
  const [status, setStatus] = useState("");
  const prompt = useMemo(() => createPagePrompt(page), [page]);
  const pageActions = actionRegistry.pageActions.filter((action) => action.availability === "shipped");
  const buttonActions = pageActions.filter((action) => action.payload.kind !== "open-in-chat");
  const openInChatAction = pageActions.find((action) => action.payload.kind === "open-in-chat");

  return (
    <>
      <details aria-label="Page actions" className="docs-actions" id="docs-actions" data-testid="docs-actions">
        <summary className="docs-actions-summary">Page actions</summary>
        <div className="docs-actions-panel">
          <p>Copy source, create an AI prompt, or open this page in an assistant.</p>
          <div className="docs-action-grid">
            {buttonActions.map((action) => renderPageAction(action, page, outline, prompt, setStatus))}
          </div>
          {openInChatAction ? (
            <details className="open-in-chat" data-testid={openInChatAction.testId}>
              <summary>{openInChatAction.label}</summary>
              <div className="open-in-chat-menu" role="menu">
                {actionRegistry.openInChatTargets.filter((target) => target.availability === "shipped").map((target) => (
                  <button key={target.id} type="button" role="menuitem" onClick={() => openTarget(target, prompt, setStatus)}>
                    {target.label}
                  </button>
                ))}
              </div>
            </details>
          ) : null}
          </div>
      </details>
      <div aria-live="polite" className="docs-action-status" data-testid="docs-action-status" role="status">
        {status}
      </div>
    </>
  );
}

function renderPageAction(
  action: AgentActionDescriptor,
  page: DocActionsProps["page"],
  outline: readonly SerializableOutlineItem[],
  prompt: string,
  setStatus: (message: string) => void
) {
  if (action.payload.kind === "link" && action.payload.href === "page.rawUrl") {
    return (
      <a className="docs-action" data-testid={action.testId} href={page.rawUrl} key={action.id}>
        {action.label}
      </a>
    );
  }
  if (action.payload.kind === "copy") {
    return (
      <button
        className="docs-action"
        data-testid={action.testId}
        key={action.id}
        type="button"
        onClick={() => copyText(resolveCopyValue(action, page, outline, prompt), action.payload.success ?? "Copied.", setStatus)}
      >
        {action.label}
      </button>
    );
  }
  return null;
}

function resolveCopyValue(
  action: AgentActionDescriptor,
  page: DocActionsProps["page"],
  outline: readonly SerializableOutlineItem[],
  prompt: string
): string {
  switch (action.payload.value) {
    case "browser.currentUrl":
      return window.location.href;
    case "page.currentSection":
      return sectionMarkdownForSlug(page.source, outline, currentSectionSlug());
    case "page.prompt":
      return prompt;
    case "page.source":
      return page.source;
    default:
      return "";
  }
}

async function openTarget(
  target: OpenInChatTargetDescriptor,
  prompt: string,
  setStatus: (message: string) => void
): Promise<void> {
  const url = buildTargetUrl(target, prompt);
  if (!url) {
    await copyText(prompt, `Prompt copied. Paste into ${target.label}.`, setStatus);
    return;
  }
  const popup = window.open(url, "_blank", "noopener,noreferrer");
  if (!popup) {
    await copyText(prompt, `Popup blocked. Prompt copied for ${target.label}.`, setStatus);
    return;
  }
  setStatus(`Opened ${target.label}.`);
}

function buildTargetUrl(target: OpenInChatTargetDescriptor, prompt: string): string | null {
  if (target.mode === "copy-only") {
    return null;
  }
  if (!target.baseUrl || !target.parameterName) {
    return null;
  }
  const encoded = encodeURIComponent(prompt);
  if (encoded.length > (target.maxEncodedPromptLength ?? 8000)) {
    return null;
  }
  return `${target.baseUrl}?${target.parameterName}=${encoded}`;
}

async function copyText(text: string, successMessage: string, setStatus: (message: string) => void): Promise<void> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      setStatus(successMessage);
      return;
    }
    if (fallbackCopy(text)) {
      setStatus(successMessage);
      return;
    }
    setStatus("Copy failed. Use View source or select the visible text manually.");
  } catch {
    setStatus(fallbackCopy(text) ? successMessage : "Copy failed. Use View source or select the visible text manually.");
  }
}

function fallbackCopy(text: string): boolean {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.inset = "0 auto auto 0";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, text.length);
  const copied = document.execCommand("copy");
  textarea.remove();
  return copied;
}

function currentSectionSlug(): string | undefined {
  const raw = window.location.hash.replace(/^#/, "");
  if (!raw) {
    return undefined;
  }
  try {
    return decodeURIComponent(raw);
  } catch {
    return undefined;
  }
}
