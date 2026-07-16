"use client";

import { useMemo, useState } from "react";
import { openInChatTargets, type OpenInChatTarget } from "./open-in-chat";
import { createPagePrompt } from "./prompt";
import { sectionMarkdownForSlug, type SerializableOutlineItem } from "./outline-utils";

export interface DocActionsProps {
  readonly outline: readonly SerializableOutlineItem[];
  readonly page: {
    readonly path: string;
    readonly rawUrl: string;
    readonly source: string;
    readonly title: string;
  };
}

export function DocActions({ outline, page }: DocActionsProps) {
  const [status, setStatus] = useState("");
  const prompt = useMemo(() => createPagePrompt(page), [page]);

  return (
    <>
      <details aria-label="Page actions" className="docs-actions" id="docs-actions" data-testid="docs-actions">
        <summary className="docs-actions-summary">Page actions</summary>
        <div className="docs-actions-panel">
          <p>Copy source, create an AI prompt, or open this page in an assistant.</p>
          <div className="docs-action-grid">
            <a className="docs-action" data-testid="raw-markdown" href={page.rawUrl}>View source</a>
            <button className="docs-action" data-testid="copy-markdown" type="button" onClick={() => copyText(page.source, "Markdown copied.", setStatus)}>
              Copy Markdown
            </button>
            <button className="docs-action" data-testid="copy-prompt" type="button" onClick={() => copyText(prompt, "Prompt copied.", setStatus)}>
              Copy Prompt
            </button>
            <button
              className="docs-action"
              data-testid="copy-section"
              type="button"
              onClick={() => copyText(sectionMarkdownForSlug(page.source, outline, currentSectionSlug()), "Section copied.", setStatus)}
            >
              Copy Section
            </button>
            <button className="docs-action" data-testid="copy-link" type="button" onClick={() => copyText(window.location.href, "Page link copied.", setStatus)}>
              Copy Link
            </button>
          </div>
          <details className="open-in-chat" data-testid="open-in-chat">
            <summary>Open in Chat</summary>
            <div className="open-in-chat-menu" role="menu">
              {openInChatTargets.map((target) => (
                <button key={target.id} type="button" role="menuitem" onClick={() => openTarget(target, prompt, setStatus)}>
                  {target.label}
                </button>
              ))}
            </div>
          </details>
          </div>
      </details>
      <div aria-live="polite" className="docs-action-status" data-testid="docs-action-status" role="status">
        {status}
      </div>
    </>
  );
}

async function openTarget(
  target: OpenInChatTarget,
  prompt: string,
  setStatus: (message: string) => void
): Promise<void> {
  const url = target.buildUrl(prompt);
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
