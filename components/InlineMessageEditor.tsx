"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useI18n } from "@/hooks/useI18n";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useEnterSendMode } from "@/hooks/useEnterSendMode";
import type { ImageContent } from "@/lib/types";

/** An image kept from the edited message; the same shape the composer sends. */
export interface EditImage {
  data: string;
  mimeType: string;
  previewUrl: string;
}

/** Both the nested `{source}` image format and older flat pi-ai entries. */
export function toEditImage(block: ImageContent): EditImage | null {
  const flat = block as unknown as { data?: unknown; mimeType?: unknown };
  const data = block.source?.type === "base64" ? block.source.data : flat.data;
  const mimeType = block.source?.type === "base64" ? block.source.media_type : flat.mimeType;
  if (typeof data !== "string" || typeof mimeType !== "string") return null;
  return { data, mimeType, previewUrl: `data:${mimeType};base64,${data}` };
}

const MAX_EDITOR_HEIGHT = 320;

/** Edits a past user message in place, where its bubble was. */
export function InlineMessageEditor({ initialText, images: initialImages, onSubmit, onCancel }: {
  initialText: string;
  images: EditImage[];
  onSubmit: (message: string, images?: EditImage[]) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const isMobile = useIsMobile();
  const enterSendMode = useEnterSendMode();
  const [value, setValue] = useState(initialText);
  const [images, setImages] = useState(initialImages);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composingRef = useRef(false);

  const resize = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, MAX_EDITOR_HEIGHT)}px`;
  };

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    resize();
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
    ta.scrollIntoView({ block: "nearest" });
  }, []);

  const canSubmit = Boolean(value.trim() || images.length);
  const submit = () => {
    if (!canSubmit) return;
    onSubmit(value, images.length ? images : undefined);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
      return;
    }
    if (event.key !== "Enter" || composingRef.current || event.nativeEvent.isComposing) return;
    const modifier = event.metaKey || event.ctrlKey;
    const sends = isMobile || enterSendMode === "ctrlEnter" ? modifier : !event.shiftKey && !modifier;
    if (!sends) return;
    event.preventDefault();
    submit();
  };

  const buttonBase = {
    display: "flex", alignItems: "center", justifyContent: "center",
    height: 28, padding: "0 12px",
    borderRadius: 7, fontSize: 12, cursor: "pointer",
  } as const;

  return (
    <div style={{ marginBottom: 16, display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
      <div style={{
        width: "85%",
        boxSizing: "border-box",
        background: "color-mix(in srgb, var(--accent) 8%, var(--user-bg))",
        border: "1px solid color-mix(in srgb, var(--accent) 62%, var(--user-bg))",
        boxShadow: "0 0 0 2px color-mix(in srgb, var(--accent) 16%, transparent)",
        borderRadius: 12,
        padding: "8px 10px",
      }}>
        {images.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
            {images.map((image, index) => (
              <div key={index} style={{ position: "relative" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.previewUrl} alt="" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 6, display: "block", border: "1px solid var(--border)" }} />
                <button
                  type="button"
                  aria-label={t("i18n.remove")}
                  onClick={() => setImages((prev) => prev.filter((_, i) => i !== index))}
                  style={{
                    position: "absolute", top: -6, right: -6, width: 18, height: 18, padding: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    borderRadius: 9, border: "1px solid var(--border)",
                    background: "var(--bg)", color: "var(--text-muted)", cursor: "pointer",
                  }}
                >
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => { setValue(event.target.value); resize(); }}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => { composingRef.current = true; }}
          onCompositionEnd={() => { composingRef.current = false; }}
          rows={1}
          style={{
            display: "block",
            width: "100%",
            boxSizing: "border-box",
            resize: "none",
            border: "none",
            outline: "none",
            background: "transparent",
            color: "var(--text)",
            fontFamily: "inherit",
            fontSize: "calc(14px + var(--chat-font-size-offset, 0px))",
            lineHeight: 1.6,
            maxHeight: MAX_EDITOR_HEIGHT,
            overflowY: "auto",
          }}
        />
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 6 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{ ...buttonBase, background: "none", border: "1px solid var(--border)", color: "var(--text-muted)" }}
          >
            {t("i18n.cancel")}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            style={{
              ...buttonBase,
              background: canSubmit ? "var(--accent)" : "var(--bg-hover)",
              border: "none",
              color: canSubmit ? "#fff" : "var(--text-dim)",
              cursor: canSubmit ? "pointer" : "default",
              fontWeight: 600,
            }}
          >
            {t("chat.send")}
          </button>
        </div>
      </div>
    </div>
  );
}
