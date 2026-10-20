"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useIsMobile } from "@/hooks/useIsMobile";
import { SelectorRow } from "./SelectorRow";

type ApprovalMode = "auto" | "ask" | "yolo";

const OPTIONS: { mode: ApprovalMode; label: string; desc: string }[] = [
  { mode: "auto", label: "AI 审核", desc: "模型判断，拿不准再问" },
  { mode: "ask", label: "每次询问", desc: "需审批的都问我" },
  { mode: "yolo", label: "YOLO", desc: "全部放行，deny 仍生效" },
];

function ShieldIcon({ mode }: { mode: ApprovalMode | null }) {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      {mode === "auto" && <polyline points="9 12 11 14 15 10" />}
      {mode === "ask" && <><path d="M10 9.5a2 2 0 1 1 2.8 1.8c-.5.3-.8.7-.8 1.2" /><line x1="12" y1="16" x2="12" y2="16" /></>}
      {mode === "yolo" && <polyline points="13 7 10 12 14 12 11 17" />}
    </svg>
  );
}

export function ApprovalModeSelector({ showLabel = true }: { showLabel?: boolean }) {
  const isMobile = useIsMobile();
  const [mode, setMode] = useState<ApprovalMode | null>(null);
  const [available, setAvailable] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/approval-mode", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json() as { available?: boolean; mode?: ApprovalMode | null };
      setAvailable(Boolean(data.available));
      setMode(data.mode ?? null);
    } catch {
      // Leave the selector hidden when the server cannot answer.
    }
  }, []);

  useEffect(() => {
    void refresh();
    // The TUI command, Ctrl+Q, or another tab may change the mode.
    const onFocus = () => { void refresh(); };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const handleKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const choose = useCallback(async (next: ApprovalMode) => {
    setOpen(false);
    if (next === mode) return;
    const previous = mode;
    setMode(next);
    setSaving(true);
    try {
      const res = await fetch("/api/approval-mode", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: next }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { mode?: ApprovalMode | null };
      setMode(data.mode ?? next);
    } catch {
      setMode(previous);
    } finally {
      setSaving(false);
    }
  }, [mode]);

  if (!available) return null;
  const current = OPTIONS.find((option) => option.mode === mode);
  const label = current?.label ?? "审批";

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={saving}
        title={`审批模式：${label}（下一轮生效）`}
        aria-label="切换审批模式"
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
          padding: isMobile ? "0 6px" : "8px 12px",
          height: 32,
          background: open ? "var(--bg-hover)" : "none",
          border: "none",
          borderRadius: 9,
          color: mode === "yolo" ? "var(--accent)" : "var(--text-muted)",
          cursor: saving ? "default" : "pointer",
          fontSize: 12,
          transition: "background 0.12s, color 0.12s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--bg-hover)";
          e.currentTarget.style.color = "var(--text)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = open ? "var(--bg-hover)" : "none";
          e.currentTarget.style.color = mode === "yolo" ? "var(--accent)" : "var(--text-muted)";
        }}
      >
        <ShieldIcon mode={mode} />
        {showLabel && <span style={{ whiteSpace: "nowrap" }}>{label}</span>}
      </button>
      {open && (
        <div
          role="listbox"
          aria-label="审批模式"
          style={{
            position: "absolute", bottom: "calc(100% + 6px)", left: 0,
            zIndex: 100, background: "var(--bg)", border: "1px solid var(--border)",
            borderRadius: 8, boxShadow: "0 -4px 16px rgba(0,0,0,0.10)",
            overflow: "hidden", minWidth: 220,
          }}
        >
          {OPTIONS.map((option) => (
            <SelectorRow key={option.mode} active={option.mode === mode} onSelect={() => { void choose(option.mode); }}>
              <span style={{ flex: 1 }}>{option.label}</span>
              <span style={{ fontSize: 11, color: "var(--text-dim)", marginLeft: 8 }}>{option.desc}</span>
            </SelectorRow>
          ))}
        </div>
      )}
    </div>
  );
}
