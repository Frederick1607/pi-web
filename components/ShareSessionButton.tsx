"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { SelectorRow } from "./SelectorRow";

// fork: top-bar "share" menu — copy the session file path, an exported HTML file, or Markdown.

function legacyCopy(text: string): void {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(ta);
  if (!ok) throw new Error("Clipboard is not available");
}

/**
 * Copies text that may still be loading. Handing the clipboard a pending
 * ClipboardItem keeps the click's user activation, which Safari needs.
 */
async function copyPending(text: Promise<string>): Promise<void> {
  if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    try {
      const blob = text.then((value) => new Blob([value], { type: "text/plain" }));
      await navigator.clipboard.write([new ClipboardItem({ "text/plain": blob })]);
      return;
    } catch {
      // Fall through to writeText / execCommand.
    }
  }
  const value = await text;
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    legacyCopy(value);
  }
}

type Status = { kind: "idle" } | { kind: "busy" } | { kind: "done"; label: string } | { kind: "error"; message: string };

export function ShareSessionButton({ sessionId, leafId, mobile, buttonStyle, translate }: {
  sessionId: string | null;
  leafId: string | null;
  mobile: boolean;
  buttonStyle: CSSProperties;
  translate: (key: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [anchor, setAnchor] = useState<{ left: number; bottom: number } | null>(null);
  const rootRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const disabled = !sessionId;

  useEffect(() => {
    if (!open) return;
    const handlePointer = (event: PointerEvent) => {
      const path = event.composedPath();
      if ((rootRef.current && path.includes(rootRef.current)) || (panelRef.current && path.includes(panelRef.current))) return;
      setOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", handlePointer, true);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("pointerdown", handlePointer, true);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  useEffect(() => {
    if (status.kind !== "done" && status.kind !== "error") return;
    const timer = setTimeout(() => setStatus({ kind: "idle" }), 1800);
    return () => clearTimeout(timer);
  }, [status]);

  const copyShare = async (kind: "path" | "html") => {
    if (!sessionId) return;
    setStatus({ kind: "busy" });
    const text = fetch(`/api/sessions/${encodeURIComponent(sessionId)}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind }),
    }).then(async (res) => {
      const data = await res.json().catch(() => ({})) as { text?: string; error?: string };
      if (!res.ok || !data.text) throw new Error(data.error ?? `HTTP ${res.status}`);
      return data.text;
    });
    await copyPending(text);
    setStatus({ kind: "done", label: translate(kind === "path" ? "share.pathCopied" : "share.htmlCopied") });
  };

  const copyMarkdown = async () => {
    if (!sessionId) return;
    setStatus({ kind: "busy" });
    const params = leafId ? `?leafId=${encodeURIComponent(leafId)}` : "";
    const markdown = fetch(`/api/sessions/${encodeURIComponent(sessionId)}/markdown${params}`, { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      });
    await copyPending(markdown);
    setStatus({ kind: "done", label: translate("share.markdownCopied") });
  };

  const run = (action: () => Promise<void>) => {
    setOpen(false);
    action().catch((error: unknown) => {
      setStatus({ kind: "error", message: error instanceof Error ? error.message : String(error) });
    });
  };

  const label = status.kind === "busy"
    ? translate("share.copying")
    : status.kind === "done"
      ? status.label
      : status.kind === "error"
        ? translate("share.failed")
        : translate("share.label");
  const color = status.kind === "error" ? "#dc2626" : status.kind === "done" ? "var(--accent)" : disabled ? "var(--text-dim)" : "var(--text-muted)";

  return (
    <>
      <button
        ref={rootRef}
        type="button"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={translate("share.title")}
        title={disabled ? translate("share.unsaved") : status.kind === "error" ? status.message : translate("share.title")}
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          setAnchor({ left: rect.left, bottom: rect.bottom });
          setOpen((v) => !v);
        }}
        style={{
          ...buttonStyle,
          color,
          background: open ? "var(--bg-hover)" : "none",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.45 : 1,
        }}
        onMouseEnter={(event) => {
          if (disabled) return;
          event.currentTarget.style.color = status.kind === "error" ? "#dc2626" : "var(--text)";
          event.currentTarget.style.background = "var(--bg-hover)";
        }}
        onMouseLeave={(event) => {
          event.currentTarget.style.color = color;
          event.currentTarget.style.background = open ? "var(--bg-hover)" : "none";
        }}
        data-mobile-toolbar-action={mobile ? "share" : undefined}
      >
        {status.kind === "done" ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
        )}
        {!mobile && <span>{label}</span>}
      </button>
      {open && anchor && createPortal(
        <div
          ref={panelRef}
          role="menu"
          aria-label={translate("share.title")}
          style={{
            position: "fixed",
            top: anchor.bottom + 4,
            left: Math.max(8, Math.min(anchor.left, window.innerWidth - 248)),
            zIndex: 500,
            minWidth: 240,
            background: "var(--bg)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            boxShadow: "0 4px 16px rgba(0,0,0,0.10)",
            overflow: "hidden",
          }}
        >
          {([
            ["path", () => copyShare("path")],
            ["html", () => copyShare("html")],
            ["markdown", copyMarkdown],
          ] as const).map(([key, action]) => (
            <SelectorRow key={key} active={false} onSelect={() => run(action)}>
              <span style={{ flex: 1 }}>{translate(`share.${key}`)}</span>
              <span style={{ fontSize: 11, color: "var(--text-dim)", marginLeft: 8 }}>{translate(`share.${key}Desc`)}</span>
            </SelectorRow>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}
